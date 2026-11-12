'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, FileSpreadsheet, Loader2 } from 'lucide-react';
import { useData } from '@/components/DataProvider';
import { PageTitle, StatusBadge, card } from '@/components/ui';
import { api } from '@/lib/api';
import { addDays, dayOffset, fmtDate, fmtDateTime } from '@/lib/date';
import type { Report, ReportGroup } from '@/lib/types';

type Period = 'week' | 'month';

/** Lùi / tiến 1 kỳ */
function shift(period: Period, date: string, dir: 1 | -1) {
  if (period === 'week') return addDays(date, 7 * dir);
  const [y, m] = date.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + dir, 1));
  return d.toISOString().slice(0, 10);
}

const LEVEL_CLS: Record<string, string> = {
  'Quá hạn': 'bg-[var(--red-soft)] text-[var(--red)]',
  'Sắp đến hạn': 'bg-[var(--amber-soft)] text-[var(--amber)]',
  'Trong hạn': 'text-[var(--muted)]',
};

const th = 'border-b border-[var(--line)] px-2 py-2 text-left text-xs font-bold uppercase text-[var(--muted)]';
const td = 'border-b border-[var(--line)] px-2 py-2';

export default function ReportsPage() {
  const { setFlash, stats } = useData(); // stats đổi khi dữ liệu cập nhật → tải lại báo cáo
  const [period, setPeriod] = useState<Period>('week');
  const [date, setDate] = useState(() => dayOffset(0));
  const [rep, setRep] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [dueFilter, setDueFilter] = useState<'all' | 'warn'>('warn');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api
      .report(period, date)
      .then((r) => alive && setRep(r))
      .catch((e: Error) => alive && setFlash({ kind: 'error', text: e.message }))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [period, date, setFlash, stats]);

  const exportXlsx = async () => {
    setExporting(true);
    try {
      const name = await api.exportReport(period, date);
      setFlash({ kind: 'ok', text: `Đã tải file ${name}.` });
    } catch (e) {
      setFlash({ kind: 'error', text: (e as Error).message });
    } finally {
      setExporting(false);
    }
  };

  const due = rep ? (dueFilter === 'warn' ? rep.due.filter((w) => w.level !== 'Trong hạn') : rep.due) : [];

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PageTitle title="Báo cáo - Thống kê" sub="Tự động tổng hợp theo tuần / tháng. Xuất file Excel để nộp lên Tiểu đoàn." />
        <button
          onClick={exportXlsx}
          disabled={exporting || !rep}
          className="flex items-center gap-2 rounded-xl bg-[var(--green)] px-4 py-3 font-bold text-white disabled:opacity-50"
        >
          {exporting ? <Loader2 size={18} className="animate-spin" /> : <FileSpreadsheet size={18} />} Xuất Excel
        </button>
      </div>

      {/* Chọn kỳ báo cáo */}
      <div className={`${card} mt-4 flex flex-wrap items-center gap-3 p-3`}>
        <div className="flex overflow-hidden rounded-lg border">
          {(['week', 'month'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-2 text-sm font-bold ${period === p ? 'bg-[var(--green)] text-white' : 'hover:bg-black/5'}`}
            >
              {p === 'week' ? 'Tuần' : 'Tháng'}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setDate(shift(period, date, -1))} className="rounded-lg border p-2 hover:bg-black/5" aria-label="Kỳ trước">
            <ChevronLeft size={18} />
          </button>
          <div className="min-w-[200px] text-center font-bold">{rep?.label || '…'}</div>
          <button onClick={() => setDate(shift(period, date, 1))} className="rounded-lg border p-2 hover:bg-black/5" aria-label="Kỳ sau">
            <ChevronRight size={18} />
          </button>
        </div>
        <input
          type="date"
          value={date}
          onChange={(e) => e.target.value && setDate(e.target.value)}
          className="rounded-lg border border-[var(--line)] p-2 text-sm"
        />
        <button onClick={() => setDate(dayOffset(0))} className="rounded-lg border px-3 py-2 text-sm font-bold hover:bg-black/5">
          {period === 'week' ? 'Tuần này' : 'Tháng này'}
        </button>
        {loading && <Loader2 size={18} className="animate-spin text-[var(--muted)]" />}
        {rep && (
          <span className="ml-auto text-sm text-[var(--muted)]">
            Từ {fmtDate(rep.from)} đến {fmtDate(rep.to)}
          </span>
        )}
      </div>

      {rep && (
        <>
          {/* Số liệu nhanh */}
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
            {[
              ['Tổng VKTB', rep.total, ''],
              ['Lượt bảo dưỡng', rep.activity.maintenance, 'trong kỳ'],
              ['Lượt mượn', rep.activity.borrowed, 'trong kỳ'],
              ['Lượt trả', rep.activity.returned, 'trong kỳ'],
              ['Quá hạn BD', rep.overdue, 'hiện tại', 'text-[var(--red)]'],
              ['Sắp đến hạn BD', rep.soon, 'trong 7 ngày', 'text-[var(--amber)]'],
              ['Chưa trả', rep.unreturned.length, 'hiện tại', rep.unreturned.length ? 'text-[var(--red)]' : ''],
            ].map(([k, v, s, cls]) => (
              <div key={k as string} className={`${card} p-3`}>
                <div className="text-xs font-bold uppercase text-[var(--muted)]">{k}</div>
                <div className={`font-display text-3xl font-bold ${cls || ''}`}>{v}</div>
                <div className="text-xs text-[var(--muted)]">{s}</div>
              </div>
            ))}
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <GroupTable title="Số lượng VKTB theo loại" label="Loại" rows={rep.byType} rep={rep} />
            <GroupTable title="Số lượng VKTB theo đơn vị" label="Đơn vị" rows={rep.byUnit} rep={rep} />
          </div>

          {(rep.activity.maintenanceByResult.length > 0 || rep.activity.added > 0 || rep.activity.retired > 0) && (
            <div className={`${card} mt-4 flex flex-wrap gap-x-6 gap-y-1 p-3 text-sm`}>
              <b>Trong kỳ:</b>
              {rep.activity.maintenanceByResult.map((x) => (
                <span key={x.result}>
                  Bảo dưỡng “{x.result}”: <b>{x.count}</b>
                </span>
              ))}
              <span>
                Nhập mới: <b>{rep.activity.added}</b>
              </span>
              <span>
                Thanh lý: <b>{rep.activity.retired}</b>
              </span>
            </div>
          )}

          {/* Chưa trả */}
          <div className={`${card} mt-4 p-4`}>
            <h2 className="font-display text-lg font-bold uppercase">Vũ khí đang mượn, chưa trả — {rep.unreturned.length}</h2>
            {rep.unreturned.length === 0 ? (
              <p className="mt-2 text-sm text-[var(--muted)]">Tất cả vũ khí đã được trả.</p>
            ) : (
              <div className="mt-2 overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr>
                      {['Mã QR', 'Vũ khí', 'Số hiệu', 'Người mượn', 'Mục đích', 'Mượn lúc', 'Đã mượn'].map((h) => (
                        <th key={h} className={th}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rep.unreturned.map((l) => (
                      <tr key={l.code + l.borrow_at}>
                        <td className={`${td} font-mono font-bold`}>
                          <Link href={`/scan?code=${l.code}`} className="text-[var(--green)] underline">
                            {l.code}
                          </Link>
                        </td>
                        <td className={td}>{l.name}</td>
                        <td className={td}>{l.serial}</td>
                        <td className={`${td} font-semibold`}>{l.borrower}</td>
                        <td className={td}>{l.purpose}</td>
                        <td className={td}>{fmtDateTime(l.borrow_at)}</td>
                        <td className={`${td} font-bold ${l.hoursOut >= 24 ? 'text-[var(--red)]' : ''}`}>
                          {l.hoursOut >= 24 ? `${Math.floor(l.hoursOut / 24)} ngày ${l.hoursOut % 24} giờ` : `${l.hoursOut} giờ`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Theo hạn bảo dưỡng */}
          <div className={`${card} mt-4 p-4`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-lg font-bold uppercase">Danh sách theo hạn bảo dưỡng</h2>
              <div className="flex overflow-hidden rounded-lg border text-sm">
                {(
                  [
                    ['warn', `Quá hạn + sắp đến hạn (${rep.overdue + rep.soon})`],
                    ['all', `Tất cả (${rep.due.length})`],
                  ] as const
                ).map(([k, l]) => (
                  <button
                    key={k}
                    onClick={() => setDueFilter(k)}
                    className={`px-3 py-1.5 font-bold ${dueFilter === k ? 'bg-[var(--green)] text-white' : 'hover:bg-black/5'}`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
            {due.length === 0 ? (
              <p className="mt-2 text-sm text-[var(--muted)]">Không có vũ khí quá hạn hoặc sắp đến hạn.</p>
            ) : (
              <div className="mt-2 overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead>
                    <tr>
                      {['Mã QR', 'Vũ khí', 'Số hiệu', 'Đơn vị', 'Tình trạng', 'BD gần nhất', 'Hạn tiếp theo', 'Mức'].map((h) => (
                        <th key={h} className={th}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {due.map((w) => (
                      <tr key={w.code}>
                        <td className={`${td} font-mono font-bold`}>
                          <Link href={`/scan?code=${w.code}`} className="text-[var(--green)] underline">
                            {w.code}
                          </Link>
                        </td>
                        <td className={td}>{w.name}</td>
                        <td className={td}>{w.serial}</td>
                        <td className={td}>{w.unit}</td>
                        <td className={td}>
                          <StatusBadge s={w.status} />
                        </td>
                        <td className={td}>{fmtDate(w.last_maint)}</td>
                        <td className={`${td} font-semibold`}>{fmtDate(w.next_maint)}</td>
                        <td className={td}>
                          <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-bold ${LEVEL_CLS[w.level]}`}>
                            {w.level}
                            {w.daysLeft < 0 ? ` ${-w.daysLeft} ngày` : w.level === 'Sắp đến hạn' ? ` (còn ${w.daysLeft} ngày)` : ''}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <p className="mt-3 text-xs text-[var(--muted)]">
            File Excel gồm các sheet: Tổng hợp theo loại, theo đơn vị, Hoạt động trong kỳ, Đến hạn bảo dưỡng, Chưa trả, Sổ bảo dưỡng và Sổ mượn -
            trả trong kỳ — có sẵn tiêu đề đơn vị và chỗ ký.
          </p>
        </>
      )}
    </section>
  );
}

function GroupTable({ title, label, rows, rep }: { title: string; label: string; rows: ReportGroup[]; rep: Report }) {
  return (
    <div className={`${card} p-4`}>
      <h2 className="font-display text-lg font-bold uppercase">{title}</h2>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[420px] text-sm">
          <thead>
            <tr>
              <th className={th}>{label}</th>
              <th className={`${th} text-center`}>Tổng</th>
              {rep.statuses.map((s) => (
                <th key={s} className={`${th} text-center`}>
                  {s}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name}>
                <td className={`${td} font-semibold`}>{r.name}</td>
                <td className={`${td} text-center font-bold`}>{r.total}</td>
                {r.byStatus.map((n, i) => (
                  <td key={i} className={`${td} text-center ${n ? '' : 'text-[var(--muted)]'}`}>
                    {n}
                  </td>
                ))}
              </tr>
            ))}
            <tr className="font-bold">
              <td className="px-2 py-2">Cộng</td>
              <td className="px-2 py-2 text-center">{rep.total}</td>
              {rep.statuses.map((_, i) => (
                <td key={i} className="px-2 py-2 text-center">
                  {rows.reduce((a, r) => a + r.byStatus[i], 0)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
