// Xác thực bằng phiên (session) lưu trong SQLite + cookie httpOnly. Không cần thư viện ngoài.
import crypto from 'node:crypto';
import { db } from './db.js';
import { HttpError } from './utils.js';

export const ROLES = ['admin', 'user'];
export const SESSION_COOKIE = 'sid';
const SESSION_DAYS = Number(process.env.SESSION_DAYS) || 7;
const SESSION_MS = SESSION_DAYS * 86400000;

// ---- Mật khẩu: scrypt + salt ngẫu nhiên ----
export function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(pw, salt, 64);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

export function verifyPassword(pw, stored) {
  const [alg, saltHex, hashHex] = String(stored).split('$');
  if (alg !== 'scrypt' || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = crypto.scryptSync(pw, Buffer.from(saltHex, 'hex'), expected.length);
  return crypto.timingSafeEqual(actual, expected);
}

// Hash giả để so sánh khi sai tên đăng nhập → thời gian phản hồi như nhau, không dò được tên tồn tại.
const DUMMY_HASH = hashPassword(crypto.randomBytes(8).toString('hex'));

export function checkPasswordPolicy(pw) {
  if (typeof pw !== 'string' || pw.length < 6) throw new HttpError(400, 'Mật khẩu phải có ít nhất 6 ký tự.');
  if (pw.length > 128) throw new HttpError(400, 'Mật khẩu quá dài (tối đa 128 ký tự).');
}

export const mapUser = (r) =>
  r && {
    id: r.id,
    username: r.username,
    fullName: r.full_name,
    unitLabel: r.unit_label || '',
    role: r.role,
    active: !!r.active,
    createdAt: r.created_at,
  };

// ---- Phiên đăng nhập ----
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

function parseCookies(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

const cookieAttrs = (req) =>
  // Secure chỉ khi chạy HTTPS (sau reverse proxy thì dựa vào X-Forwarded-Proto)
  `Path=/; HttpOnly; SameSite=Lax${req.secure || req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : ''}`;

export function createSession(req, res, userId) {
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(new Date().toISOString()); // dọn phiên hết hạn
  const token = crypto.randomBytes(32).toString('base64url');
  db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').run(
    sha256(token),
    userId,
    new Date(Date.now() + SESSION_MS).toISOString(),
  );
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=${token}; ${cookieAttrs(req)}; Max-Age=${SESSION_MS / 1000}`);
}

export function destroySession(req, res) {
  const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
  if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(token));
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; ${cookieAttrs(req)}; Max-Age=0`);
}

/** Middleware: gắn req.user nếu cookie phiên hợp lệ (không chặn). */
export function authenticate(req, res, next) {
  req.user = null;
  const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
  if (token) {
    const row = db
      .prepare(
        `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
         WHERE s.token_hash = ? AND s.expires_at > ? AND u.active = 1`,
      )
      .get(sha256(token), new Date().toISOString());
    if (row) req.user = mapUser(row);
  }
  next();
}

export function requireAuth(req, res, next) {
  if (!req.user) return next(new HttpError(401, 'Bạn cần đăng nhập.'));
  next();
}

export function requireAdmin(req, res, next) {
  if (!req.user) return next(new HttpError(401, 'Bạn cần đăng nhập.'));
  if (req.user.role !== 'admin') return next(new HttpError(403, 'Chỉ quản trị viên (admin) được thực hiện thao tác này.'));
  next();
}

/** Cho link mở trực tiếp bằng trình duyệt (vd link ảnh trên tem QR): chưa đăng nhập → về trang đăng nhập rồi quay lại. */
export function loginRedirect(req, res, next) {
  if (req.user) return next();
  res.redirect(302, `/login?next=${encodeURIComponent(req.originalUrl)}`);
}

/** Chỉ admin được ghi; GET/HEAD thì người dùng đã đăng nhập là được. */
export function adminForWrites(req, res, next) {
  return req.method === 'GET' || req.method === 'HEAD' ? requireAuth(req, res, next) : requireAdmin(req, res, next);
}

// ---- Chống dò mật khẩu: tối đa 10 lần sai / 15 phút cho mỗi IP + tên đăng nhập ----
const FAIL_LIMIT = 10;
const FAIL_WINDOW_MS = 15 * 60 * 1000;
const fails = new Map();

export function loginThrottle(key) {
  const now = Date.now();
  for (const [k, v] of fails) if (now - v.first > FAIL_WINDOW_MS) fails.delete(k);
  const f = fails.get(key);
  if (f && f.count >= FAIL_LIMIT) {
    const mins = Math.ceil((FAIL_WINDOW_MS - (now - f.first)) / 60000);
    throw new HttpError(429, `Sai mật khẩu quá nhiều lần. Thử lại sau ${mins} phút.`);
  }
  return {
    fail: () => {
      const cur = fails.get(key);
      if (cur) cur.count++;
      else fails.set(key, { first: now, count: 1 });
    },
    ok: () => fails.delete(key),
  };
}

export function login(username, password) {
  const row = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  const ok = verifyPassword(password, row ? row.password_hash : DUMMY_HASH);
  if (!row || !ok) return null;
  if (!row.active) throw new HttpError(403, 'Tài khoản đã bị khoá. Liên hệ quản trị viên.');
  return row;
}

/** Chưa có tài khoản nào → tạo admin đầu tiên từ ADMIN_USERNAME / ADMIN_PASSWORD (mặc định admin / admin123). */
export function ensureAdmin() {
  if (db.prepare('SELECT COUNT(*) AS n FROM users').get().n > 0) return;
  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD || 'admin123';
  db.prepare("INSERT INTO users (username, full_name, role, password_hash) VALUES (?, ?, 'admin', ?)").run(
    username,
    'Quản trị viên',
    hashPassword(password),
  );
  console.warn(
    `[auth] Đã tạo tài khoản admin đầu tiên: ${username}` +
      (process.env.ADMIN_PASSWORD ? '' : ' / admin123 — HÃY ĐỔI MẬT KHẨU NGAY sau khi đăng nhập.'),
  );
}

/** Phiên hiệu đơn vị hiển thị trên đầu trang, vd "Trung đội 2 — Đại đội 7". Rỗng = dùng tiêu đề mặc định. */
export function cleanUnitLabel(v) {
  const s = typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : '';
  if (s.length > 100) throw new HttpError(400, 'Phiên hiệu tối đa 100 ký tự.');
  return s;
}
