import { Router } from 'express';
import ExcelJS from 'exceljs';
import { db } from '../db.js';
import { SOON_THRESHOLD_DAYS, WEAPON_STATUSES } from '../constants.js';
import { addDays, daysUntil, isDate, todayStr, HttpError, ah } from '../utils.js';

// Báo cáo - thống kê: số lượng VKTB theo tuần / tháng, danh sách đến hạn bảo dưỡng, danh sách chưa trả.
// GET /api/reports?period=week|month&date=YYYY-MM-DD           → JSON (xem trên web)
// GET /api/reports/export.xlsx?period=week|month&date=...      → file Excel nộp lên Tiểu đoàn
const r = Router();

const fmt = (s) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : '');
const fmtDT = (s) => (s ? `${s.slice(11, 16)} ${fmt(s)}`.trim() : '');

/** Khoảng thời gian báo cáo: tuần (Thứ 2 → Chủ nhật) hoặc tháng chứa ngày `date`. */
function periodOf(period, date) {
  if (period !== 'week' && period !== 'month') throw new HttpError(400, 'Kỳ báo cáo phải là week hoặc month.');
  const d = date || todayStr();
  if (!isDate(d)) throw new HttpError(400, 'Ngày không hợp lệ (YYYY-MM-DD).');
  if (period === 'week') {
    const [y, m, dd] = d.split('-').map(Number);
    const dow = (new Date(Date.UTC(y, m - 1, dd)).getUTCDay() + 6) % 7; // 0 = Thứ 2
    const from = addDays(d, -dow);
    const to = addDays(from, 6);
    return { period, from, to, label: `Tuần ${fmt(from).slice(0, 5)} – ${fmt(to)}` };
  }
  const from = `${d.slice(0, 7)}-01`;
  const [y, m] = d.split('-').map(Number);
  const to = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  return { period, from, to, label: `Tháng ${d.slice(5, 7)}/${d.slice(0, 4)}` };
}

const level = (left) => (left < 0 ? 'Quá hạn' : left <= SOON_THRESHOLD_DAYS ? 'Sắp đến hạn' : 'Trong hạn');

function buildReport(period, date) {
  const p = periodOf(period, date);
  const statusCols = WEAPON_STATUSES.map((s, i) => `SUM(status = @s${i}) AS s${i}`).join(', ');
  const sp = Object.fromEntries(WEAPON_STATUSES.map((s, i) => [`s${i}`, s]));
  const group = (col) =>
    db
      .prepare(`SELECT ${col} AS name, COUNT(*) AS total, ${statusCols} FROM weapons WHERE retired_at IS NULL GROUP BY ${col} ORDER BY ${col}`)
      .all(sp)
      .map((row) => ({ name: row.name, total: row.total, byStatus: WEAPON_STATUSES.map((_, i) => row[`s${i}`] || 0) }));

  const one = (sql, ...a) => db.prepare(sql).get(...a).n;
  const between = { from: p.from, to: p.to };

  const maintenance = db
    .prepare(
      `SELECT m.date, m.content, m.worker, m.result, m.next_date, w.code, w.name, w.serial, w.type, w.unit
       FROM maintenance m JOIN weapons w ON w.id = m.weapon_id
       WHERE m.date BETWEEN @from AND @to ORDER BY m.date, w.code`,
    )
    .all(between);
  const loans = db
    .prepare(
      `SELECT l.borrower, l.purpose, l.borrow_at, l.return_at, l.return_status, l.status, w.code, w.name, w.serial, w.type, w.unit
       FROM loans l JOIN weapons w ON w.id = l.weapon_id
       WHERE substr(l.borrow_at, 1, 10) BETWEEN @from AND @to ORDER BY l.borrow_at`,
    )
    .all(between);

  const due = db
    .prepare('SELECT code, name, serial, type, unit, responsible, status, last_maint, next_maint FROM weapons WHERE retired_at IS NULL ORDER BY next_maint, code')
    .all()
    .map((w) => {
      const left = daysUntil(w.next_maint);
      return { ...w, daysLeft: left, level: level(left) };
    });

  const now = Date.now();
  const unreturned = db
    .prepare(
      `SELECT l.borrower, l.purpose, l.borrow_at, l.recorded_by, w.code, w.name, w.serial, w.type, w.unit, w.responsible
       FROM loans l JOIN weapons w ON w.id = l.weapon_id WHERE l.status = 'Đang mượn' ORDER BY l.borrow_at`,
    )
    .all()
    .map((l) => ({ ...l, hoursOut: Math.max(0, Math.floor((now - new Date(l.borrow_at).getTime()) / 3600000)) }));

  return {
    ...p,
    generatedAt: new Date().toISOString(),
    statuses: WEAPON_STATUSES,
    total: one('SELECT COUNT(*) n FROM weapons WHERE retired_at IS NULL'),
    byType: group('type'),
    byUnit: group('unit'),
    activity: {
      maintenance: maintenance.length,
      maintenanceByResult: db
        .prepare('SELECT result, COUNT(*) AS count FROM maintenance WHERE date BETWEEN @from AND @to GROUP BY result ORDER BY count DESC')
        .all(between),
      borrowed: loans.length,
      returned: one("SELECT COUNT(*) n FROM loans WHERE status = 'Đã trả' AND substr(return_at, 1, 10) BETWEEN ? AND ?", p.from, p.to),
      added: one("SELECT COUNT(*) n FROM weapons WHERE date(created_at, 'localtime') BETWEEN ? AND ?", p.from, p.to),
      retired: one('SELECT COUNT(*) n FROM weapons WHERE substr(retired_at, 1, 10) BETWEEN ? AND ?', p.from, p.to),
    },
    overdue: due.filter((w) => w.daysLeft < 0).length,
    soon: due.filter((w) => w.daysLeft >= 0 && w.daysLeft <= SOON_THRESHOLD_DAYS).length,
    due,
    unreturned,
    maintenance,
    loans,
  };
}

r.get('/', ah((req, res) => res.json(buildReport(req.query.period || 'week', req.query.date))));

// ------------------------------- Excel -------------------------------
const THIN = { style: 'thin', color: { argb: 'FF7F7F7F' } };
const BORDER = { top: THIN, left: THIN, bottom: THIN, right: THIN };
const HEAD_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCE6DC' } };
const FILLS = {
  'Quá hạn': { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDE2E2' } },
  'Sắp đến hạn': { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } },
};

/** Tạo 1 sheet có tiêu đề đơn vị, tên báo cáo, bảng số liệu, chỗ ký. */
function addSheet(wb, name, { unitLabel, title, sub, columns, rows, totalRow, author, rowFill }) {
  const ws = wb.addWorksheet(name, {
    pageSetup: { paperSize: 9, orientation: columns.length > 7 ? 'landscape' : 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    views: [{ showGridLines: false }],
  });
  const n = columns.length;
  ws.columns = columns.map((c) => ({ width: c.width || 14 }));

  const line = (text, opts = {}) => {
    const row = ws.addRow([text]);
    ws.mergeCells(row.number, 1, row.number, n);
    row.getCell(1).font = { name: 'Times New Roman', size: opts.size || 12, bold: !!opts.bold, italic: !!opts.italic };
    row.getCell(1).alignment = { horizontal: opts.align || 'center', vertical: 'middle', wrapText: true };
    if (opts.height) row.height = opts.height;
    return row;
  };
  line(unitLabel.toUpperCase(), { bold: true, align: 'left' });
  ws.addRow([]);
  line(title, { bold: true, size: 14, height: 22 });
  if (sub) line(sub, { italic: true });
  ws.addRow([]);

  const head = ws.addRow(columns.map((c) => c.header));
  head.height = 32;
  head.eachCell((cell) => {
    cell.font = { name: 'Times New Roman', bold: true, size: 11 };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.fill = HEAD_FILL;
    cell.border = BORDER;
  });
  ws.views = [{ state: 'frozen', ySplit: head.number, showGridLines: false }];

  rows.forEach((data, i) => {
    const row = ws.addRow(columns.map((c) => (c.key === '#' ? i + 1 : typeof c.key === 'function' ? c.key(data) : data[c.key])));
    const fill = rowFill?.(data);
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      const c = columns[col - 1];
      cell.font = { name: 'Times New Roman', size: 11 };
      cell.alignment = { horizontal: c.align || (typeof cell.value === 'number' ? 'center' : 'left'), vertical: 'middle', wrapText: true };
      cell.border = BORDER;
      if (fill) cell.fill = fill;
    });
  });
  if (!rows.length) line('(Không có)', { italic: true });
  if (totalRow) {
    const row = ws.addRow(totalRow);
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.font = { name: 'Times New Roman', size: 11, bold: true };
      cell.alignment = { horizontal: typeof cell.value === 'number' ? 'center' : 'left', vertical: 'middle' };
      cell.border = BORDER;
      cell.fill = HEAD_FILL;
    });
  }

  // Chỗ ký
  ws.addRow([]);
  const half = Math.max(1, Math.ceil(n / 2));
  const sign = (texts, opts) => {
    const row = ws.addRow([]);
    texts.forEach((t, k) => {
      const c1 = k === 0 ? 1 : half + 1;
      const c2 = k === 0 ? half : n;
      if (c2 > c1) ws.mergeCells(row.number, c1, row.number, c2);
      const cell = row.getCell(c1);
      cell.value = t;
      cell.font = { name: 'Times New Roman', size: 12, ...opts };
      cell.alignment = { horizontal: 'center' };
    });
  };
  const today = todayStr();
  sign(['', `Ngày ${today.slice(8, 10)} tháng ${today.slice(5, 7)} năm ${today.slice(0, 4)}`], { italic: true });
  sign(['CHỈ HUY ĐƠN VỊ', 'NGƯỜI LẬP BÁO CÁO'], { bold: true });
  sign(['(Ký, ghi rõ họ tên)', '(Ký, ghi rõ họ tên)'], { italic: true, size: 10 });
  ws.addRow([]);
  ws.addRow([]);
  ws.addRow([]);
  sign(['', author], { bold: true });
  return ws;
}

r.get('/export.xlsx', ah(async (req, res) => {
  const rep = buildReport(req.query.period || 'week', req.query.date);
  const unitLabel = req.user.unitLabel || 'Đơn vị';
  const author = req.user.fullName || req.user.username;
  const kind = rep.period === 'week' ? 'TUẦN' : 'THÁNG';
  const sub = `${rep.label} (từ ${fmt(rep.from)} đến ${fmt(rep.to)})`;
  const base = { unitLabel, author };

  const wb = new ExcelJS.Workbook();
  wb.creator = author;
  wb.created = new Date();

  const statusCols = rep.statuses.map((s) => ({ header: s, width: 12 }));
  const groupSheet = (rows, label) => ({
    columns: [
      { header: 'STT', key: '#', width: 6 },
      { header: label, key: 'name', width: 26 },
      { header: 'Tổng số', key: 'total', width: 10 },
      ...statusCols.map((c, i) => ({ ...c, key: (x) => x.byStatus[i] })),
    ],
    rows,
    totalRow: ['', 'Cộng', rep.total, ...rep.statuses.map((_, i) => rows.reduce((a, x) => a + x.byStatus[i], 0))],
  });

  addSheet(wb, 'Tổng hợp theo loại', {
    ...base,
    title: `BÁO CÁO SỐ LƯỢNG VŨ KHÍ - TRANG BỊ ${kind}`,
    sub: `${sub} — số liệu tại thời điểm lập: ${fmtDT(new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString())}`,
    ...groupSheet(rep.byType, 'Loại vũ khí - trang bị'),
  });
  addSheet(wb, 'Tổng hợp theo đơn vị', {
    ...base,
    title: `SỐ LƯỢNG VŨ KHÍ - TRANG BỊ THEO ĐƠN VỊ ${kind}`,
    sub,
    ...groupSheet(rep.byUnit, 'Đơn vị quản lý'),
  });

  const a = rep.activity;
  addSheet(wb, 'Hoạt động trong kỳ', {
    ...base,
    title: `TÌNH HÌNH BẢO DƯỠNG - MƯỢN TRẢ ${kind}`,
    sub,
    columns: [
      { header: 'STT', key: '#', width: 6 },
      { header: 'Nội dung', key: 'k', width: 46 },
      { header: 'Số lượng', key: 'v', width: 12 },
    ],
    rows: [
      { k: 'Lượt bảo dưỡng đã thực hiện', v: a.maintenance },
      ...a.maintenanceByResult.map((x) => ({ k: `   – Kết quả "${x.result}"`, v: x.count })),
      { k: 'Lượt mượn / bàn giao', v: a.borrowed },
      { k: 'Lượt trả', v: a.returned },
      { k: 'Vũ khí quá hạn bảo dưỡng (hiện tại)', v: rep.overdue },
      { k: `Vũ khí sắp đến hạn bảo dưỡng trong ${SOON_THRESHOLD_DAYS} ngày (hiện tại)`, v: rep.soon },
      { k: 'Vũ khí đang mượn chưa trả (hiện tại)', v: rep.unreturned.length },
      { k: 'Vũ khí nhập mới', v: a.added },
      { k: 'Vũ khí thanh lý', v: a.retired },
    ],
  });

  addSheet(wb, 'Đến hạn bảo dưỡng', {
    ...base,
    title: 'DANH SÁCH VŨ KHÍ - TRANG BỊ THEO HẠN BẢO DƯỠNG',
    sub: `Sắp xếp theo hạn bảo dưỡng tiếp theo, quá hạn lên đầu — tính đến ${fmt(todayStr())}`,
    columns: [
      { header: 'STT', key: '#', width: 6 },
      { header: 'Mã QR', key: 'code', width: 12 },
      { header: 'Tên vũ khí', key: 'name', width: 24 },
      { header: 'Loại', key: 'type', width: 14 },
      { header: 'Số hiệu', key: 'serial', width: 12 },
      { header: 'Đơn vị', key: 'unit', width: 14 },
      { header: 'Người chịu trách nhiệm', key: 'responsible', width: 22 },
      { header: 'Bảo dưỡng gần nhất', key: (w) => fmt(w.last_maint), width: 13, align: 'center' },
      { header: 'Hạn tiếp theo', key: (w) => fmt(w.next_maint), width: 13, align: 'center' },
      { header: 'Còn (ngày)', key: 'daysLeft', width: 9 },
      { header: 'Mức', key: 'level', width: 13, align: 'center' },
    ],
    rows: rep.due,
    rowFill: (w) => FILLS[w.level],
  });

  addSheet(wb, 'Chưa trả', {
    ...base,
    title: 'DANH SÁCH VŨ KHÍ - TRANG BỊ ĐANG MƯỢN, CHƯA TRẢ',
    sub: `Tính đến ${fmtDT(new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString())}`,
    columns: [
      { header: 'STT', key: '#', width: 6 },
      { header: 'Mã QR', key: 'code', width: 12 },
      { header: 'Tên vũ khí', key: 'name', width: 24 },
      { header: 'Số hiệu', key: 'serial', width: 12 },
      { header: 'Đơn vị', key: 'unit', width: 14 },
      { header: 'Người mượn', key: 'borrower', width: 22 },
      { header: 'Mục đích', key: 'purpose', width: 14 },
      { header: 'Thời gian mượn', key: (l) => fmtDT(l.borrow_at), width: 17, align: 'center' },
      { header: 'Đã mượn', key: (l) => (l.hoursOut >= 24 ? `${Math.floor(l.hoursOut / 24)} ngày ${l.hoursOut % 24} giờ` : `${l.hoursOut} giờ`), width: 14, align: 'center' },
      { header: 'Người ghi', key: 'recorded_by', width: 18 },
    ],
    rows: rep.unreturned,
  });

  addSheet(wb, 'Sổ bảo dưỡng trong kỳ', {
    ...base,
    title: `SỔ BẢO DƯỠNG ${kind}`,
    sub,
    columns: [
      { header: 'STT', key: '#', width: 6 },
      { header: 'Ngày', key: (m) => fmt(m.date), width: 12, align: 'center' },
      { header: 'Mã QR', key: 'code', width: 12 },
      { header: 'Tên vũ khí', key: 'name', width: 22 },
      { header: 'Số hiệu', key: 'serial', width: 12 },
      { header: 'Nội dung', key: 'content', width: 30 },
      { header: 'Người thực hiện', key: 'worker', width: 20 },
      { header: 'Kết quả', key: 'result', width: 13 },
      { header: 'Hạn tiếp theo', key: (m) => fmt(m.next_date), width: 13, align: 'center' },
    ],
    rows: rep.maintenance,
  });

  addSheet(wb, 'Mượn - trả trong kỳ', {
    ...base,
    title: `SỔ MƯỢN - TRẢ ${kind}`,
    sub,
    columns: [
      { header: 'STT', key: '#', width: 6 },
      { header: 'Mã QR', key: 'code', width: 12 },
      { header: 'Tên vũ khí', key: 'name', width: 22 },
      { header: 'Số hiệu', key: 'serial', width: 12 },
      { header: 'Người mượn', key: 'borrower', width: 20 },
      { header: 'Mục đích', key: 'purpose', width: 14 },
      { header: 'Mượn lúc', key: (l) => fmtDT(l.borrow_at), width: 17, align: 'center' },
      { header: 'Trả lúc', key: (l) => fmtDT(l.return_at), width: 17, align: 'center' },
      { header: 'Tình trạng khi trả', key: 'return_status', width: 16 },
      { header: 'Trạng thái', key: 'status', width: 12 },
    ],
    rows: rep.loans,
  });

  const file = `BaoCao_VKTB_${rep.period === 'week' ? 'Tuan' : 'Thang'}_${rep.from}_${rep.to}.xlsx`;
  res.set({
    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Content-Disposition': `attachment; filename="${file}"`,
    'Cache-Control': 'no-store',
  });
  await wb.xlsx.write(res);
  res.end();
}));

export default r;
