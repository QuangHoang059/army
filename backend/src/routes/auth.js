import { Router } from 'express';
import { db } from '../db.js';
import {
  checkPasswordPolicy,
  cleanUnitLabel,
  createSession,
  destroySession,
  hashPassword,
  login,
  loginThrottle,
  mapUser,
  requireAuth,
  verifyPassword,
} from '../auth.js';
import { HttpError, ah, str } from '../utils.js';
import { audit } from '../audit.js';

const r = Router();

// POST /api/auth/login { username, password }
r.post('/login', ah((req, res) => {
  const username = str(req.body?.username);
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (!username || !password) throw new HttpError(400, 'Nhập tên đăng nhập và mật khẩu.');
  const throttle = loginThrottle(`${req.ip}|${username.toLowerCase()}`);
  const row = login(username, password);
  if (!row) {
    throttle.fail();
    throw new HttpError(401, 'Sai tên đăng nhập hoặc mật khẩu.');
  }
  throttle.ok();
  createSession(req, res, row.id);
  audit(mapUser(row), 'auth.login', row.username, `Đăng nhập (IP ${req.ip})`);
  res.json(mapUser(row));
}));

// POST /api/auth/logout
r.post('/logout', (req, res) => {
  destroySession(req, res);
  res.status(204).end();
});

// GET /api/auth/me
r.get('/me', requireAuth, (req, res) => res.json(req.user));

// PUT /api/auth/profile { unitLabel } — tự sửa phiên hiệu đơn vị của tài khoản mình
r.put('/profile', requireAuth, ah((req, res) => {
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  const unitLabel = cleanUnitLabel(req.body?.unitLabel);
  if (unitLabel !== (row.unit_label || '')) {
    db.prepare("UPDATE users SET unit_label = ?, updated_at = datetime('now') WHERE id = ?").run(unitLabel, row.id);
    audit(req.user, 'user.update', row.username, `Tự sửa phiên hiệu: ${row.unit_label || '(trống)'} → ${unitLabel || '(trống)'}`);
  }
  res.json(mapUser(db.prepare('SELECT * FROM users WHERE id = ?').get(row.id)));
}));

// POST /api/auth/password { current, password } — tự đổi mật khẩu; đăng xuất các thiết bị khác
r.post('/password', requireAuth, ah((req, res) => {
  const { current, password } = req.body || {};
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (typeof current !== 'string' || !verifyPassword(current, row.password_hash))
    throw new HttpError(400, 'Mật khẩu hiện tại không đúng.');
  checkPasswordPolicy(password);
  db.transaction(() => {
    db.prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?").run(hashPassword(password), row.id);
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(row.id);
  })();
  createSession(req, res, row.id); // giữ đăng nhập ở thiết bị đang dùng
  audit(req.user, 'auth.password', row.username, 'Tự đổi mật khẩu');

  res.json({ ok: true });
}));

export default r;
