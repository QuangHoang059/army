import { Router } from 'express';
import { db, mapLoan, LOAN_SELECT } from '../db.js';
import { LOAN_PURPOSES, GRADES, LOANABLE_STATUSES } from '../constants.js';
import { daysUntil, isDateTime, HttpError, str, ah } from '../utils.js';
import { assertActive } from './weapons.js';
import { actorName, audit } from '../audit.js';

/** Tình trạng vũ khí sau khi trả (người ghi trả chọn). */
export const RETURN_WEAPON_STATUSES = ['Tốt', 'Đang bảo dưỡng', ...GRADES];

const r = Router();

// GET /api/loans?status=Đang mượn&weapon=QRCB-007
r.get('/', ah((req, res) => {
  const where = [];
  const params = [];
  if (req.query.status) { where.push('l.status = ?'); params.push(req.query.status); }
  if (req.query.weapon) { where.push('w.code = ?'); params.push(String(req.query.weapon).toUpperCase()); }
  const sql = `${LOAN_SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY l.borrow_at DESC, l.id DESC`;
  res.json(db.prepare(sql).all(...params).map(mapLoan));
}));

// POST /api/loans  { weaponCode, borrower, purpose, borrowAt, dueAt? }  — dueAt: hẹn giờ trả, quá giờ → cảnh báo
r.post('/', ah((req, res) => {
  const b = req.body || {};
  const weaponCode = str(b.weaponCode).toUpperCase();
  const borrower = str(b.borrower);
  const purpose = str(b.purpose) || 'Gác';
  const borrowAt = str(b.borrowAt);
  const dueAt = str(b.dueAt);

  if (!weaponCode || !borrower) throw new HttpError(400, 'Chọn vũ khí và nhập người mượn.');
  if (!LOAN_PURPOSES.includes(purpose)) throw new HttpError(400, 'Mục đích không hợp lệ.');
  if (!isDateTime(borrowAt)) throw new HttpError(400, 'Giờ mượn không hợp lệ (YYYY-MM-DDTHH:MM).');
  if (dueAt && !isDateTime(dueAt)) throw new HttpError(400, 'Hẹn giờ trả không hợp lệ (YYYY-MM-DDTHH:MM).');
  if (dueAt && dueAt <= borrowAt) throw new HttpError(400, 'Hẹn giờ trả phải sau giờ mượn.');

  const id = db.transaction(() => {
    const w = db.prepare('SELECT * FROM weapons WHERE code = ?').get(weaponCode);
    if (!w) throw new HttpError(404, 'Không tìm thấy vũ khí.');
    assertActive(w);
    if (w.status === 'Đang mượn') throw new HttpError(409, `${w.name} (${w.serial}) đang được mượn.`);
    if (!LOANABLE_STATUSES.includes(w.status))
      throw new HttpError(409, `${w.name} (${w.serial}) đang ở tình trạng "${w.status}", không xuất kho (chỉ Tốt / Phân cấp 2).`);
    if (daysUntil(w.next_maint) < 0) throw new HttpError(409, `${w.name} (${w.serial}) quá hạn bảo dưỡng — không xuất kho.`);

    const info = db.prepare(`INSERT INTO loans (weapon_id,borrower,purpose,borrow_at,due_at,status,recorded_by) VALUES (?,?,?,?,?,'Đang mượn',?)`)
      .run(w.id, borrower, purpose, borrowAt, dueAt || null, actorName(req.user));
    db.prepare(`UPDATE weapons SET status='Đang mượn', updated_at=datetime('now') WHERE id=?`).run(w.id);
    audit(req.user, 'loan.create', w.code, `${w.code}: giao cho ${borrower} (${purpose}) lúc ${borrowAt.replace('T', ' ')}${dueAt ? `, hẹn trả ${dueAt.replace('T', ' ')}` : ''}`);
    return info.lastInsertRowid;
  })();

  res.status(201).json(mapLoan(db.prepare(`${LOAN_SELECT} WHERE l.id = ?`).get(id)));
}));

// POST /api/loans/:id/return  { returnAt, returnStatus, weaponStatus }
// weaponStatus: tình trạng vũ khí sau khi nhận lại (Tốt / Đang bảo dưỡng / Phân cấp 2–5) — cấp 3 trở xuống thì không cho mượn tiếp.
r.post('/:id/return', ah((req, res) => {
  const b = req.body || {};
  const returnAt = str(b.returnAt);
  const returnStatus = str(b.returnStatus) || 'Tốt, đủ phụ kiện';
  if (!isDateTime(returnAt)) throw new HttpError(400, 'Giờ trả không hợp lệ (YYYY-MM-DDTHH:MM).');
  const weaponStatus = str(b.weaponStatus) || 'Tốt';
  if (!RETURN_WEAPON_STATUSES.includes(weaponStatus))
    throw new HttpError(400, 'Tình trạng vũ khí sau khi trả phải là Tốt, Đang bảo dưỡng hoặc Phân cấp 2–5.');

  const id = Number(req.params.id);
  db.transaction(() => {
    const loan = db.prepare('SELECT * FROM loans WHERE id = ?').get(id);
    if (!loan) throw new HttpError(404, 'Không tìm thấy phiếu mượn.');
    if (loan.status === 'Đã trả') throw new HttpError(409, 'Phiếu này đã được ghi trả.');
    if (returnAt < loan.borrow_at) throw new HttpError(400, 'Giờ trả phải sau giờ mượn.');

    db.prepare(`UPDATE loans SET status='Đã trả', return_at=?, return_status=?, returned_by=? WHERE id=?`)
      .run(returnAt, returnStatus, actorName(req.user), id);
    db.prepare(`UPDATE weapons SET status=?, updated_at=datetime('now') WHERE id=?`).run(weaponStatus, loan.weapon_id);
    const code = db.prepare('SELECT code FROM weapons WHERE id = ?').pluck().get(loan.weapon_id);
    audit(req.user, 'loan.return', code,
      `${code}: ${loan.borrower} trả lúc ${returnAt.replace('T', ' ')} — ${returnStatus}. Tình trạng: ${weaponStatus}`);

  })();

  res.json(mapLoan(db.prepare(`${LOAN_SELECT} WHERE l.id = ?`).get(id)));
}));

export default r;
