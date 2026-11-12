import express, { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { db, UPLOAD_DIR, removePhoto, findWeaponType, weaponTypeNames, findUnitRow, unitNames, mapWeapon, mapMaint, mapLoan, MAINT_SELECT, LOAN_SELECT } from '../db.js';
import { MAINT_INTERVAL_DAYS, WEAPON_STATUSES } from '../constants.js';
import { adminForWrites, loginRedirect } from '../auth.js';
import { audit, diff } from '../audit.js';
import { addDays, todayStr, isDate, HttpError, str, ah } from '../utils.js';

const r = Router();

export const CODE_RE = /^QRCB-\d{3,}$/;

// Tìm theo mã QR / số hiệu trước (số hiệu có thể toàn chữ số, vd 200174), không thấy mới thử theo id.
const findByIdOrCode = (key) => {
  const k = String(key).trim();
  const w = db
    .prepare('SELECT * FROM weapons WHERE upper(code) = upper(?) OR upper(serial) = upper(?) OR public_token = lower(?)')
    .get(k, k, k);
  if (w || !/^\d+$/.test(k)) return w;
  return db.prepare('SELECT * FROM weapons WHERE id = ?').get(Number(k));
};

// GET /api/weapons/:key/photo — link cố định in trên tem QR, chuyển tới file ảnh hiện tại
// (đổi ảnh không cần in lại tem). Chưa đăng nhập → chuyển sang trang đăng nhập rồi quay lại.
r.get('/:key/photo', loginRedirect, ah((req, res) => {
  const cur = findByIdOrCode(req.params.key);
  if (!cur) throw new HttpError(404, 'Không tìm thấy vũ khí.');
  if (!cur.photo) throw new HttpError(404, 'Vũ khí này chưa có ảnh minh hoạ.');
  res.set('Cache-Control', 'no-store').redirect(302, `/api/uploads/${cur.photo}`);
}));

// Còn lại: xem cần đăng nhập, thêm / sửa / xoá / đổi ảnh chỉ admin.
r.use(adminForWrites);

function validateWeapon(body, { partial = false, currentUnit } = {}) {
  const out = {};
  const fields = ['code', 'name', 'serial', 'type', 'unit', 'responsible', 'status', 'last', 'next'];
  for (const f of fields) if (body[f] !== undefined) out[f] = str(body[f]);

  if (!partial) {
    if (!out.name) throw new HttpError(400, 'Thiếu tên vũ khí.');
    if (!out.serial) throw new HttpError(400, 'Thiếu số hiệu súng.');
    if (!out.responsible) throw new HttpError(400, 'Thiếu người chịu trách nhiệm.');
  }
  if (out.type !== undefined) {
    out.type = findWeaponType(out.type); // chuẩn hoá theo đúng tên trong danh mục
    if (!out.type) throw new HttpError(400, 'Loại vũ khí không có trong danh mục. Admin thêm loại ở trang "Loại trang bị".');
  }
  // Đơn vị phải có trong danh mục; riêng khi sửa thì cho giữ nguyên đơn vị cũ (kể cả đã bị xoá khỏi danh mục)
  if (out.unit !== undefined && out.unit !== currentUnit) {
    out.unit = findUnitRow(out.unit)?.name;
    if (!out.unit) throw new HttpError(400, 'Đơn vị không có trong danh mục. Admin thêm đơn vị ở trang "Đơn vị quản lý".');
  }
  if (out.status !== undefined && !WEAPON_STATUSES.includes(out.status)) throw new HttpError(400, 'Tình trạng không hợp lệ.');

  if (out.last !== undefined && !isDate(out.last)) throw new HttpError(400, 'Ngày bảo dưỡng gần nhất không hợp lệ.');
  if (out.next !== undefined && out.next !== '' && !isDate(out.next)) throw new HttpError(400, 'Ngày bảo dưỡng tiếp theo không hợp lệ.');
  if (out.code !== undefined) {
    out.code = out.code.toUpperCase();
    if (out.code && !CODE_RE.test(out.code))
      throw new HttpError(400, 'Mã QR phải có dạng QRCB-xxx (ví dụ QRCB-037), hoặc để trống để tự tạo.');
  }
  if (out.serial !== undefined) out.serial = out.serial.toUpperCase();
  return out;
}

/** Vũ khí đã thanh lý thì không sửa / ghi phiếu được (khôi phục trước). */
export function assertActive(w) {
  if (w.retired_at) throw new HttpError(409, `${w.name} (${w.serial}) đã thanh lý — admin khôi phục trước khi thao tác.`);
}

const NO_MANUAL_LOAN = 'Không đặt tay tình trạng "Đang mượn" — hãy lập phiếu ở trang Bàn giao / Mượn - Trả.';

const FIELD_LABEL = {
  code: 'Mã QR', name: 'Tên', serial: 'Số hiệu', type: 'Loại', unit: 'Đơn vị',
  responsible: 'Người phụ trách', status: 'Tình trạng', last: 'BD gần nhất', next: 'BD tiếp theo',
};
const describe = (changes) =>
  Object.entries(changes).map(([f, [a, b]]) => `${FIELD_LABEL[f] || f}: ${a ?? '—'} → ${b ?? '—'}`).join('; ');

const historyCount = (id) =>
  db.prepare('SELECT (SELECT COUNT(*) FROM maintenance WHERE weapon_id = ?) + (SELECT COUNT(*) FROM loans WHERE weapon_id = ?) AS n')
    .get(id, id).n;

function nextCode() {
  const row = db.prepare("SELECT code FROM weapons WHERE code LIKE 'QRCB-%' ORDER BY CAST(substr(code, 6) AS INTEGER) DESC LIMIT 1").get();
  const n = row ? parseInt(row.code.slice(5), 10) + 1 : 1;
  return `QRCB-${String(n).padStart(3, '0')}`;
}

function uniqueError(e) {
  if (e && e.code === 'SQLITE_CONSTRAINT_UNIQUE') {
    if (e.message.includes('weapons.code')) return new HttpError(409, 'Mã QR đã tồn tại.');
    if (e.message.includes('weapons.serial')) return new HttpError(409, 'Số hiệu súng đã tồn tại.');
  }
  return e;
}

// GET /api/weapons?q=&unit=&status=&retired=0|1|all  (mặc định chỉ vũ khí đang dùng)
r.get('/', ah((req, res) => {
  const where = [];
  const retired = String(req.query.retired || '0');
  if (retired === '1') where.push('retired_at IS NOT NULL');
  else if (retired !== 'all') where.push('retired_at IS NULL');
  const params = {};
  const q = str(req.query.q);
  if (q) {
    where.push('(name LIKE @q OR serial LIKE @q OR code LIKE @q OR responsible LIKE @q)');
    params.q = `%${q}%`;
  }
  if (req.query.unit && req.query.unit !== 'Tất cả') { where.push('unit = @unit'); params.unit = req.query.unit; }
  if (req.query.status && req.query.status !== 'Tất cả') { where.push('status = @status'); params.status = req.query.status; }
  const sql = `SELECT * FROM weapons ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY code`;
  res.json(db.prepare(sql).all(params).map(mapWeapon));
}));

// GET /api/weapons/:key  (id, mã QR hoặc số hiệu) — kèm lịch sử bảo dưỡng & mượn trả
r.get('/:key', ah((req, res) => {
  const w = findByIdOrCode(req.params.key);
  if (!w) throw new HttpError(404, 'Không tìm thấy mã này. Kiểm tra lại mã QRCB-xxx hoặc số hiệu VN-xxx.');
  const historyN = historyCount(w.id);
  const maintenance = db.prepare(`${MAINT_SELECT} WHERE m.weapon_id = ? ORDER BY m.date DESC, m.id DESC`).all(w.id).map(mapMaint);
  const loans = db.prepare(`${LOAN_SELECT} WHERE l.weapon_id = ? ORDER BY l.borrow_at DESC, l.id DESC`).all(w.id).map(mapLoan);
  res.json({ ...mapWeapon(w), maintenance, loans, deletable: historyN === 0 && w.status !== 'Đang mượn' });
}));

// POST /api/weapons
r.post('/', ah((req, res) => {
  const v = validateWeapon(req.body || {});
  if (v.status === 'Đang mượn') throw new HttpError(409, NO_MANUAL_LOAN);
  if (!v.unit && !unitNames().length) throw new HttpError(400, 'Chưa có đơn vị nào. Admin thêm đơn vị ở trang "Đơn vị quản lý".');

  const last = v.last || todayStr();
  const row = {
    code: v.code || nextCode(),
    name: v.name,
    serial: v.serial,
    type: v.type || weaponTypeNames()[0] || 'Khác',
    unit: v.unit || unitNames()[0],
    responsible: v.responsible,
    status: v.status || 'Tốt',
    last,
    next: addDays(last, MAINT_INTERVAL_DAYS),
  };
  try {
    const id = db.transaction(() => {
      const info = db.prepare(`INSERT INTO weapons (code,name,serial,type,unit,responsible,status,last_maint,next_maint)
        VALUES (@code,@name,@serial,@type,@unit,@responsible,@status,@last,@next)`).run(row);
      audit(req.user, 'weapon.create', row.code, `Thêm ${row.name} — ${row.serial} (${row.type}, ${row.unit})`);
      return info.lastInsertRowid;
    })();
    res.status(201).json(mapWeapon(db.prepare('SELECT * FROM weapons WHERE id = ?').get(id)));
  } catch (e) {
    throw uniqueError(e);
  }
}));

// PUT /api/weapons/:id
r.put('/:id', ah((req, res) => {
  const cur = findByIdOrCode(req.params.id);
  if (!cur) throw new HttpError(404, 'Không tìm thấy vũ khí.');
  assertActive(cur);
  const v = validateWeapon(req.body || {}, { partial: true, currentUnit: cur.unit });
  if (v.status !== undefined && v.status !== cur.status) {
    if (cur.status === 'Đang mượn')
      throw new HttpError(409, `${cur.name} (${cur.serial}) đang được mượn — ghi trả ở trang Bàn giao / Mượn - Trả để đổi tình trạng.`);
    if (v.status === 'Đang mượn') throw new HttpError(409, NO_MANUAL_LOAN);
  }
  for (const f of ['name', 'serial', 'responsible', 'code'])
    if (v[f] !== undefined && !v[f]) throw new HttpError(400, `Trường ${f} không được để trống.`);
  const merged = {
    id: cur.id,
    code: v.code ?? cur.code,
    name: v.name ?? cur.name,
    serial: v.serial ?? cur.serial,
    type: v.type ?? cur.type,
    unit: v.unit ?? cur.unit,
    responsible: v.responsible ?? cur.responsible,
    status: v.status ?? cur.status,
    last: v.last ?? cur.last_maint,
  };
  // Khi đổi ngày bảo dưỡng gần nhất -> tự tính lại hạn tiếp theo (trừ khi gửi rõ `next`)
  merged.next = v.next || (v.last ? addDays(v.last, MAINT_INTERVAL_DAYS) : cur.next_maint);
  const before = { ...cur, last: cur.last_maint, next: cur.next_maint };
  const changes = diff(before, merged, Object.keys(FIELD_LABEL));
  if (!Object.keys(changes).length) return res.json(mapWeapon(cur));
  try {
    db.transaction(() => {
      db.prepare(`UPDATE weapons SET code=@code,name=@name,serial=@serial,type=@type,unit=@unit,responsible=@responsible,
        status=@status,last_maint=@last,next_maint=@next,updated_at=datetime('now') WHERE id=@id`).run(merged);
      const onlyStatus = Object.keys(changes).length === 1 && changes.status;
      audit(req.user, onlyStatus ? 'weapon.status' : 'weapon.update', merged.code, `${cur.code}: ${describe(changes)}`, changes);
    })();
  } catch (e) {
    throw uniqueError(e);
  }
  res.json(mapWeapon(db.prepare('SELECT * FROM weapons WHERE id = ?').get(cur.id)));
}));

// POST /api/weapons/:id/retire { reason } — thanh lý / ngừng sử dụng: ẩn khỏi danh sách, GIỮ lịch sử
r.post('/:id/retire', ah((req, res) => {
  const cur = findByIdOrCode(req.params.id);
  if (!cur) throw new HttpError(404, 'Không tìm thấy vũ khí.');
  if (cur.retired_at) throw new HttpError(409, 'Vũ khí này đã thanh lý.');
  if (cur.status === 'Đang mượn') throw new HttpError(409, 'Vũ khí đang được mượn — ghi trả trước khi thanh lý.');
  const reason = str(req.body?.reason);
  if (!reason) throw new HttpError(400, 'Nhập lý do thanh lý / ngừng sử dụng.');
  if (reason.length > 200) throw new HttpError(400, 'Lý do tối đa 200 ký tự.');
  db.transaction(() => {
    db.prepare("UPDATE weapons SET retired_at = ?, retired_reason = ?, updated_at = datetime('now') WHERE id = ?")
      .run(todayStr(), reason, cur.id);
    audit(req.user, 'weapon.retire', cur.code, `Thanh lý ${cur.name} — ${cur.serial}. Lý do: ${reason}`);
  })();
  res.json(mapWeapon(db.prepare('SELECT * FROM weapons WHERE id = ?').get(cur.id)));
}));

// POST /api/weapons/:id/restore — đưa vũ khí đã thanh lý trở lại sử dụng
r.post('/:id/restore', ah((req, res) => {
  const cur = findByIdOrCode(req.params.id);
  if (!cur) throw new HttpError(404, 'Không tìm thấy vũ khí.');
  if (!cur.retired_at) throw new HttpError(409, 'Vũ khí này đang sử dụng, không cần khôi phục.');
  db.transaction(() => {
    db.prepare("UPDATE weapons SET retired_at = NULL, retired_reason = NULL, updated_at = datetime('now') WHERE id = ?").run(cur.id);
    audit(req.user, 'weapon.restore', cur.code, `Khôi phục ${cur.name} — ${cur.serial} trở lại sử dụng`);
  })();
  res.json(mapWeapon(db.prepare('SELECT * FROM weapons WHERE id = ?').get(cur.id)));
}));

// POST /api/weapons/:id/public-token — cấp link tem mới (tem cũ bị mất / lộ → link cũ hết hiệu lực)
r.post('/:id/public-token', ah((req, res) => {
  const cur = findByIdOrCode(req.params.id);
  if (!cur) throw new HttpError(404, 'Không tìm thấy vũ khí.');
  db.transaction(() => {
    db.prepare("UPDATE weapons SET public_token = lower(hex(randomblob(12))), updated_at = datetime('now') WHERE id = ?").run(cur.id);
    audit(req.user, 'weapon.update', cur.code, `${cur.code}: cấp link tem QR mới (link cũ hết hiệu lực)`);
  })();
  res.json(mapWeapon(db.prepare('SELECT * FROM weapons WHERE id = ?').get(cur.id)));
}));

// DELETE /api/weapons/:id — xoá hẳn, CHỈ khi chưa có phiếu bảo dưỡng / mượn nào (vd nhập nhầm).
// Đã có lịch sử thì phải dùng thanh lý để giữ sổ sách.
r.delete('/:id', ah((req, res) => {
  const cur = findByIdOrCode(req.params.id);
  if (!cur) throw new HttpError(404, 'Không tìm thấy vũ khí.');
  if (cur.status === 'Đang mượn') throw new HttpError(409, 'Vũ khí đang được mượn, không thể xoá.');
  const n = historyCount(cur.id);
  if (n > 0)
    throw new HttpError(409, `${cur.code} đã có ${n} phiếu bảo dưỡng / mượn — không xoá hẳn được, hãy dùng "Thanh lý" để giữ lịch sử.`);
  db.transaction(() => {
    db.prepare('DELETE FROM weapons WHERE id = ?').run(cur.id);
    audit(req.user, 'weapon.delete', cur.code, `Xoá hẳn ${cur.name} — ${cur.serial} (chưa có lịch sử)`);
  })();
  removePhoto(cur.photo);
  res.status(204).end();
}));

// ---- Ảnh minh hoạ ----
// PUT /api/weapons/:id/photo  — body là file ảnh nhị phân (Content-Type: image/jpeg | image/png | image/webp)
const PHOTO_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const isImage = (b) =>
  (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) || // JPEG
  (b[0] === 0x89 && b.toString('ascii', 1, 4) === 'PNG') || // PNG
  (b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP'); // WEBP

r.put(
  '/:id/photo',
  express.raw({ type: Object.keys(PHOTO_TYPES), limit: '8mb' }),
  ah((req, res) => {
    const cur = findByIdOrCode(req.params.id);
    if (!cur) throw new HttpError(404, 'Không tìm thấy vũ khí.');
    const ext = PHOTO_TYPES[req.headers['content-type']?.split(';')[0].trim()];
    if (!ext || !Buffer.isBuffer(req.body) || req.body.length < 12 || !isImage(req.body))
      throw new HttpError(400, 'Chỉ nhận ảnh JPG, PNG hoặc WEBP.');
    const name = `w${cur.id}-${Date.now()}.${ext}`;
    fs.writeFileSync(path.join(UPLOAD_DIR, name), req.body);
    db.prepare("UPDATE weapons SET photo = ?, updated_at = datetime('now') WHERE id = ?").run(name, cur.id);
    audit(req.user, 'weapon.photo', cur.code, `${cur.code}: ${cur.photo ? 'đổi' : 'thêm'} ảnh minh hoạ`);
    removePhoto(cur.photo);
    res.json(mapWeapon(db.prepare('SELECT * FROM weapons WHERE id = ?').get(cur.id)));
  }),
);

// DELETE /api/weapons/:id/photo
r.delete('/:id/photo', ah((req, res) => {
  const cur = findByIdOrCode(req.params.id);
  if (!cur) throw new HttpError(404, 'Không tìm thấy vũ khí.');
  db.prepare("UPDATE weapons SET photo = NULL, updated_at = datetime('now') WHERE id = ?").run(cur.id);
  if (cur.photo) audit(req.user, 'weapon.photo', cur.code, `${cur.code}: xoá ảnh minh hoạ`);

  removePhoto(cur.photo);
  res.json(mapWeapon(db.prepare('SELECT * FROM weapons WHERE id = ?').get(cur.id)));
}));

export default r;
