import { BACKEND_DIR } from './env.js';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_WEAPON_TYPES } from './constants.js';

export const DB_PATH = path.resolve(BACKEND_DIR, process.env.DB_PATH || './data/army.db');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS weapons (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  code         TEXT NOT NULL UNIQUE,           -- mã QR, vd QRCB-001
  name         TEXT NOT NULL,
  serial       TEXT NOT NULL UNIQUE,           -- số hiệu, vd VN-001
  type         TEXT NOT NULL,
  unit         TEXT NOT NULL,
  responsible  TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'Tốt',
  last_maint   TEXT NOT NULL,                  -- YYYY-MM-DD
  next_maint   TEXT NOT NULL,                  -- YYYY-MM-DD
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS maintenance (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  weapon_id   INTEGER NOT NULL REFERENCES weapons(id) ON DELETE CASCADE,
  date        TEXT NOT NULL,
  content     TEXT NOT NULL,
  worker      TEXT NOT NULL,
  result      TEXT NOT NULL,
  next_date   TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_maint_weapon ON maintenance(weapon_id, date);

CREATE TABLE IF NOT EXISTS loans (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  weapon_id      INTEGER NOT NULL REFERENCES weapons(id) ON DELETE CASCADE,
  borrower       TEXT NOT NULL,
  purpose        TEXT NOT NULL,
  borrow_at      TEXT NOT NULL,                -- YYYY-MM-DDTHH:MM
  return_at      TEXT,
  return_status  TEXT,
  status         TEXT NOT NULL DEFAULT 'Đang mượn',
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_loans_weapon ON loans(weapon_id, borrow_at);
CREATE INDEX IF NOT EXISTS idx_loans_status ON loans(status);
`);

// ---- Migration: cột ảnh minh hoạ (DB cũ chưa có) ----
if (!db.prepare('PRAGMA table_info(weapons)').all().some((c) => c.name === 'photo')) {
  db.exec('ALTER TABLE weapons ADD COLUMN photo TEXT');
}

// ---- Migration: thanh lý (thay cho xoá hẳn), người ghi phiếu ----
const addColumns = (table, cols) => {
  const have = new Set(db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name));
  for (const [name, def] of cols) if (!have.has(name)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${def}`);
};
addColumns('weapons', [['retired_at', 'TEXT'], ['retired_reason', 'TEXT']]);
addColumns('maintenance', [['recorded_by', 'TEXT']]);
addColumns('loans', [['recorded_by', 'TEXT'], ['returned_by', 'TEXT']]);

// ---- Nhật ký thao tác ----
db.exec(`
CREATE TABLE IF NOT EXISTS audit_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  at         TEXT NOT NULL DEFAULT (datetime('now')),   -- UTC
  user_id    INTEGER,                                  -- không FK: giữ nhật ký kể cả khi xoá tài khoản
  actor      TEXT NOT NULL,                            -- "Họ tên (username)" tại thời điểm thao tác
  action     TEXT NOT NULL,                            -- vd weapon.update, loan.return
  entity     TEXT,                                     -- mã vũ khí / tên đăng nhập / tên loại
  summary    TEXT NOT NULL,
  detail     TEXT                                      -- JSON (vd các trường đã đổi)
);
CREATE INDEX IF NOT EXISTS idx_audit_at ON audit_log(at);
`);

// ---- Tài khoản, phiên đăng nhập, danh mục loại vũ khí ----
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT NOT NULL UNIQUE COLLATE NOCASE,
  full_name     TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('admin', 'user')),
  password_hash TEXT NOT NULL,                  -- scrypt$<salt hex>$<hash hex>
  active        INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash  TEXT PRIMARY KEY,                 -- sha256 của token trong cookie (DB lộ cũng không dùng lại được)
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  TEXT NOT NULL,                    -- ISO
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS weapon_types (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL UNIQUE COLLATE NOCASE,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

// Lần đầu: nạp danh mục loại từ danh sách mặc định + các loại đang có trong bảng weapons.
if (db.prepare('SELECT COUNT(*) AS n FROM weapon_types').get().n === 0) {
  const ins = db.prepare('INSERT OR IGNORE INTO weapon_types (name) VALUES (?)');
  db.transaction(() => {
    for (const t of DEFAULT_WEAPON_TYPES) ins.run(t);
    for (const { type } of db.prepare('SELECT DISTINCT type FROM weapons').all()) ins.run(type);
  })();
}

/** Danh sách tên loại vũ khí hiện có (theo thứ tự tạo). */
export const weaponTypeNames = () => db.prepare('SELECT name FROM weapon_types ORDER BY id').pluck().all();
// SQLite NOCASE chỉ gộp hoa/thường cho chữ ASCII → so sánh tiếng Việt (Ố/ố, Á/á…) làm ở JS.
export const typeKey = (s) => String(s).normalize('NFC').toLocaleLowerCase('vi');
/** Loại trong danh mục trùng tên (không phân biệt hoa thường, kể cả chữ có dấu) → { id, name }, hoặc undefined. */
export const findWeaponTypeRow = (name) =>
  db.prepare('SELECT id, name FROM weapon_types').all().find((t) => typeKey(t.name) === typeKey(name));
/** Trả về tên loại đúng như trong danh mục, hoặc undefined. */
export const findWeaponType = (name) => findWeaponTypeRow(name)?.name;

// ---- Thư mục lưu ảnh vũ khí ----
export const UPLOAD_DIR = path.resolve(BACKEND_DIR, process.env.UPLOAD_DIR || path.join(path.dirname(DB_PATH), 'uploads'));
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

/** Xoá 1 file ảnh trong UPLOAD_DIR (bỏ qua nếu không có). */
export const removePhoto = (name) => {
  if (name) fs.rmSync(path.join(UPLOAD_DIR, path.basename(name)), { force: true });
};
/** Xoá toàn bộ ảnh đã upload. */
export const clearUploads = () => {
  for (const f of fs.readdirSync(UPLOAD_DIR)) fs.rmSync(path.join(UPLOAD_DIR, f), { force: true });
};

// ---- Row mappers (snake_case DB -> camelCase API) ----
export const mapWeapon = (r) =>
  r && {
    id: r.id,
    code: r.code,
    name: r.name,
    serial: r.serial,
    type: r.type,
    unit: r.unit,
    responsible: r.responsible,
    status: r.status,
    last: r.last_maint,
    next: r.next_maint,
    photo: r.photo ? `/api/uploads/${r.photo}` : null,
    retired: !!r.retired_at,
    retiredAt: r.retired_at || null,
    retiredReason: r.retired_reason || null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };

export const mapMaint = (r) =>
  r && {
    id: r.id,
    weaponId: r.weapon_id,
    weaponCode: r.weapon_code,
    weaponName: r.weapon_name,
    date: r.date,
    content: r.content,
    worker: r.worker,
    result: r.result,
    nextDate: r.next_date,
    recordedBy: r.recorded_by || null,
    createdAt: r.created_at,
  };

export const mapLoan = (r) =>
  r && {
    id: r.id,
    weaponId: r.weapon_id,
    weaponCode: r.weapon_code,
    weaponName: r.weapon_name,
    borrower: r.borrower,
    purpose: r.purpose,
    borrowAt: r.borrow_at,
    returnAt: r.return_at || '',
    returnStatus: r.return_status || '',
    status: r.status,
    recordedBy: r.recorded_by || null,
    returnedBy: r.returned_by || null,
    createdAt: r.created_at,
  };

export const MAINT_SELECT = `
  SELECT m.*, w.code AS weapon_code, w.name AS weapon_name
  FROM maintenance m JOIN weapons w ON w.id = m.weapon_id`;

export const LOAN_SELECT = `
  SELECT l.*, w.code AS weapon_code, w.name AS weapon_name
  FROM loans l JOIN weapons w ON w.id = l.weapon_id`;

// ---- Migration: phiên hiệu đơn vị riêng cho từng tài khoản (hiện trên đầu trang) ----
addColumns('users', [['unit_label', "TEXT NOT NULL DEFAULT ''"]]);
