'use client';

import Link from 'next/link';
import { TriangleAlert } from 'lucide-react';
import { useData } from '@/components/DataProvider';
import { StatusBadge, card } from '@/components/ui';
import { daysUntil, fmtDateTime } from '@/lib/date';

export default function DashboardPage() {
  const { stats, alerts, loans } = useData();
  if (!stats) return null;

  const tiles = [
    { l: 'Tổng số vũ khí', v: stats.total, sub: 'đầu vũ khí / trang bị', c: 'bg-[var(--green)]' },
    { l: 'Đang sử dụng (Tốt)', v: stats.using, sub: 'sẵn sàng nhiệm vụ', c: 'bg-emerald-600' },
    { l: 'Đang bảo dưỡng', v: stats.maint, sub: 'tạm ngừng xuất kho', c: 'bg-[var(--amber)]' },
    { l: 'Sắp đến hạn (7 ngày)', v: stats.soon, sub: 'cần xếp lịch', c: 'bg-orange-600' },
    { l: 'Cảnh báo quá hạn', v: stats.over, sub: 'ưu tiên xử lý', c: 'bg-[var(--red)]' },
  ];
  const maxType = Math.max(1, ...stats.byType.map((t) => t.count));
  const borrowed = loans.filter((l) => l.status === 'Đang mượn');

  return (
    <section>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {tiles.map((t) => (
          <div key={t.l} className={`${card} p-4 shadow-sm`}>
            <div className={`inline-flex rounded-lg px-2 py-1 text-[11px] font-bold uppercase text-white ${t.c}`}>{t.l}</div>
            <div className="mt-2 font-display text-4xl font-bold">{t.v}</div>
            <div className="text-xs text-[var(--muted)]">{t.sub}</div>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className={`${card} p-4`}>
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold uppercase">Cơ cấu theo loại vũ khí</h2>
            <Link href="/weapons" className="text-sm font-bold text-[var(--green)]">
              Xem danh sách →
            </Link>
          </div>
          <div className="mt-4 space-y-3">
            {stats.byType.map(({ type, count }) => (
              <div key={type}>
                <div className="flex justify-between text-sm">
                  <b>{type}</b>
                  <span>{count} đầu</span>
                </div>
                <div className="mt-1 h-3 overflow-hidden rounded-full bg-gray-200">
                  <div
                    className="h-full rounded-full bg-[var(--green)]"
                    style={{ width: `${Math.round((count / maxType) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-red-200 bg-[var(--red-soft)] p-4">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold uppercase text-[var(--red)]">
            <TriangleAlert /> Cần xử lý ngay
          </h2>
          {alerts.overdue.length === 0 ? (
            <p className="mt-2 text-sm">Không có vũ khí quá hạn bảo dưỡng.</p>
          ) : (
            alerts.overdue.slice(0, 5).map((w) => (
              <Link
                key={w.id}
                href={`/scan?code=${w.code}`}
                className="mt-2 flex w-full items-center justify-between rounded-lg bg-[var(--surface)] px-3 py-2 text-left text-sm"
              >
                <span>
                  <b>{w.name}</b>
                  <br />
                  <span className="text-xs">
                    {w.serial} • {w.unit}
                  </span>
                </span>
                <span className="font-bold text-[var(--red)]">Quá {Math.abs(daysUntil(w.next))} ngày</span>
              </Link>
            ))
          )}
          <Link
            href="/alerts"
            className="mt-3 block w-full rounded-lg bg-[var(--red)] py-2 text-center text-sm font-bold text-white"
          >
            Mở toàn bộ cảnh báo
          </Link>
        </div>
      </div>

      <div className={`${card} mt-4 p-4`}>
        <h2 className="font-display text-lg font-bold uppercase">Đang mượn — cần theo dõi</h2>
        {borrowed.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--muted)]">Không có vũ khí đang mượn.</p>
        ) : (
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {borrowed.map((l) => (
              <div key={l.id} className="flex items-center justify-between rounded-xl border p-3">
                <div>
                  <b>{l.weaponName}</b>
                  <div className="text-xs text-[var(--muted)]">
                    {l.borrower} • {l.purpose} • Mượn {fmtDateTime(l.borrowAt)}
                  </div>
                </div>
                <StatusBadge s="Đang mượn" />
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
