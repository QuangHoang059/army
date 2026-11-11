// Quản lý tài khoản — chỉ admin (đã chặn bằng requireAdmin ở server.js).
import { Router } from 'express';
import { db } from '../db.js';
import { ROLES, checkPasswordPolicy, cleanUnitLabel, hashPassword, mapUser } from '../auth.js';
import { HttpError, ah, str } from '../utils.js';
import { audit } from '../audit.js';

const r = Router();
const USERNAME_RE = /^[a-zA-Z0-9._-]{3,32}$/;

const getUser = (id) => db.prepare('SELECT * FROM users WHERE id = ?').get(Number(id));
const activeAdmins = () => db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND active = 1").get().n;

// GET /api/users
r.get('/', (req, res) => {
  res.json(db.prepare('SELECT * FROM users ORDER BY role, username').all().map(mapUser));
});

// POST /api/users { username, fullName, unitLabel?, role, password }
r.post('/', ah((req, res) => {
  const username = str(req.body?.username);
  const fullName = str(req.body?.fullName);
  const role = req.body?.role || 'user';
  const unitLabel = cleanUnitLabel(req.body?.unitLabel);
  if (!USERNAME_RE.test(username))
    throw new HttpError(400, 'Tên đăng nhập 3–32 ký tự, chỉ gồm chữ không dấu, số, dấu chấm, gạch dưới, gạch ngang.');
  if (!fullName) throw new HttpError(400, 'Nhập họ tên.');
  if (!ROLES.includes(role)) throw new HttpError(400, 'Vai trò không hợp lệ.');
  checkPasswordPolicy(req.body?.password);
  try {
    const info = db
      .prepare('INSERT INTO users (username, full_name, unit_label, role, password_hash) VALUES (?, ?, ?, ?, ?)')
      .run(username, fullName, unitLabel, role, hashPassword(req.body.password));
    audit(req.user, 'user.create', username, `Tạo tài khoản ${username} — ${fullName} (${role})${unitLabel ? ` — ${unitLabel}` : ''}`);
    res.status(201).json(mapUser(getUser(info.lastInsertRowid)));
  } catch (e) {
    if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') throw new HttpError(409, 'Tên đăng nhập đã tồn tại.');
    throw e;
  }
}));

// PUT /api/users/:id { fullName?, unitLabel?, role?, active?, password? }
r.put('/:id', ah((req, res) => {
  const cur = getUser(req.params.id);
  if (!cur) throw new HttpError(404, 'Không tìm thấy tài khoản.');
  const b = req.body || {};
  const fullName = b.fullName !== undefined ? str(b.fullName) : cur.full_name;
  const unitLabel = b.unitLabel !== undefined ? cleanUnitLabel(b.unitLabel) : cur.unit_label || '';
  const role = b.role ?? cur.role;
  const active = b.active !== undefined ? (b.active ? 1 : 0) : cur.active;
  if (!fullName) throw new HttpError(400, 'Nhập họ tên.');
  if (!ROLES.includes(role)) throw new HttpError(400, 'Vai trò không hợp lệ.');

  const self = cur.id === req.user.id;
  if (self && (role !== 'admin' || !active))
    throw new HttpError(400, 'Không thể tự hạ quyền hoặc tự khoá tài khoản đang đăng nhập.');
  if (cur.role === 'admin' && cur.active && (role !== 'admin' || !active) && activeAdmins() <= 1)
    throw new HttpError(400, 'Phải còn ít nhất 1 admin đang hoạt động.');

  db.transaction(() => {
    db.prepare("UPDATE users SET full_name = ?, unit_label = ?, role = ?, active = ?, updated_at = datetime('now') WHERE id = ?").run(
      fullName,
      unitLabel,
      role,
      active,
      cur.id,
    );
    if (b.password !== undefined && b.password !== '') {
      checkPasswordPolicy(b.password);
      db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(b.password), cur.id);
    }
    const what = [];
    if (fullName !== cur.full_name) what.push(`họ tên: ${cur.full_name} → ${fullName}`);
    if (unitLabel !== (cur.unit_label || '')) what.push(`phiên hiệu: ${cur.unit_label || '(trống)'} → ${unitLabel || '(trống)'}`);
    if (role !== cur.role) what.push(`vai trò: ${cur.role} → ${role}`);
    if (active !== cur.active) what.push(active ? 'mở khoá' : 'khoá');
    if (b.password) what.push('đặt lại mật khẩu');
    if (what.length) audit(req.user, 'user.update', cur.username, `Tài khoản ${cur.username}: ${what.join('; ')}`);
    // Đổi quyền / khoá / đặt lại mật khẩu → buộc đăng nhập lại (trừ chính mình)
    if (!self && (role !== cur.role || !active || b.password)) db.prepare('DELETE FROM sessions WHERE user_id = ?').run(cur.id);
  })();
  res.json(mapUser(getUser(cur.id)));
}));

// DELETE /api/users/:id
r.delete('/:id', ah((req, res) => {
  const cur = getUser(req.params.id);
  if (!cur) throw new HttpError(404, 'Không tìm thấy tài khoản.');
  if (cur.id === req.user.id) throw new HttpError(400, 'Không thể tự xoá tài khoản đang đăng nhập.');
  if (cur.role === 'admin' && cur.active && activeAdmins() <= 1) throw new HttpError(400, 'Phải còn ít nhất 1 admin đang hoạt động.');
  db.prepare('DELETE FROM users WHERE id = ?').run(cur.id); // sessions xoá theo ON DELETE CASCADE
  audit(req.user, 'user.delete', cur.username, `Xoá tài khoản ${cur.username} — ${cur.full_name}`);

  res.status(204).end();
}));

export default r;
