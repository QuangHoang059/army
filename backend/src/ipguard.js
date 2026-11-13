// Chỉ cho phép truy cập từ các dải IP được cấp phép (vd mạng truyền số liệu quân sự của đơn vị).
// Cấu hình trong backend/.env:  ALLOWED_IPS=10.0.0.0/8, 192.168.10.0/24, 203.0.113.7
// Để trống = không giới hạn. Máy chủ (127.0.0.1 / ::1) luôn được phép.
// Chặn ở backend nên áp dụng cho MỌI dữ liệu: API, ảnh, trang tem QR công khai /w/...
import net from 'node:net';

const list = new net.BlockList();
export const ALLOWED = (process.env.ALLOWED_IPS || '')
  .split(/[,\s;]+/)
  .map((s) => s.trim())
  .filter(Boolean);

for (const item of ALLOWED) {
  const [ip, bits] = item.split('/');
  const type = net.isIPv6(ip) ? 'ipv6' : net.isIPv4(ip) ? 'ipv4' : null;
  if (!type) {
    console.warn(`[ALLOWED_IPS] Bỏ qua giá trị không hợp lệ: "${item}"`);
    continue;
  }
  if (bits === undefined) list.addAddress(ip, type);
  else list.addSubnet(ip, Number(bits), type);
}

/** Chuẩn hoá IP từ Express ("::ffff:10.1.2.3" → "10.1.2.3"). */
export const cleanIp = (ip = '') => ip.replace(/^::ffff:/i, '');

export function ipAllowed(raw) {
  if (!ALLOWED.length) return true;
  const ip = cleanIp(raw);
  if (ip === '127.0.0.1' || ip === '::1') return true;
  const type = net.isIPv4(ip) ? 'ipv4' : net.isIPv6(ip) ? 'ipv6' : null;
  return !!type && list.check(ip, type);
}

const warned = new Map(); // ghi log mỗi IP tối đa 1 lần / giờ
export function ipGuard(req, res, next) {
  if (ipAllowed(req.ip)) return next();
  const ip = cleanIp(req.ip);
  const now = Date.now();
  if ((warned.get(ip) || 0) < now - 3600_000) {
    warned.set(ip, now);
    console.warn(`[ALLOWED_IPS] Chặn truy cập từ ${ip} → ${req.method} ${req.originalUrl}`);
  }
  res.status(403).json({
    error: `Máy của bạn (IP ${ip}) không thuộc mạng được phép truy cập hệ thống. Liên hệ quản trị viên đơn vị.`,
    code: 'ip_blocked',
  });
}

if (ALLOWED.length) console.log(`Chỉ cho phép truy cập từ: ${ALLOWED.join(', ')} (và máy chủ)`);
