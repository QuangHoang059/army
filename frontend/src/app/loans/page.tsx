'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { Clock } from 'lucide-react';
import { useData } from '@/components/DataProvider';
import { PageTitle, StatusBadge, card, inputCls, labelCls } from '@/components/ui';
import { api } from '@/lib/api';
import { dateTimeOffset, daysUntil, fmtDateTime } from '@/lib/date';
import { LOAN_PURPOSES, RETURN_WEAPON_STATUSES, type Loan } from '@/lib/types';

const empty = () => ({ weaponCode: '', borrower: '', purpose: 'Gác', borrowAt: dateTimeOffset(0) });

export default function LoansPage() {
  return (
    <Suspense fallback={null}>
      <Loans />
    </Suspense>
  );
}

function Loans() {
  const params = useSearchParams();
  const { weapons, loans, busy, run, setFlash } = useData();
  const [form, setForm] = useState(empty);
  const [returning, setReturning] = useState<Loan | null>(null);

  useEffect(() => {
    const w = params.get('weapon');
    if (w) setForm((f) => ({ ...f, weaponCode: w }));
  }, [params]);

  // Chỉ cho xuất kho vũ khí "Tốt" và chưa quá hạn bảo dưỡng (backend cũng kiểm tra lại).
  const available = useMemo(() => weapons.filter((w) => w.status === 'Tốt' && daysUntil(w.next) >= 0), [weapons]);
  const borrowed = loans.filter((l) => l.status === 'Đang mượn');

  const submit = async () => {
    if (!form.weaponCode || !form.borrower.trim()) {
      setFlash({ kind: 'error', text: 'Chọn vũ khí và nhập người mượn.' });
      return;
    }
    const r = await run(() => api.createLoan(form), (l) => `Đã ghi mượn ${l.weaponName} (${l.weaponCode}) cho ${l.borrower}.`);
    if (r) setForm(empty());
  };

  return (
    <section>
      <PageTitle
        title="Sổ Bàn giao / Mượn - Trả"
        sub="Ghi bàn giao cho chiến sĩ đi gác, huấn luyện hoặc diễn tập. Khi trả, cập nhật giờ trả và tình trạng."
      />

      <div className="mt-4 rounded-2xl border-2 border-[var(--red)] bg-[var(--red-soft)] p-4">
        <h2 className="flex items-center gap-2 font-bold text-[var(--red)]">
          <Clock /> Đang mượn: {borrowed.length} vũ khí
        </h2>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {borrowed.map((l) => (
            <div key={l.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[var(--surface)] p-3">
              <div>
                <b>{l.weaponName}</b> <span className="text-xs text-[var(--muted)]">{l.weaponCode}</span>
                <div className="text-sm">
                  {l.borrower} • {l.purpose} • Mượn {fmtDateTime(l.borrowAt)}
                </div>
              </div>
              <button
                disabled={busy}
                onClick={() => setReturning(l)}
                className="rounded-lg bg-[var(--green)] px-3 py-2 text-sm font-bold text-white disabled:opacity-50"
              >
                Ghi trả
              </button>
            </div>
          ))}
        </div>
        {borrowed.length === 0 && <p className="text-sm">Không có vũ khí đang mượn.</p>}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className={`${card} mt-4 grid gap-3 p-4 md:grid-cols-2`}
      >
        <label className={labelCls}>
          Vũ khí (chỉ hiện vũ khí sẵn sàng xuất kho)
          <select value={form.weaponCode} onChange={(e) => setForm({ ...form, weaponCode: e.target.value })} className={inputCls}>
            <option value="">— Chọn vũ khí —</option>
            {/* Giữ lựa chọn từ trang Quét QR kể cả khi không sẵn sàng, để backend báo lý do */}
            {form.weaponCode && !available.some((w) => w.code === form.weaponCode) && (
              <option value={form.weaponCode}>{form.weaponCode} (không sẵn sàng)</option>
            )}
            {available.map((w) => (
              <option key={w.id} value={w.code}>
                {w.name} • {w.serial} • {w.code}
              </option>
            ))}
          </select>
        </label>
        <label className={labelCls}>
          Người mượn / nhận bàn giao
          <input value={form.borrower} onChange={(e) => setForm({ ...form, borrower: e.target.value })} className={inputCls} />
        </label>
        <label className={labelCls}>
          Mục đích
          <select value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} className={inputCls}>
            {LOAN_PURPOSES.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </label>
        <label className={labelCls}>
          Giờ mượn
          <input
            type="datetime-local"
            value={form.borrowAt}
            onChange={(e) => setForm({ ...form, borrowAt: e.target.value })}
            className={inputCls}
          />
        </label>
        <button
          disabled={busy}
          type="submit"
          className="rounded-xl bg-[var(--red)] px-5 py-3 font-bold text-white disabled:opacity-50 md:col-span-2"
        >
          Lưu phiếu mượn / bàn giao
        </button>
      </form>

      <h2 className="mt-5 font-display text-lg font-bold uppercase">Lịch sử bàn giao</h2>
      <div className="mt-3 grid gap-2">
        {loans.map((l) => (
          <article key={l.id} className={`${card} flex flex-wrap items-center gap-3 p-4`}>
            <div className="min-w-[220px] flex-1">
              <b>{l.weaponName}</b> <span className="text-xs text-[var(--muted)]">{l.weaponCode}</span>
              <div className="text-sm">
                {l.borrower} • {l.purpose}
              </div>
              <div className="text-xs text-[var(--muted)]">
                Mượn: {fmtDateTime(l.borrowAt)}{' '}
                {l.returnAt ? `• Trả: ${fmtDateTime(l.returnAt)} — ${l.returnStatus}` : '• Chưa trả'}
              </div>
              {(l.recordedBy || l.returnedBy) && (
                <div className="text-xs text-[var(--muted)]">
                  {l.recordedBy && `Ghi mượn: ${l.recordedBy}`}
                  {l.recordedBy && l.returnedBy && ' • '}
                  {l.returnedBy && `Ghi trả: ${l.returnedBy}`}
                </div>
              )}
            </div>
            <StatusBadge s={l.status} />
            {l.status === 'Đang mượn' && (
              <button
                disabled={busy}
                onClick={() => setReturning(l)}
                className="rounded-lg bg-[var(--green)] px-3 py-2 text-sm font-bold text-white disabled:opacity-50"
              >
                Ghi trả
              </button>
            )}
          </article>
        ))}
      </div>

      {returning && (
        <ReturnDialog
          loan={returning}
          busy={busy}
          onClose={() => setReturning(null)}
          onSubmit={async (b) => {
            const r = await run(() => api.returnLoan(returning.id, b), `Đã ghi trả ${returning.weaponName} (${returning.weaponCode}).`);
            if (r) setReturning(null);
          }}
        />
      )}
    </section>
  );
}

function ReturnDialog({
  loan,
  busy,
  onClose,
  onSubmit,
}: {
  loan: Loan;
  busy: boolean;
  onClose: () => void;
  onSubmit: (b: { returnAt: string; returnStatus: string; weaponStatus: string }) => void;
}) {
  const [returnAt, setReturnAt] = useState(dateTimeOffset(0));
  const [returnStatus, setReturnStatus] = useState('Tốt, đủ phụ kiện');
  const [weaponStatus, setWeaponStatus] = useState<string>('Tốt');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({ returnAt, returnStatus, weaponStatus });
        }}
        className={`${card} w-full max-w-md p-5 shadow-xl`}
      >
        <h3 className="font-display text-xl font-bold uppercase">Ghi trả vũ khí</h3>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {loan.weaponName} ({loan.weaponCode}) • {loan.borrower} • Mượn {fmtDateTime(loan.borrowAt)}
        </p>
        <label className={`${labelCls} mt-3 block`}>
          Giờ trả
          <input
            type="datetime-local"
            value={returnAt}
            min={loan.borrowAt}
            onChange={(e) => setReturnAt(e.target.value)}
            className={inputCls}
          />
        </label>
        <label className={`${labelCls} mt-3 block`}>
          Ghi chú tình trạng khi trả
          <input value={returnStatus} onChange={(e) => setReturnStatus(e.target.value)} className={inputCls} />
        </label>
        <label className={`${labelCls} mt-3 block`}>
          Tình trạng vũ khí sau khi nhận lại
          <select
            value={weaponStatus}
            onChange={(e) => {
              const v = e.target.value;
              setWeaponStatus(v);
              if (v !== 'Tốt' && returnStatus === 'Tốt, đủ phụ kiện') setReturnStatus('');
            }}
            className={inputCls}
          >
            {RETURN_WEAPON_STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          {weaponStatus !== 'Tốt' && (
            <span className="mt-1 block text-xs font-normal text-[var(--red)]">
              Vũ khí sẽ chuyển sang “{weaponStatus}” — chưa cho mượn tiếp được. Ghi rõ hư hỏng ở ô ghi chú.
            </span>
          )}
        </label>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-xl border px-4 py-2 font-bold">
            Hủy
          </button>
          <button disabled={busy} type="submit" className="rounded-xl bg-[var(--green)] px-4 py-2 font-bold text-white disabled:opacity-50">
            Xác nhận trả
          </button>
        </div>
      </form>
    </div>
  );
}
