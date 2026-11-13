// Đóng gói 1 bản sao lưu thành 1 file .vkbak MÃ HOÁ (AES-256-GCM, khoá dẫn xuất từ mật khẩu bằng scrypt)
// để chép ra USB / gửi lên cấp trên mà không lộ dữ liệu nếu mất USB.
// Giải mã: npm run decrypt-backup -- <file.vkbak>   (hỏi mật khẩu) → tạo bản sao lưu mới trong backups/ → npm run restore -- <tên>
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const MAGIC = Buffer.from('VKBAK1\n');
const SCRYPT = { N: 1 << 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
export const MIN_PASSWORD = 8;

const key = (password, salt) => crypto.scryptSync(password, salt, 32, SCRYPT);

/** Gom mọi file trong thư mục (đệ quy) thành 1 buffer: [độ dài tên u16][tên][kích thước u32][dữ liệu]... */
function pack(dir) {
  const parts = [];
  const walk = (rel) => {
    for (const e of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) walk(r);
      else {
        const name = Buffer.from(r, 'utf8');
        const data = fs.readFileSync(path.join(dir, r));
        const h = Buffer.alloc(6 + name.length);
        h.writeUInt16BE(name.length, 0);
        name.copy(h, 2);
        h.writeUInt32BE(data.length, 2 + name.length);
        parts.push(h, data);
      }
    }
  };
  walk('');
  return Buffer.concat(parts);
}

function unpack(buf, dir) {
  let o = 0;
  const root = path.resolve(dir);
  while (o < buf.length) {
    const n = buf.readUInt16BE(o);
    const name = buf.subarray(o + 2, o + 2 + n).toString('utf8');
    const size = buf.readUInt32BE(o + 2 + n);
    const start = o + 6 + n;
    const target = path.resolve(root, name);
    if (!target.startsWith(root + path.sep)) throw new Error('File sao lưu không hợp lệ.');
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, buf.subarray(start, start + size));
    o = start + size;
  }
}

/** Thư mục bản sao lưu → Buffer file .vkbak đã mã hoá */
export function encryptBackupDir(dir, password) {
  if (!password || password.length < MIN_PASSWORD) throw new Error(`Mật khẩu mã hoá tối thiểu ${MIN_PASSWORD} ký tự.`);
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key(password, salt), iv);
  const body = Buffer.concat([c.update(zlib.gzipSync(pack(dir))), c.final()]);
  return Buffer.concat([MAGIC, salt, iv, c.getAuthTag(), body]);
}

/** File .vkbak → giải mã ra thư mục dir (sai mật khẩu / file bị sửa → lỗi) */
export function decryptBackupFile(buf, password, dir) {
  if (!buf.subarray(0, MAGIC.length).equals(MAGIC)) throw new Error('Không phải file sao lưu mã hoá (.vkbak).');
  let o = MAGIC.length;
  const salt = buf.subarray(o, (o += 16));
  const iv = buf.subarray(o, (o += 12));
  const tag = buf.subarray(o, (o += 16));
  const d = crypto.createDecipheriv('aes-256-gcm', key(password, salt), iv);
  d.setAuthTag(tag);
  let plain;
  try {
    plain = Buffer.concat([d.update(buf.subarray(o)), d.final()]);
  } catch {
    throw new Error('Sai mật khẩu hoặc file đã bị thay đổi.');
  }
  fs.mkdirSync(dir, { recursive: true });
  unpack(zlib.gunzipSync(plain), dir);
}
