import { Router } from 'express';
import { db, mapMaint, MAINT_SELECT } from '../db.js';
import { MAINT_INTERVAL_DAYS, MAINT_RESULTS } from '../constants.js';
import { addDays, isDate, HttpError, str, ah } from '../utils.js';
import { assertActive } from './weapons.js';
import { actorName, audit } from '../audit.js';

const r = Router();

// GET /api/maintenance?weapon=QRCB-001
r.get('/', ah((req, res) => {
  const code = str(req.query.weapon);
  const rows = code
    ? db.prepare(`${MAINT_SELECT} WHERE w.code = ? ORDER BY m.date DESC, m.id DESC`).all(code.toUpperCase())
    : db.prepare(`${MAINT_SELECT} ORDER BY m.date DESC, m.id DESC`).all();
  res.json(rows.map(mapMaint));
}));

// POST /api/maintenance  { weaponCode, date, content, worker, result }
// Ghi phiếu + cập nhật ngày bảo dưỡng của vũ khí (hạn tiếp theo = ngày + 30) trong 1 transaction.
r.post('/', ah((req, res) => {
  const b = req.body || {};
  const weaponCode = str(b.weaponCode).toUpperCase();
  const date = str(b.date);
  const content = str(b.content);
  const worker = str(b.worker);
  const result = str(b.result) || 'Đạt';

  if (!weaponCode || !content || !worker) throw new HttpError(400, 'Chọn vũ khí, nhập nội dung và người làm.');
  if (!isDate(date)) throw new HttpError(400, 'Ngày bảo dưỡng không hợp lệ.');
  if (!MAINT_RESULTS.includes(result)) throw new HttpError(400, 'Kết quả không hợp lệ.');

  const w = db.prepare('SELECT * FROM weapons WHERE code = ?').get(weaponCode);
  if (!w) throw new HttpError(404, 'Không tìm thấy vũ khí.');
  assertActive(w);

  const nextDate = addDays(date, MAINT_INTERVAL_DAYS);

  const id = db.transaction(() => {
    const info = db.prepare(`INSERT INTO maintenance (weapon_id,date,content,worker,result,next_date,recorded_by)
      VALUES (?,?,?,?,?,?,?)`).run(w.id, date, content, worker, result, nextDate, actorName(req.user));
    audit(req.user, 'maint.create', w.code, `${w.code}: bảo dưỡng ngày ${date} — ${content} (người làm: ${worker}, kết quả: ${result})`);


    // Kết quả "Đạt" -> vũ khí trở lại "Tốt" (trừ khi đang có người mượn).
    const status = result === 'Đạt' && w.status !== 'Đang mượn' ? 'Tốt' : w.status;
    db.prepare(`UPDATE weapons SET last_maint=?, next_maint=?, status=?, updated_at=datetime('now') WHERE id=?`)
      .run(date, nextDate, status, w.id);
    return info.lastInsertRowid;
  })();

  res.status(201).json(mapMaint(db.prepare(`${MAINT_SELECT} WHERE m.id = ?`).get(id)));
}));

export default r;
