import { Router } from 'express';
import { db, mapWeapon, mapLoan, LOAN_SELECT } from '../db.js';
import { SOON_THRESHOLD_DAYS } from '../constants.js';
import { dayOffset, todayStr, nowLocal, ah } from '../utils.js';

const r = Router();

// GET /api/stats — số liệu Dashboard
r.get('/stats', ah((req, res) => {
  const today = todayStr();
  const soonEnd = dayOffset(SOON_THRESHOLD_DAYS);
  const one = (sql, ...p) => db.prepare(sql).get(...p).n;

  res.json({
    total: one('SELECT COUNT(*) n FROM weapons WHERE retired_at IS NULL'),
    using: one("SELECT COUNT(*) n FROM weapons WHERE retired_at IS NULL AND status='Tốt'"),
    maint: one("SELECT COUNT(*) n FROM weapons WHERE retired_at IS NULL AND status='Đang bảo dưỡng'"),
    // Phân cấp 3–5: cần sửa chữa / chờ xử lý, không xuất kho
    broken: one("SELECT COUNT(*) n FROM weapons WHERE retired_at IS NULL AND status IN ('Phân cấp 3','Phân cấp 4','Phân cấp 5')"),
    borrowed: one("SELECT COUNT(*) n FROM weapons WHERE retired_at IS NULL AND status='Đang mượn'"),
    soon: one('SELECT COUNT(*) n FROM weapons WHERE retired_at IS NULL AND next_maint >= ? AND next_maint <= ?', today, soonEnd),
    over: one('SELECT COUNT(*) n FROM weapons WHERE retired_at IS NULL AND next_maint < ?', today),
    // Phiếu mượn đã quá giờ hẹn trả mà chưa trả
    loansOverdue: one("SELECT COUNT(*) n FROM loans WHERE status='Đang mượn' AND due_at IS NOT NULL AND due_at < ?", nowLocal()),
    byType: db.prepare('SELECT type, COUNT(*) AS count FROM weapons WHERE retired_at IS NULL GROUP BY type ORDER BY count DESC, type').all(),
  });
}));

// GET /api/alerts — vũ khí quá hạn & sắp đến hạn bảo dưỡng (7 ngày) + phiếu mượn quá giờ trả
r.get('/alerts', ah((req, res) => {
  const today = todayStr();
  const soonEnd = dayOffset(SOON_THRESHOLD_DAYS);
  res.json({
    overdue: db.prepare('SELECT * FROM weapons WHERE retired_at IS NULL AND next_maint < ? ORDER BY next_maint').all(today).map(mapWeapon),
    soon: db.prepare('SELECT * FROM weapons WHERE retired_at IS NULL AND next_maint >= ? AND next_maint <= ? ORDER BY next_maint')
      .all(today, soonEnd).map(mapWeapon),
    loansOverdue: db.prepare(`${LOAN_SELECT} WHERE l.status='Đang mượn' AND l.due_at IS NOT NULL AND l.due_at < ? ORDER BY l.due_at`)
      .all(nowLocal()).map(mapLoan),
  });
}));

export default r;
