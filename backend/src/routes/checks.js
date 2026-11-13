// Kiểm đếm vũ khí bằng quét QR.
// Bắt đầu 1 đợt → chụp danh sách vũ khí đang quản lý (theo đơn vị nếu chọn) → quét tem từng khẩu (hoặc tick tay)
// → kết thúc: lưu kết quả có / thiếu / đang mượn vào nhật ký.
import { Router } from 'express';
import { db } from '../db.js';
import { actorName, audit } from '../audit.js';
import { requireAdmin } from '../auth.js';
import { HttpError, nowLocal, str, ah } from '../utils.js';

const r = Router();

const ITEM_SELECT = `
  SELECT ci.*, w.code, w.name, w.serial, w.type, w.unit, w.responsible, w.status
  FROM check_items ci JOIN weapons w ON w.id = ci.weapon_id`;

const mapItem = (x) => ({
  weaponId: x.weapon_id,
  code: x.code,
  name: x.name,
  serial: x.serial,
  type: x.type,
  unit: x.unit,
  responsible: x.responsible,
  status: x.status,
  statusAtStart: x.status_at_start,
  checkedAt: x.checked_at || null,
  method: x.method || null,
  checkedBy: x.checked_by || null,
});

function summary(id) {
  const c = db.prepare('SELECT * FROM checks WHERE id = ?').get(id);
  if (!c) return null;
  const n = db
    .prepare(
      `SELECT COUNT(*) total,
              SUM(checked_at IS NOT NULL) checked,
              SUM(checked_at IS NULL AND status_at_start = 'Đang mượn') borrowed
       FROM check_items WHERE check_id = ?`,
    )
    .get(id);
  const total = n.total || 0;
  const checked = n.checked || 0;
  const borrowed = n.borrowed || 0;
  return {
    id: c.id,
    note: c.note,
    unit: c.unit,
    startedAt: c.started_at,
    finishedAt: c.finished_at || null,
    startedBy: c.started_by,
    finishedBy: c.finished_by || null,
    total,
    checked,
    borrowed, // chưa quét nhưng đang cho mượn (có phiếu) → không tính thiếu
    missing: total - checked - borrowed,
  };
}

const getOpen = (id) => {
  const c = summary(id);
  if (!c) throw new HttpError(404, 'Không tìm thấy đợt kiểm đếm.');
  return c;
};

// GET /api/checks — các đợt kiểm đếm gần nhất
r.get('/', ah((req, res) => {
  const ids = db.prepare('SELECT id FROM checks ORDER BY id DESC LIMIT 50').pluck().all();
  res.json(ids.map(summary));
}));

// POST /api/checks { unit?, note? } — bắt đầu đợt mới (mỗi lúc chỉ 1 đợt đang mở)
r.post('/', ah((req, res) => {
  const unit = str(req.body?.unit);
  const note = str(req.body?.note).slice(0, 200);
  const id = db.transaction(() => {
    const open = db.prepare('SELECT id FROM checks WHERE finished_at IS NULL').pluck().get();
    if (open) throw new HttpError(409, `Đang có đợt kiểm đếm #${open} chưa kết thúc — mở tiếp hoặc kết thúc đợt đó trước.`);
    const weapons = db
      .prepare(`SELECT id, status FROM weapons WHERE retired_at IS NULL ${unit ? 'AND unit = ?' : ''} ORDER BY code`)
      .all(...(unit ? [unit] : []));
    if (!weapons.length) throw new HttpError(400, 'Không có vũ khí nào để kiểm đếm.');
    const cid = db
      .prepare('INSERT INTO checks (note, unit, started_at, started_by) VALUES (?,?,?,?)')
      .run(note, unit, nowLocal(), actorName(req.user)).lastInsertRowid;
    const ins = db.prepare('INSERT INTO check_items (check_id, weapon_id, status_at_start) VALUES (?,?,?)');
    for (const w of weapons) ins.run(cid, w.id, w.status);
    audit(req.user, 'check.start', `#${cid}`, `Bắt đầu kiểm đếm #${cid}${unit ? ` (${unit})` : ''}: ${weapons.length} vũ khí`);
    return cid;
  })();
  res.status(201).json(summary(id));
}));

// GET /api/checks/:id — chi tiết + danh sách từng khẩu
r.get('/:id', ah((req, res) => {
  const c = getOpen(Number(req.params.id));
  const items = db.prepare(`${ITEM_SELECT} WHERE ci.check_id = ? ORDER BY w.code`).all(c.id).map(mapItem);
  res.json({ ...c, items });
}));

/** Nội dung tem: link .../w/<mã bí mật>, hoặc QRCB-xxx, hoặc số hiệu. */
function findWeapon(raw) {
  const t = str(raw);
  const token = /\/w\/([0-9a-f]{24})\b/i.exec(t)?.[1];
  if (token) return db.prepare('SELECT id, code FROM weapons WHERE public_token = ?').get(token.toLowerCase());
  const code = /QRCB-\d+/i.exec(t)?.[0] || t;
  return db
    .prepare('SELECT id, code FROM weapons WHERE upper(code) = upper(?) OR upper(serial) = upper(?) OR public_token = lower(?)')
    .get(code, code, code);
}

// POST /api/checks/:id/scan { key, method: 'qr' | 'tay' } → { item, already }
r.post('/:id/scan', ah((req, res) => {
  const c = getOpen(Number(req.params.id));
  if (c.finishedAt) throw new HttpError(409, 'Đợt kiểm đếm này đã kết thúc.');
  const method = req.body?.method === 'tay' ? 'tay' : 'qr';
  const w = findWeapon(req.body?.key);
  if (!w) throw new HttpError(404, 'Mã quét được không khớp vũ khí nào trong hệ thống.');
  const row = db.prepare('SELECT * FROM check_items WHERE check_id = ? AND weapon_id = ?').get(c.id, w.id);
  if (!row) throw new HttpError(409, `${w.code} không thuộc danh sách của đợt kiểm đếm này (khác đơn vị hoặc đã thanh lý).`);
  const already = !!row.checked_at;
  if (!already)
    db.prepare('UPDATE check_items SET checked_at = ?, method = ?, checked_by = ? WHERE check_id = ? AND weapon_id = ?')
      .run(nowLocal(), method, actorName(req.user), c.id, w.id);
  const item = mapItem(db.prepare(`${ITEM_SELECT} WHERE ci.check_id = ? AND ci.weapon_id = ?`).get(c.id, w.id));
  res.json({ item, already });
}));

// POST /api/checks/:id/uncheck { weaponId } — bỏ đánh dấu (tick nhầm)
r.post('/:id/uncheck', ah((req, res) => {
  const c = getOpen(Number(req.params.id));
  if (c.finishedAt) throw new HttpError(409, 'Đợt kiểm đếm này đã kết thúc.');
  db.prepare('UPDATE check_items SET checked_at = NULL, method = NULL, checked_by = NULL WHERE check_id = ? AND weapon_id = ?')
    .run(c.id, Number(req.body?.weaponId));
  res.json({ ok: true });
}));

// POST /api/checks/:id/finish — kết thúc, ghi kết quả vào nhật ký
r.post('/:id/finish', ah((req, res) => {
  const c = getOpen(Number(req.params.id));
  if (c.finishedAt) throw new HttpError(409, 'Đợt kiểm đếm này đã kết thúc.');
  db.prepare('UPDATE checks SET finished_at = ?, finished_by = ? WHERE id = ?').run(nowLocal(), actorName(req.user), c.id);
  const missingCodes = db
    .prepare(`${ITEM_SELECT} WHERE ci.check_id = ? AND ci.checked_at IS NULL AND ci.status_at_start <> 'Đang mượn' ORDER BY w.code`)
    .all(c.id)
    .map((x) => x.code);
  audit(
    req.user,
    'check.finish',
    `#${c.id}`,
    `Kết thúc kiểm đếm #${c.id}: có mặt ${c.checked}/${c.total}, đang mượn ${c.borrowed}, thiếu ${c.missing}` +
      (missingCodes.length ? ` (${missingCodes.slice(0, 20).join(', ')}${missingCodes.length > 20 ? '…' : ''})` : ''),
  );
  res.json(summary(c.id));
}));

// DELETE /api/checks/:id — admin xoá đợt kiểm đếm (vd tạo nhầm)
r.delete('/:id', requireAdmin, ah((req, res) => {
  const c = getOpen(Number(req.params.id));
  db.transaction(() => {
    db.prepare('DELETE FROM check_items WHERE check_id = ?').run(c.id);
    db.prepare('DELETE FROM checks WHERE id = ?').run(c.id);
  })();
  audit(req.user, 'check.delete', `#${c.id}`, `Xoá đợt kiểm đếm #${c.id} (${c.checked}/${c.total})`);
  res.status(204).end();
}));

export default r;
