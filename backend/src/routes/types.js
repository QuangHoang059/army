// Danh mục loại vũ khí - trang bị. Xem: mọi người đã đăng nhập. Thêm / đổi tên / xoá: admin.
import { Router } from 'express';
import { db, findWeaponTypeRow } from '../db.js';
import { adminForWrites } from '../auth.js';
import { HttpError, ah, str } from '../utils.js';
import { audit } from '../audit.js';

const r = Router();
r.use(adminForWrites);

const SELECT = `SELECT t.id, t.name, (SELECT COUNT(*) FROM weapons w WHERE w.type = t.name) AS count
                FROM weapon_types t`;
const getType = (id) => db.prepare(`${SELECT} WHERE t.id = ?`).get(Number(id));

const cleanName = (v, selfId) => {
  const name = str(v).normalize('NFC').replace(/\s+/g, ' ');
  if (!name) throw new HttpError(400, 'Nhập tên loại.');
  if (name.length > 60) throw new HttpError(400, 'Tên loại tối đa 60 ký tự.');
  const dup = findWeaponTypeRow(name);
  if (dup && dup.id !== selfId) throw new HttpError(409, `Loại "${dup.name}" đã có trong danh mục.`);
  return name;
};
const dupError = (e) =>
  e?.code === 'SQLITE_CONSTRAINT_UNIQUE' ? new HttpError(409, 'Loại này đã có trong danh mục.') : e;

// GET /api/weapon-types → [{ id, name, count }]
r.get('/', (req, res) => res.json(db.prepare(`${SELECT} ORDER BY t.id`).all()));

// POST /api/weapon-types { name }
r.post('/', ah((req, res) => {
  const name = cleanName(req.body?.name);
  try {
    const info = db.prepare('INSERT INTO weapon_types (name) VALUES (?)').run(name);
    audit(req.user, 'type.create', name, `Thêm loại "${name}"`);
    res.status(201).json(getType(info.lastInsertRowid));
  } catch (e) {
    throw dupError(e);
  }
}));

// PUT /api/weapon-types/:id { name } — đổi tên, cập nhật luôn các vũ khí đang dùng loại này
r.put('/:id', ah((req, res) => {
  const cur = getType(req.params.id);
  if (!cur) throw new HttpError(404, 'Không tìm thấy loại.');
  const name = cleanName(req.body?.name, cur.id);
  try {
    db.transaction(() => {
      db.prepare('UPDATE weapon_types SET name = ? WHERE id = ?').run(name, cur.id);
      db.prepare("UPDATE weapons SET type = ?, updated_at = datetime('now') WHERE type = ?").run(name, cur.name);
      if (name !== cur.name) audit(req.user, 'type.rename', name, `Đổi tên loại "${cur.name}" → "${name}" (${cur.count} vũ khí)`);
    })();
  } catch (e) {
    throw dupError(e);
  }
  res.json(getType(cur.id));
}));

// DELETE /api/weapon-types/:id — chỉ xoá được khi không còn vũ khí nào thuộc loại này
r.delete('/:id', ah((req, res) => {
  const cur = getType(req.params.id);
  if (!cur) throw new HttpError(404, 'Không tìm thấy loại.');
  if (cur.count > 0)
    throw new HttpError(409, `Còn ${cur.count} vũ khí thuộc loại "${cur.name}". Đổi loại cho các vũ khí đó trước khi xoá.`);
  db.prepare('DELETE FROM weapon_types WHERE id = ?').run(cur.id);
  audit(req.user, 'type.delete', cur.name, `Xoá loại "${cur.name}"`);

  res.status(204).end();
}));

export default r;
