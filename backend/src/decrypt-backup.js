// Giải mã file sao lưu .vkbak (tải từ trang Sao lưu) thành 1 bản sao lưu thường trong thư mục backups/.
// Dùng: npm run decrypt-backup -- <đường dẫn file.vkbak>
// Sau đó khôi phục: npm run restore -- <tên bản sao lưu in ra>
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { decryptBackupFile } from './backup-crypto.js';
import { BACKEND_DIR } from './env.js';

const BACKUP_DIR = path.resolve(BACKEND_DIR, process.env.BACKUP_DIR || './backups');
const file = process.argv.slice(2).find((a) => !a.startsWith('--'));
if (!file || !fs.existsSync(file)) {
  console.error('Dùng: npm run decrypt-backup -- <đường dẫn file .vkbak>');
  process.exit(1);
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const password = await rl.question('Mật khẩu giải mã: ');
rl.close();

const pad = (n) => String(n).padStart(2, '0');
const d = new Date();
const name = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}_import`;
const dir = path.join(BACKUP_DIR, name);
try {
  decryptBackupFile(fs.readFileSync(file), password, dir);
  if (!fs.existsSync(path.join(dir, 'army.db'))) throw new Error('File không chứa dữ liệu army.db.');
  console.log(`Đã giải mã vào: ${dir}`);
  console.log(`Khôi phục (dừng server trước): npm run restore -- ${name}`);
} catch (e) {
  fs.rmSync(dir, { recursive: true, force: true });
  console.error('Lỗi:', e.message);
  process.exitCode = 1;
}
