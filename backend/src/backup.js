// Sao lưu dữ liệu: mỗi bản là 1 thư mục backups/<thời gian>_<nhãn>/ gồm army.db + uploads/ (ảnh).
// Dùng: npm run backup                → sao lưu ngay
//       (server tự sao lưu mỗi BACKUP_INTERVAL_HOURS giờ, mặc định 24; giữ BACKUP_KEEP bản mới nhất, mặc định 30)
// Khôi phục: npm run restore (xem src/restore.js)
import fs from 'node:fs';
import path from 'node:path';
import { BACKEND_DIR } from './env.js';
import { db, UPLOAD_DIR } from './db.js';

export const BACKUP_DIR = path.resolve(BACKEND_DIR, process.env.BACKUP_DIR || './backups');
const KEEP = Math.max(1, Number(process.env.BACKUP_KEEP) || 30);
const NAME_RE = /^(\d{4})-(\d{2})-(\d{2})_(\d{2})(\d{2})(\d{2})_([a-z-]+)$/;

const pad = (n) => String(n).padStart(2, '0');
const stamp = (d = new Date()) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;

function dirSize(p) {
  let n = 0;
  for (const e of fs.readdirSync(p, { withFileTypes: true })) {
    const f = path.join(p, e.name);
    n += e.isDirectory() ? dirSize(f) : fs.statSync(f).size;
  }
  return n;
}

function info(name) {
  const m = NAME_RE.exec(name);
  if (!m) return null;
  const dir = path.join(BACKUP_DIR, name);
  if (!fs.existsSync(path.join(dir, 'army.db'))) return null;
  const [, y, mo, d, h, mi, s, label] = m;
  const photos = fs.existsSync(path.join(dir, 'uploads')) ? fs.readdirSync(path.join(dir, 'uploads')).length : 0;
  return { name, label, createdAt: `${y}-${mo}-${d}T${h}:${mi}:${s}`, size: dirSize(dir), photos };
}

/** Danh sách bản sao lưu, mới nhất trước. */
export function listBackups() {
  if (!fs.existsSync(BACKUP_DIR)) return [];
  return fs
    .readdirSync(BACKUP_DIR)
    .filter((n) => NAME_RE.test(n))
    .sort()
    .reverse()
    .map(info)
    .filter(Boolean);
}

/** Giữ KEEP bản mới nhất, xoá các bản cũ hơn. */
function prune() {
  for (const b of listBackups().slice(KEEP)) fs.rmSync(path.join(BACKUP_DIR, b.name), { recursive: true, force: true });
}

let running = null;
/** Sao lưu ngay (an toàn khi server đang chạy — dùng SQLite online backup). label: chữ thường a-z và '-'. */
export function backupNow(label = 'manual') {
  if (running) return running; // đang sao lưu thì dùng chung kết quả
  running = (async () => {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    let name = `${stamp()}_${label}`;
    for (let i = 1; fs.existsSync(path.join(BACKUP_DIR, name)); i++) name = `${stamp()}_${label}${'-'.repeat(i)}`;
    const dir = path.join(BACKUP_DIR, name);
    fs.mkdirSync(dir);
    try {
      await db.backup(path.join(dir, 'army.db'));
      if (fs.existsSync(UPLOAD_DIR)) fs.cpSync(UPLOAD_DIR, path.join(dir, 'uploads'), { recursive: true });
    } catch (e) {
      fs.rmSync(dir, { recursive: true, force: true });
      throw e;
    }
    prune();
    return info(name);
  })().finally(() => {
    running = null;
  });
  return running;
}

/** Server: tự sao lưu khi bản gần nhất cũ hơn BACKUP_INTERVAL_HOURS (kiểm tra mỗi giờ). 0 = tắt. */
export function startAutoBackup() {
  const hours = Number(process.env.BACKUP_INTERVAL_HOURS ?? 24);
  if (!(hours > 0)) return;
  const check = async () => {
    const last = listBackups()[0];
    if (last && Date.now() - new Date(last.createdAt).getTime() < hours * 3600_000) return;
    try {
      const b = await backupNow('auto');
      console.log(`[backup] Đã tự sao lưu: ${path.join(BACKUP_DIR, b.name)}`);
    } catch (e) {
      console.error('[backup] Sao lưu tự động lỗi:', e);
    }
  };
  setTimeout(check, 15_000).unref();
  setInterval(check, 3600_000).unref();
}

// CLI: node src/backup.js
if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('src/backup.js')) {
  try {
    const b = await backupNow('manual');
    console.log(`Đã sao lưu: ${path.join(BACKUP_DIR, b.name)} (${(b.size / 1024).toFixed(0)} KB, ${b.photos} ảnh)`);
  } catch (e) {
    console.error('Sao lưu lỗi:', e.message);
    process.exitCode = 1;
  }
  db.close();
}
