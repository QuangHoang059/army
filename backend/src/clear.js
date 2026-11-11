// Xoá toàn bộ dữ liệu trong DB (giữ nguyên cấu trúc bảng) và reset bộ đếm id.
// Dùng: npm run db:clear          (hỏi xác nhận)
//       npm run db:clear -- --yes (bỏ qua xác nhận)
import readline from 'node:readline/promises';
import { db, clearUploads } from './db.js';
import { backupNow } from './backup.js';

const TABLES = ['loans', 'maintenance', 'weapons']; // bảng con trước, bảng cha sau

const count = () => Object.fromEntries(TABLES.map((t) => [t, db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n]));

const before = count();
console.log('Dữ liệu hiện có:', before);

if (!process.argv.includes('--yes')) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ans = (await rl.question('Xoá HẾT dữ liệu? Gõ "yes" để xác nhận: ')).trim().toLowerCase();
  rl.close();
  if (ans !== 'yes' && ans !== 'y') {
    console.log('Đã huỷ, không xoá gì.');
    process.exit(0);
  }
}

const b = await backupNow('before-clear');
console.log(`Đã sao lưu trước khi xoá: ${b.name} (khôi phục: npm run restore -- ${b.name})`);

db.transaction(() => {
  for (const t of TABLES) db.prepare(`DELETE FROM ${t}`).run();
  db.exec(`DELETE FROM sqlite_sequence WHERE name IN (${TABLES.map((t) => `'${t}'`).join(',')});`);
})();
db.exec('VACUUM');
clearUploads();

console.log('Đã xoá sạch:', count());
db.close();
