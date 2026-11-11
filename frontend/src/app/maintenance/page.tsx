'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { useData } from '@/components/DataProvider';
import { PageTitle, card, inputCls, labelCls } from '@/components/ui';
import { api } from '@/lib/api';
import { addDays, dayOffset, fmtDate } from '@/lib/date';
import { MAINT_INTERVAL_DAYS, MAINT_RESULTS } from '@/lib/types';

const empty = () => ({ weaponCode: '', date: dayOffset(0), content: '', worker: '', result: 'Đạt' });

export default function MaintenancePage() {
  return (
    <Suspense fallback={null}>
      <Maintenance />
    </Suspense>
  );
}

function Maintenance() {
  const params = useSearchParams();
  const { weapons, maintenance, busy, run, setFlash } = useData();
  const [form, setForm] = useState(empty);

  useEffect(() => {
    const w = params.get('weapon');
    if (w) setForm((f) => ({ ...f, weaponCode: w }));
  }, [params]);

  const submit = async () => {
    if (!form.weaponCode || !form.content.trim() || !form.worker.trim()) {
      setFlash({ kind: 'error', text: 'Chọn vũ khí, nhập nội dung và người làm.' });
      return;
    }
    const r = await run(
      () => api.createMaintenance(form),
      (m) => `Đã ghi bảo dưỡng ${m.weaponCode}. Ngày bảo dưỡng tiếp theo tự động: ${fmtDate(m.nextDate)}.`,
    );
    if (r) setForm(empty());
  };

  return (
    <section>
      <PageTitle title="Sổ Bảo dưỡng" sub={`Ngày bảo dưỡng tiếp theo tự động = ngày bảo dưỡng + ${MAINT_INTERVAL_DAYS} ngày.`} />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className={`${card} mt-4 grid gap-3 p-4 md:grid-cols-2`}
      >
        <label className={labelCls}>
          Vũ khí
          <select value={form.weaponCode} onChange={(e) => setForm({ ...form, weaponCode: e.target.value })} className={inputCls}>
            <option value="">— Chọn vũ khí —</option>
            {weapons.map((w) => (
              <option key={w.id} value={w.code}>
                {w.name} • {w.serial} • {w.code}
              </option>
            ))}
          </select>
        </label>
        <label className={labelCls}>
          Ngày bảo dưỡng
          <input
            type="date"
            value={form.date}
            max={dayOffset(0)}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
            className={inputCls}
          />
        </label>
        <label className={`${labelCls} md:col-span-2`}>
          Nội dung bảo dưỡng
          <textarea
            value={form.content}
            onChange={(e) => setForm({ ...form, content: e.target.value })}
            rows={3}
            placeholder="Ví dụ: Lau chùi nòng súng, tra dầu, kiểm tra lò xo…"
            className={inputCls}
          />
        </label>
        <label className={labelCls}>
          Người làm
          <input value={form.worker} onChange={(e) => setForm({ ...form, worker: e.target.value })} className={inputCls} />
        </label>
        <label className={labelCls}>
          Kết quả
          <select value={form.result} onChange={(e) => setForm({ ...form, result: e.target.value })} className={inputCls}>
            {MAINT_RESULTS.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </label>
        <div className="rounded-xl bg-[var(--green-soft)] p-3 text-sm font-bold">
          Ngày bảo dưỡng tiếp theo (tự động): {form.date ? fmtDate(addDays(form.date, MAINT_INTERVAL_DAYS)) : '—'}
        </div>
        <button
          disabled={busy}
          type="submit"
          className="rounded-xl bg-[var(--green)] px-5 py-3 font-bold text-white disabled:opacity-50"
        >
          Lưu phiếu bảo dưỡng
        </button>
      </form>

      <div className="mt-4 grid gap-2">
        {maintenance.map((m) => (
          <article key={m.id} className={`${card} flex flex-wrap items-center gap-3 p-4`}>
            <div className="min-w-[220px] flex-1">
              <b>{m.weaponName}</b> <span className="text-sm text-[var(--muted)]">• {m.weaponCode}</span>
              <div className="mt-1 text-sm">{m.content}</div>
              <div className="mt-1 flex items-center gap-1 text-xs text-[var(--muted)]">
                <CalendarDays size={13} /> {fmtDate(m.date)} • Người làm: {m.worker} • Kết quả: {m.result}
              </div>
              {m.recordedBy && <div className="text-xs text-[var(--muted)]">Ghi bởi: {m.recordedBy}</div>}
            </div>
            <span className="rounded-lg bg-[var(--amber-soft)] px-3 py-2 text-sm font-bold">
              Hạn tiếp theo: {fmtDate(m.nextDate)}
            </span>
          </article>
        ))}
      </div>
      {maintenance.length === 0 && <p className="mt-3 rounded-xl bg-[var(--surface)] p-4 text-center">Chưa có phiếu bảo dưỡng.</p>}
    </section>
  );
}
