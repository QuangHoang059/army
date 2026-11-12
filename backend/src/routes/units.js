// Danh mục đơn vị quản lý vũ khí. Xem: mọi người đã đăng nhập. Thêm / đổi tên / xoá: admin.
import { Router } from 'express';
import { db, findUnitRow } from '../db.js';
import { adminForWrites } from '../auth.js';
import { HttpError, ah, str } from '../utils.js';
import { audit } from '../audit.js';

const r = Router();
r.use(adminForWrites);

const SELECT = `SELECT t.id, t.name, (SELECT COUNT(*) FROM weapons w WHERE w.unit = t.name) AS count
                FROM units t`;
const getType = (id) => db.prepare(`${SELECT} WHERE t.id = ?`).get(Number(id));

const cleanName = (v, selfId) => {
  const name = str(v).normalize('NFC').replace(/\s+/g, ' ');
  if (!name) throw new HttpError(400, 'Nhập tên đơn vị.');
  if (name.length > 60) throw new HttpError(400, 'Tên đơn vị tối đa 60 ký tự.');
  const dup = findUnitRow(name);
  if (dup && dup.id !== selfId) throw new HttpError(409, `Đơn vị "${dup.name}" đã có trong danh mục.`);
  return name;
};
const dupError = (e) =>
  e?.code === 'SQLITE_CONSTRAINT_UNIQUE' ? new HttpError(409, 'Đơn vị này đã có trong danh mục.') : e;

// GET /api/units → [{ id, name, count }]
r.get('/', (req, res) => res.json(db.prepare(`${SELECT} ORDER BY t.id`).all()));

// POST /api/units { name }
r.post('/', ah((req, res) => {
  const name = cleanName(req.body?.name);
  try {
    const info = db.prepare('INSERT INTO units (name) VALUES (?)').run(name);
    audit(req.user, 'unit.create', name, `Thêm đơn vị "${name}"`);
    res.status(201).json(getType(info.lastInsertRowid));
  } catch (e) {
    throw dupError(e);
  }
}));

// PUT /api/units/:id { name } — đổi tên, cập nhật luôn các vũ khí đang thuộc đơn vị này
r.put('/:id', ah((req, res) => {
  const cur = getType(req.params.id);
  if (!cur) throw new HttpError(404, 'Không tìm thấy đơn vị.');
  const name = cleanName(req.body?.name, cur.id);
  try {
    db.transaction(() => {
      db.prepare('UPDATE units SET name = ? WHERE id = ?').run(name, cur.id);
      db.prepare("UPDATE weapons SET unit = ?, updated_at = datetime('now') WHERE unit = ?").run(name, cur.name);
      if (name !== cur.name) audit(req.user, 'unit.rename', name, `Đổi tên đơn vị "${cur.name}" → "${name}" (${cur.count} vũ khí)`);
    })();
  } catch (e) {
    throw dupError(e);
  }
  res.json(getType(cur.id));
}));

// DELETE /api/units/:id — chỉ xoá được khi không còn vũ khí nào thuộc đơn vị này
r.delete('/:id', ah((req, res) => {
  const cur = getType(req.params.id);
  if (!cur) throw new HttpError(404, 'Không tìm thấy đơn vị.');
  if (cur.count > 0)
    throw new HttpError(409, `Còn ${cur.count} vũ khí thuộc đơn vị "${cur.name}" (kể cả đã thanh lý). Chuyển đơn vị cho các vũ khí đó trước khi xoá.`);
  db.prepare('DELETE FROM units WHERE id = ?').run(cur.id);
  audit(req.user, 'unit.delete', cur.name, `Xoá đơn vị "${cur.name}"`);

  res.status(204).end();
}));

export default r;
