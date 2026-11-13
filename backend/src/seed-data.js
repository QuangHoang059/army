// Bộ dữ liệu mẫu Đại đội: 36 vũ khí, 5 phiếu bảo dưỡng, 3 phiếu bàn giao.
// Ngày được tính tương đối so với hôm nay để luôn có cảnh báo quá hạn / sắp đến hạn.
import { dayOffset, dateTimeOffset } from './utils.js';

const PEOPLE = [
  'Nguyễn Văn An', 'Trần Văn Bình', 'Lê Văn Cường', 'Phạm Văn Dũng', 'Hoàng Văn Em', 'Vũ Văn Phúc',
  'Đỗ Văn Giang', 'Bùi Văn Hưng', 'Ngô Văn Khánh', 'Đặng Văn Long', 'Dương Văn Minh', 'Lý Văn Nam',
  'Mai Văn Phúc', 'Tô Văn Quang', 'Võ Văn Sơn', 'Hồ Văn Tuấn',
];

export function buildSeed() {
  const weapons = [];
  const add = (name, type, unit, n, status, nextOffset, lastOffset) => {
    weapons.push({
      code: `QRCB-${String(n).padStart(3, '0')}`,
      name,
      serial: `VN-${String(n).padStart(3, '0')}`,
      type,
      unit,
      responsible: PEOPLE[(n - 1) % PEOPLE.length],
      status,
      last: dayOffset(lastOffset),
      next: dayOffset(nextOffset),
    });
  };

  for (let n = 1; n <= 16; n++)
    add('Súng tiểu liên STV380', 'STV380', n <= 6 ? 'Trung đội 1' : n <= 11 ? 'Trung đội 2' : 'Trung đội 3', n,
      n === 4 ? 'Đang bảo dưỡng' : n === 7 ? 'Đang mượn' : n === 11 ? 'Phân cấp 4' : 'Tốt',
      n === 4 ? 2 : n === 5 ? -2 : n === 6 ? 5 : n === 11 ? 28 : n === 15 ? 6 : 24, -28);
  for (let n = 17; n <= 20; n++)
    add('Kính ngắm trực tiếp', 'Kính trực tiếp', n === 17 ? 'Trung đội 1' : n === 18 ? 'Trung đội 2' : 'Trung đội 3', n,
      n === 19 ? 'Đang mượn' : 'Tốt', n === 19 ? 18 : n === 20 ? 4 : 30, -29);
  for (let n = 21; n <= 23; n++)
    add('Kính ngắm gián tiếp', 'Kính gián tiếp', 'Trung đội 2', n, n === 22 ? 'Đang bảo dưỡng' : 'Tốt', n === 22 ? 3 : 35, -30);
  for (let n = 24; n <= 27; n++)
    add('Súng ngắn K54', 'K54', 'Khối Đại đội', n, 'Tốt', n === 25 ? -1 : 20, -25);
  for (let n = 28; n <= 29; n++)
    add(n === 28 ? 'Thước đo góc bắn' : 'Nivo con cóc', n === 28 ? 'Thước góc bắn' : 'Nivo con cóc', 'Khối Đại đội', n, 'Tốt', 40, -20);
  for (let n = 30; n <= 32; n++)
    add('Lựu đạn F1', 'Lựu đạn', n === 30 ? 'Trung đội 1' : 'Trung đội 3', n, 'Tốt', 60, -15);
  for (let n = 33; n <= 34; n++)
    add('Ống nhòm quân sự', 'Ống nhòm', 'Khối Đại đội', n, n === 34 ? 'Đang bảo dưỡng' : 'Tốt', n === 34 ? 1 : 22, -32);
  for (let n = 35; n <= 36; n++)
    add('Máy thông tin PRC-25', 'Máy thông tin', 'Khối Đại đội', n, 'Tốt', n === 35 ? 7 : 45, -18);

  const maintenance = [
    { weaponCode: 'QRCB-001', date: dayOffset(-2), content: 'Lau chùi nòng súng, tra dầu, kiểm tra lò xo đẩy về', worker: 'Nguyễn Văn An', result: 'Đạt', nextDate: dayOffset(28) },
    { weaponCode: 'QRCB-004', date: dayOffset(-1), content: 'Tháo lắp kiểm tra cụm khóa nòng, thay lò xo hồi', worker: 'Trần Văn Bình', result: 'Đang theo dõi', nextDate: dayOffset(2) },
    { weaponCode: 'QRCB-021', date: dayOffset(-3), content: 'Vệ sinh thấu kính, kiểm tra vạch chia và khớp điều chỉnh', worker: 'Lê Văn Cường', result: 'Đạt', nextDate: dayOffset(27) },
    { weaponCode: 'QRCB-033', date: dayOffset(-4), content: 'Vệ sinh thấu kính, kiểm tra độ nét và khớp điều chỉnh', worker: 'Phạm Văn Dũng', result: 'Đạt', nextDate: dayOffset(26) },
    { weaponCode: 'QRCB-024', date: dayOffset(-5), content: 'Lau dầu, kiểm tra băng đạn và cò súng', worker: 'Hoàng Văn Em', result: 'Đạt', nextDate: dayOffset(25) },
  ];

  const loans = [
    { weaponCode: 'QRCB-007', borrower: 'Trần Văn Bình', purpose: 'Gác', borrowAt: dateTimeOffset(0, 19), returnAt: null, returnStatus: null, status: 'Đang mượn' },
    { weaponCode: 'QRCB-019', borrower: 'Lê Văn Cường', purpose: 'Huấn luyện', borrowAt: dateTimeOffset(0, 7), returnAt: null, returnStatus: null, status: 'Đang mượn' },
    { weaponCode: 'QRCB-002', borrower: 'Nguyễn Văn An', purpose: 'Diễn tập', borrowAt: dateTimeOffset(-2, 6), returnAt: dateTimeOffset(-1, 17), returnStatus: 'Tốt, đủ phụ kiện', status: 'Đã trả' },
  ];

  return { weapons, maintenance, loans };
}
