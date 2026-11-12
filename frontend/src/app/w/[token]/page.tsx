'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Loader2, Shield } from 'lucide-react';
import { StatusBadge, card } from '@/components/ui';
import { api } from '@/lib/api';
import { daysUntil, fmtDate } from '@/lib/date';
import type { PublicWeapon } from '@/lib/types';

/**
 * Trang mở ra khi quét tem QR bằng điện thoại — KHÔNG cần đăng nhập.
 * Chỉ hiện thông tin của đúng vũ khí trên tem: không menu, không lịch sử, không link sang phần khác của app.
 */
export default function PublicWeaponPage() {
  const { token } = useParams<{ token: string }>();
  const [w, setW] = useState<PublicWeapon | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    api
      .publicWeapon(token)
      .then(setW)
      .catch((e: Error) => setErr(e.message));
  }, [token]);

  const left = w?.next ? daysUntil(w.next) : null;

  return (
    <main className="min-h-screen bg-[var(--bg)] px-4 py-6 text-[var(--ink)]">
      <div className="mx-auto max-w-md">
        <div className="flex items-center gap-2.5 rounded-t-2xl border-b-4 border-[var(--gold)] bg-[var(--green)] px-4 py-3 text-white">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[var(--green)]">
            <Shield size={20} />
          </div>
          <div className="font-display text-lg font-bold uppercase leading-tight">Thông tin vũ khí - trang bị</div>
        </div>

        <div className={`${card} rounded-t-none p-4`}>
          {err ? (
            <p className="py-8 text-center font-semibold text-[var(--red)]">{err}</p>
          ) : !w ? (
            <div className="flex justify-center py-10 text-[var(--muted)]">
              <Loader2 className="animate-spin" />
            </div>
          ) : (
            <>
              {w.hasPhoto && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/api/public/w/${encodeURIComponent(token)}/photo`}
                  alt={w.name}
                  referrerPolicy="no-referrer"
                  className="mb-4 max-h-72 w-full rounded-xl border object-contain"
                />
              )}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h1 className="text-xl font-extrabold leading-tight">{w.name}</h1>
                  <div className="font-mono text-sm font-bold tracking-wider text-[var(--muted)]">{w.code}</div>
                </div>
                <StatusBadge s={w.status} />
              </div>

              <dl className="mt-4 divide-y divide-[var(--line)] border-y border-[var(--line)] text-sm">
                {[
                  ['Loại', w.type],
                  ['Số hiệu', w.serial],
                  ['Đơn vị quản lý', w.unit],
                  ['Người chịu trách nhiệm', w.responsible],
                  ['Bảo dưỡng gần nhất', fmtDate(w.last)],
                  ['Bảo dưỡng tiếp theo', fmtDate(w.next)],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4 py-2.5">
                    <dt className="text-[var(--muted)]">{k}</dt>
                    <dd className="text-right font-semibold">{v || '—'}</dd>
                  </div>
                ))}
              </dl>

              {!w.retired && left !== null && (
                <p
                  className={`mt-3 rounded-lg p-2 text-center text-sm font-bold ${
                    left < 0
                      ? 'bg-[var(--red-soft)] text-[var(--red)]'
                      : left <= 7
                        ? 'bg-[var(--amber-soft)] text-[var(--amber)]'
                        : 'bg-[var(--green-soft)] text-[var(--green)]'
                  }`}
                >
                  {left < 0 ? `Quá hạn bảo dưỡng ${-left} ngày` : left === 0 ? 'Đến hạn bảo dưỡng hôm nay' : `Còn ${left} ngày đến hạn bảo dưỡng`}
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}
