import { Router } from 'express';
import { db, mapWeapon } from '../db.js';
import { SOON_THRESHOLD_DAYS } from '../constants.js';
import { dayOffset, todayStr, ah } from '../utils.js';

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
    broken: one("SELECT COUNT(*) n FROM weapons WHERE retired_at IS NULL AND status='Hỏng'"),
    borrowed: one("SELECT COUNT(*) n FROM weapons WHERE retired_at IS NULL AND status='Đang mượn'"),
    soon: one('SELECT COUNT(*) n FROM weapons WHERE retired_at IS NULL AND next_maint >= ? AND next_maint <= ?', today, soonEnd),
    over: one('SELECT COUNT(*) n FROM weapons WHERE retired_at IS NULL AND next_maint < ?', today),
    byType: db.prepare('SELECT type, COUNT(*) AS count FROM weapons WHERE retired_at IS NULL GROUP BY type ORDER BY count DESC, type').all(),
  });
}));

// GET /api/alerts — vũ khí quá hạn & sắp đến hạn (7 ngày)
r.get('/alerts', ah((req, res) => {
  const today = todayStr();
  const soonEnd = dayOffset(SOON_THRESHOLD_DAYS);
  res.json({
    overdue: db.prepare('SELECT * FROM weapons WHERE retired_at IS NULL AND next_maint < ? ORDER BY next_maint').all(today).map(mapWeapon),
    soon: db.prepare('SELECT * FROM weapons WHERE retired_at IS NULL AND next_maint >= ? AND next_maint <= ? ORDER BY next_maint')
      .all(today, soonEnd).map(mapWeapon),
  });
}));

export default r;
