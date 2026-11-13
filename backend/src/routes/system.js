// Nhật ký thao tác + sao lưu — chỉ admin (đã chặn bằng requireAdmin ở server.js).
import { Router } from 'express';
import path from 'node:path';
import { db } from '../db.js';
import { audit } from '../audit.js';
import { BACKUP_DIR, backupNow, listBackups } from '../backup.js';
import { encryptBackupDir } from '../backup-crypto.js';
import { HttpError } from '../utils.js';
import { ah, str } from '../utils.js';

const r = Router();

// GET /api/audit?q=&action=weapon&before=<id>&limit=100 → { items, more }
r.get('/audit', ah((req, res) => {
  const where = [];
  const params = [];
  const q = str(req.query.q);
  if (q) {
    where.push('(summary LIKE ? OR actor LIKE ? OR entity LIKE ?)');
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  const action = str(req.query.action);
  if (action) {
    where.push("(action = ? OR action LIKE ? || '.%')");
    params.push(action, action);
  }
  const before = Number(req.query.before);
  if (before > 0) {
    where.push('id < ?');
    params.push(before);
  }
  const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
  const rows = db
    .prepare(`SELECT * FROM audit_log ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY id DESC LIMIT ?`)
    .all(...params, limit + 1);
  res.json({
    more: rows.length > limit,
    items: rows.slice(0, limit).map((a) => ({
      id: a.id,
      at: a.at.replace(' ', 'T') + 'Z',
      actor: a.actor,
      action: a.action,
      entity: a.entity,
      summary: a.summary,
      detail: a.detail ? JSON.parse(a.detail) : null,
    })),
  });
}));

// GET /api/backups → { dir, items }
r.get('/backups', (req, res) => res.json({ dir: BACKUP_DIR, items: listBackups() }));

// POST /api/backups — sao lưu ngay
r.post('/backups', ah(async (req, res) => {
  const b = await backupNow('manual');
  audit(req.user, 'backup.create', b.name, `Sao lưu dữ liệu: ${path.join(BACKUP_DIR, b.name)}`);
  res.status(201).json(b);
}));

// POST /api/backups/:name/export { password } → tải file .vkbak đã mã hoá AES-256 (chép USB / nộp cấp trên)
r.post('/backups/:name/export', ah(async (req, res) => {
  const b = listBackups().find((x) => x.name === req.params.name);
  if (!b) throw new HttpError(404, 'Không tìm thấy bản sao lưu.');
  let buf;
  try {
    buf = encryptBackupDir(path.join(BACKUP_DIR, b.name), str(req.body?.password));
  } catch (e) {
    throw new HttpError(400, e.message);
  }
  audit(req.user, 'backup.export', b.name, `Tải bản sao lưu mã hoá ${b.name}.vkbak`);
  res
    .set('Content-Type', 'application/octet-stream')
    .set('Content-Disposition', `attachment; filename="VKTB_${b.name}.vkbak"`)
    .set('Cache-Control', 'no-store')
    .send(buf);
}));

export default r;
