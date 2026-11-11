// Khôi phục dữ liệu từ 1 bản sao lưu.
// Dùng: npm run restore                       → liệt kê các bản sao lưu
//       npm run restore -- <tên bản sao lưu>  → khôi phục (hỏi xác nhận; thêm --yes để bỏ qua)
// PHẢI dừng server (npm run dev / npm start) trước khi khôi phục.
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { DB_PATH, UPLOAD_DIR, db } from './db.js';
import { BACKUP_DIR, backupNow, listBackups } from './backup.js';

const name = process.argv.slice(2).find((a) => !a.startsWith('--'));
const all = listBackups();

if (!name) {
  if (!all.length) console.log(`Chưa có bản sao lưu nào trong ${BACKUP_DIR}`);
  else {
    console.log(`Các bản sao lưu (${BACKUP_DIR}):`);
    for (const b of all) console.log(`  ${b.name}   ${(b.size / 1024).toFixed(0)} KB, ${b.photos} ảnh`);
    console.log('\nKhôi phục: npm run restore -- <tên bản sao lưu>');
  }
  db.close();
  process.exit(0);
}

const b = all.find((x) => x.name === name);
if (!b) {
  console.error(`Không tìm thấy bản sao lưu "${name}". Chạy "npm run restore" để xem danh sách.`);
  db.close();
  process.exit(1);
}

// Server còn chạy thì không ghi đè DB đang mở
const port = Number(process.env.PORT) || 4000;
const alive = await fetch(`http://127.0.0.1:${port}/api/health`, { signal: AbortSignal.timeout(1500) })
  .then((r) => r.ok)
  .catch(() => false);
if (alive) {
  console.error(`Server đang chạy ở cổng ${port}. Dừng server (Ctrl+C ở cửa sổ npm run dev) rồi chạy lại lệnh này.`);
  db.close();
  process.exit(1);
}

if (!process.argv.includes('--yes')) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ans = (await rl.question(`Thay TOÀN BỘ dữ liệu hiện tại bằng bản ${name}? Gõ "yes" để xác nhận: `)).trim().toLowerCase();
  rl.close();
  if (ans !== 'yes' && ans !== 'y') {
    console.log('Đã huỷ.');
    db.close();
    process.exit(0);
  }
}

const safety = await backupNow('before-restore');
console.log(`Đã sao lưu dữ liệu hiện tại trước khi khôi phục: ${safety.name}`);
db.close();

const src = path.join(BACKUP_DIR, name);
for (const ext of ['-wal', '-shm']) fs.rmSync(DB_PATH + ext, { force: true });
fs.copyFileSync(path.join(src, 'army.db'), DB_PATH);
for (const f of fs.readdirSync(UPLOAD_DIR)) fs.rmSync(path.join(UPLOAD_DIR, f), { recursive: true, force: true });
if (fs.existsSync(path.join(src, 'uploads'))) fs.cpSync(path.join(src, 'uploads'), UPLOAD_DIR, { recursive: true });
console.log(`Đã khôi phục từ ${name}. Chạy lại server.`);
