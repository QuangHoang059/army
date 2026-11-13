// Nhắn tin trực tiếp giữa các tài khoản (1-1). Chỉ tài khoản đang hoạt động mới nhận được tin.
// Không ghi nội dung tin nhắn vào nhật ký thao tác (riêng tư giữa 2 người).
import { Router } from 'express';
import { db } from '../db.js';
import { HttpError, ah } from '../utils.js';

const r = Router();
const MAX_LEN = 2000;

const mapMsg = (m) => ({ id: m.id, fromId: m.from_id, toId: m.to_id, body: m.body, createdAt: m.created_at, readAt: m.read_at || null });

/** Danh bạ: mọi tài khoản đang hoạt động (trừ mình) + tin cuối + số tin chưa đọc. Ai có tin mới nhất lên đầu. */
r.get('/contacts', ah((req, res) => {
  const me = req.user.id;
  const rows = db
    .prepare(
      `SELECT u.id, u.username, u.full_name, u.role, u.unit_label,
              (SELECT COUNT(*) FROM messages m WHERE m.from_id = u.id AND m.to_id = @me AND m.read_at IS NULL) unread,
              lm.id last_id, lm.body last_body, lm.created_at last_at, lm.from_id last_from
       FROM users u
       LEFT JOIN messages lm ON lm.id = (
         SELECT MAX(id) FROM messages m
         WHERE (m.from_id = u.id AND m.to_id = @me) OR (m.from_id = @me AND m.to_id = u.id))
       WHERE u.id != @me AND u.active = 1
       ORDER BY lm.id IS NULL, lm.id DESC, u.full_name`,
    )
    .all({ me });
  res.json(
    rows.map((x) => ({
      id: x.id,
      username: x.username,
      fullName: x.full_name,
      role: x.role,
      unitLabel: x.unit_label || '',
      unread: x.unread,
      last: x.last_id ? { body: x.last_body, createdAt: x.last_at, mine: x.last_from === me } : null,
    })),
  );
}));

/** Tổng số tin chưa đọc (hiện số trên menu) */
r.get('/unread', ah((req, res) => {
  const { n } = db.prepare('SELECT COUNT(*) n FROM messages WHERE to_id = ? AND read_at IS NULL').get(req.user.id);
  res.json({ unread: n });
}));

/** Hội thoại với 1 tài khoản. ?after=id → chỉ lấy tin mới hơn (dùng khi tự cập nhật). Đánh dấu đã đọc tin gửi đến mình. */
r.get('/with/:userId', ah((req, res) => {
  const me = req.user.id;
  const other = Number(req.params.userId);
  if (!Number.isInteger(other) || other === me) throw new HttpError(400, 'Người nhận không hợp lệ.');
  const after = Number(req.query.after) || 0;
  const rows = db
    .prepare(
      `SELECT * FROM (
         SELECT * FROM messages
         WHERE ((from_id = @me AND to_id = @other) OR (from_id = @other AND to_id = @me)) AND id > @after
         ORDER BY id DESC LIMIT 300)
       ORDER BY id`,
    )
    .all({ me, other, after });
  db.prepare("UPDATE messages SET read_at = datetime('now','localtime') WHERE to_id = ? AND from_id = ? AND read_at IS NULL").run(me, other);
  // Mốc "đã xem" của tin mình gửi gần nhất (để hiện "Đã xem")
  const seen = db.prepare('SELECT MAX(id) id FROM messages WHERE from_id = ? AND to_id = ? AND read_at IS NOT NULL').get(me, other);
  res.json({ items: rows.map(mapMsg), seenUpTo: seen?.id || 0 });
}));

/** Gửi tin: { toId, body } */
r.post('/', ah((req, res) => {
  const me = req.user.id;
  const toId = Number(req.body?.toId);
  const body = typeof req.body?.body === 'string' ? req.body.body.replace(/\r\n/g, '\n').trim() : '';
  if (!body) throw new HttpError(400, 'Nội dung tin nhắn trống.');
  if (body.length > MAX_LEN) throw new HttpError(400, `Tin nhắn tối đa ${MAX_LEN} ký tự.`);
  if (!Number.isInteger(toId) || toId === me) throw new HttpError(400, 'Người nhận không hợp lệ.');
  const to = db.prepare('SELECT id, active FROM users WHERE id = ?').get(toId);
  if (!to || !to.active) throw new HttpError(404, 'Tài khoản nhận không tồn tại hoặc đã bị khoá.');
  const { lastInsertRowid } = db.prepare('INSERT INTO messages (from_id, to_id, body) VALUES (?, ?, ?)').run(me, toId, body);
  res.status(201).json(mapMsg(db.prepare('SELECT * FROM messages WHERE id = ?').get(lastInsertRowid)));
}));

export default r;
