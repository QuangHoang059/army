import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { db, UPLOAD_DIR } from '../db.js';
import { HttpError, ah } from '../utils.js';

// Trang công khai khi quét tem QR bằng điện thoại: KHÔNG cần đăng nhập, CHỈ trả thông tin của đúng 1 vũ khí.
// Không có lịch sử bảo dưỡng / mượn trả, không có thông tin tài khoản, không liệt kê được vũ khí khác.
const r = Router();
const TOKEN_RE = /^[0-9a-f]{24}$/;

// Chống dò: tối đa 60 lượt / 5 phút cho mỗi IP
const LIMIT = 60;
const WINDOW_MS = 5 * 60 * 1000;
const hits = new Map();
r.use((req, res, next) => {
  const now = Date.now();
  const h = hits.get(req.ip);
  if (!h || now - h.start > WINDOW_MS) hits.set(req.ip, { start: now, n: 1 });
  else if (++h.n > LIMIT) return res.status(429).json({ error: 'Quá nhiều lượt truy cập, thử lại sau ít phút.' });
  if (hits.size > 10000) for (const [k, v] of hits) if (now - v.start > WINDOW_MS) hits.delete(k);
  res.set({ 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow', 'Referrer-Policy': 'no-referrer' });
  next();
});

const find = (token) => {
  const t = String(token).toLowerCase();
  const w = TOKEN_RE.test(t) && db.prepare('SELECT * FROM weapons WHERE public_token = ?').get(t);
  if (!w) throw new HttpError(404, 'Tem QR không hợp lệ hoặc đã hết hiệu lực.');
  return w;
};

// GET /api/public/w/:token
r.get('/w/:token', ah((req, res) => {
  const w = find(req.params.token);
  res.json({
    code: w.code,
    name: w.name,
    type: w.type,
    serial: w.serial,
    unit: w.unit,
    responsible: w.responsible,
    status: w.retired_at ? 'Đã thanh lý' : w.status,
    last: w.last_maint,
    next: w.next_maint,
    retired: !!w.retired_at,
    hasPhoto: !!w.photo,
  });
}));

// GET /api/public/w/:token/photo
r.get('/w/:token/photo', ah((req, res) => {
  const w = find(req.params.token);
  const file = w.photo && path.join(UPLOAD_DIR, path.basename(w.photo));
  if (!file || !fs.existsSync(file)) throw new HttpError(404, 'Chưa có ảnh.');
  res.sendFile(file);
}));

export default r;
