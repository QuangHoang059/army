// Máy chủ giao diện (thay cho `next start` / `next dev`).
// Lý do: proxy /api của Next KHÔNG báo cho backend biết IP thật của người dùng → mọi máy trong mạng LAN
// đều hiện là 127.0.0.1 và lọt qua danh sách ALLOWED_IPS. Ở đây ghi đè X-Forwarded-For theo kết nối thật:
//  - Kết nối từ chính máy chủ (cloudflared, trình duyệt trên máy chủ): giữ header do cloudflared gắn (IP người dùng Internet).
//  - Kết nối từ máy khác: thay bằng IP thật của máy đó (người dùng không tự khai IP giả được).
// Dùng: node server.mjs [--dev] [-p 3000]
import http from 'node:http';

const args = process.argv.slice(2);
const dev = args.includes('--dev');
const pi = args.findIndex((a) => a === '-p' || a === '--port');
const port = Number(pi >= 0 ? args[pi + 1] : process.env.PORT || 3000);

// NODE_ENV phải đặt trước khi nạp Next
process.env.NODE_ENV = dev ? 'development' : 'production';
const { default: next } = await import('next');

const isLoopback = (ip = '') => /^(::1|127\.|::ffff:127\.)/.test(ip);

const app = next({ dev, dir: import.meta.dirname });
const handle = app.getRequestHandler();
await app.prepare();

http
  .createServer((req, res) => {
    const remote = req.socket.remoteAddress || '';
    if (!isLoopback(remote)) req.headers['x-forwarded-for'] = remote.replace(/^::ffff:/i, '');
    handle(req, res);
  })
  .listen(port, () => console.log(`> Giao diện: http://localhost:${port}${dev ? ' (dev)' : ''}`));
