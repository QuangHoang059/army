import './env.js';
import express from 'express';
import cors from 'cors';
import { db, UPLOAD_DIR, weaponTypeNames, unitNames } from './db.js';
import { seed } from './seed.js';
import { ah } from './utils.js';
import * as constants from './constants.js';
import { authenticate, ensureAdmin, loginRedirect, requireAdmin, requireAuth } from './auth.js';
import auth from './routes/auth.js';
import users from './routes/users.js';
import weaponTypes from './routes/types.js';
import units from './routes/units.js';
import weapons from './routes/weapons.js';
import maintenance from './routes/maintenance.js';
import loans from './routes/loans.js';
import stats from './routes/stats.js';
import system from './routes/system.js';
import publicRoutes from './routes/public.js';
import reports from './routes/reports.js';
import checks from './routes/checks.js';
import messages from './routes/messages.js';
import { startAutoBackup } from './backup.js';
import { ipGuard } from './ipguard.js';

ensureAdmin();

const app = express();
app.set('trust proxy', 'loopback'); // Next.js dev/rewrite chạy cùng máy → lấy đúng IP người dùng cho chống dò mật khẩu
app.use(ipGuard); // chỉ IP trong ALLOWED_IPS (mạng quân sự) mới vào được — đặt trước mọi route
app.use(cors({ origin: process.env.CORS_ORIGIN?.split(',') || true, credentials: true }));
app.use(express.json({ limit: '100kb' }));
app.use(authenticate);

// ---- Không cần đăng nhập ----
app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/auth', auth);
app.use('/api/public', publicRoutes); // trang tem QR công khai — chỉ thông tin 1 vũ khí

// ---- Ảnh vũ khí: cần đăng nhập. Tên file có timestamp nên cache lâu được (private: không cho proxy dùng chung) ----
app.use(
  '/api/uploads',
  loginRedirect,
  express.static(UPLOAD_DIR, {
    cacheControl: false,
    setHeaders: (res) => res.set('Cache-Control', 'private, max-age=2592000, immutable'),
  }),
);

// ---- Cần đăng nhập (quyền ghi chi tiết đặt trong từng router) ----
app.get('/api/meta', requireAuth, (req, res) =>
  res.json({
    types: weaponTypeNames(),
    units: unitNames(),
    statuses: constants.WEAPON_STATUSES,
    maintResults: constants.MAINT_RESULTS,
    loanPurposes: constants.LOAN_PURPOSES,
    maintIntervalDays: constants.MAINT_INTERVAL_DAYS,
    soonThresholdDays: constants.SOON_THRESHOLD_DAYS,
  }),
);
app.use('/api/users', requireAdmin, users);
app.use('/api/weapon-types', weaponTypes);
app.use('/api/units', units);
app.use('/api/weapons', weapons);
app.use('/api/maintenance', requireAuth, maintenance);
app.use('/api/loans', requireAuth, loans);
app.use('/api/reports', requireAuth, reports); // báo cáo tuần / tháng + xuất Excel
app.use('/api/checks', requireAuth, checks); // kiểm đếm bằng quét QR
app.use('/api/messages', requireAuth, messages); // nhắn tin giữa các tài khoản
app.use('/api', requireAuth, stats); // /api/stats, /api/alerts — đặt TRƯỚC system (system chặn non-admin cho mọi /api/...)
app.use('/api', requireAdmin, system); // /api/audit, /api/backups

// Nạp dữ liệu mẫu (chỉ khi DB trống) — admin
app.post('/api/seed', requireAdmin, ah((req, res) => res.status(201).json(seed())));

app.use('/api', (req, res) => res.status(404).json({ error: 'Không tìm thấy endpoint.' }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.status || (err.type === 'entity.parse.failed' ? 400 : 500);
  if (status >= 500) console.error(err);
  const msg = err.type === 'entity.too.large' ? 'Dữ liệu gửi lên quá lớn (ảnh tối đa 8MB).' : err.message;
  res.status(status).json({ error: status >= 500 ? 'Lỗi máy chủ.' : msg });
});

const PORT = Number(process.env.PORT) || 4000;
const server = app.listen(PORT, () => console.log(`API listening on http://localhost:${PORT}`));

startAutoBackup();

const shutdown = () => server.close(() => { db.close(); process.exit(0); });
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
