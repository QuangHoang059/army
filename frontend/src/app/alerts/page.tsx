'use client';

import Link from 'next/link';
import { useData } from '@/components/DataProvider';
import { PageTitle } from '@/components/ui';
import { daysUntil, fmtDate } from '@/lib/date';
import type { Weapon } from '@/lib/types';

export default function AlertsPage() {
  const { alerts } = useData();

  return (
    <section>
      <PageTitle title="Cảnh báo bảo dưỡng" sub="Theo dõi vũ khí sắp đến hạn trong 7 ngày và vũ khí đã quá hạn." />

      <div className="mt-4 rounded-2xl border-2 border-[var(--red)] bg-[var(--red-soft)] p-4">
        <h2 className="font-display text-lg font-bold uppercase text-[var(--red)]">
          Quá hạn bảo dưỡng — {alerts.overdue.length} vũ khí
        </h2>
        {alerts.overdue.length === 0 ? (
          <p className="mt-2 text-sm">Không có vũ khí quá hạn.</p>
        ) : (
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {alerts.overdue.map((w) => (
              <AlertCard key={w.id} w={w} overdue />
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 rounded-2xl border border-amber-300 bg-[var(--amber-soft)] p-4">
        <h2 className="font-display text-lg font-bold uppercase text-[var(--amber)]">
          Sắp đến hạn trong 7 ngày — {alerts.soon.length} vũ khí
        </h2>
        {alerts.soon.length === 0 ? (
          <p className="mt-2 text-sm">Không có vũ khí sắp đến hạn.</p>
        ) : (
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {alerts.soon.map((w) => (
              <AlertCard key={w.id} w={w} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function AlertCard({ w, overdue = false }: { w: Weapon; overdue?: boolean }) {
  const d = daysUntil(w.next);
  return (
    <div className="rounded-xl bg-[var(--surface)] p-3">
      <div className="flex justify-between gap-2">
        <Link href={`/scan?code=${w.code}`} className="font-bold hover:underline">
          {w.name}
        </Link>
        <span className={`font-bold ${overdue ? 'text-[var(--red)]' : 'text-[var(--amber)]'}`}>
          {overdue ? `Quá ${Math.abs(d)} ngày` : `Còn ${d} ngày`}
        </span>
      </div>
      <div className="text-sm text-[var(--muted)]">
        {w.serial} • {w.unit} • {w.responsible}
      </div>
      <div className="text-sm">Hạn: {fmtDate(w.next)}</div>
      <Link
        href={`/maintenance?weapon=${w.code}`}
        className={`mt-2 inline-block rounded-lg px-3 py-2 text-sm font-bold text-white ${overdue ? 'bg-[var(--red)]' : 'bg-[var(--green)]'}`}
      >
        {overdue ? 'Ghi bảo dưỡng ngay' : 'Xếp lịch bảo dưỡng'}
      </Link>
    </div>
  );
}
