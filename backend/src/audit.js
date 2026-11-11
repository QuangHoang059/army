// Nhật ký thao tác: ai làm gì, lúc nào. Ghi cùng transaction với thao tác khi có thể.
import { db } from './db.js';

/** Tên hiển thị của người thao tác, lưu cứng vào phiếu / nhật ký (đổi tên hay xoá tài khoản sau này vẫn giữ). */
export const actorName = (u) => (u ? `${u.fullName} (${u.username})` : 'Hệ thống');

const ins = db.prepare('INSERT INTO audit_log (user_id, actor, action, entity, summary, detail) VALUES (?, ?, ?, ?, ?, ?)');

/**
 * @param {object|null} user   req.user
 * @param {string} action      vd 'weapon.create'
 * @param {string|null} entity mã vũ khí / username / tên loại
 * @param {string} summary     câu mô tả tiếng Việt
 * @param {object} [detail]
 */
export function audit(user, action, entity, summary, detail) {
  ins.run(user?.id ?? null, actorName(user), action, entity ?? null, summary, detail ? JSON.stringify(detail) : null);
}

/** So sánh 2 object theo danh sách trường → { field: [cũ, mới] } cho các trường thay đổi. */
export function diff(before, after, fields) {
  const out = {};
  for (const f of fields) if (after[f] !== undefined && String(before[f] ?? '') !== String(after[f] ?? '')) out[f] = [before[f], after[f]];
  return out;
}
