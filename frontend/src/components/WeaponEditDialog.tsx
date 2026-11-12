'use client';

import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { useData } from '@/components/DataProvider';
import { card, inputCls, labelCls } from '@/components/ui';
import { api } from '@/lib/api';
import { addDays, fmtDate } from '@/lib/date';
import { MAINT_INTERVAL_DAYS, type Weapon } from '@/lib/types';

const FIELDS = ['name', 'type', 'serial', 'unit', 'responsible', 'code', 'last'] as const;
type Form = Pick<Weapon, (typeof FIELDS)[number]>;

/** Hộp thoại sửa thông tin vũ khí (admin). Tình trạng đổi ở thẻ chi tiết / khi ghi mượn-trả, không sửa ở đây. */
export function WeaponEditDialog({ w, onClose }: { w: Weapon; onClose: () => void }) {
  const { types, units, busy, run, setFlash } = useData();
  const init = useMemo<Form>(
    () => ({ name: w.name, type: w.type, serial: w.serial, unit: w.unit, responsible: w.responsible, code: w.code, last: w.last }),
    [w],
  );
  const [form, setForm] = useState<Form>(init);
  const set = (k: keyof Form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Chỉ gửi trường đã đổi (không đổi ngày gần nhất thì giữ nguyên hạn tiếp theo hiện tại)
  const changed = FIELDS.filter((k) => String(form[k]).trim() !== String(init[k]));
  const next = form.last !== init.last ? addDays(form.last, MAINT_INTERVAL_DAYS) : w.next;
  const qrChanged = changed.some((k) => ['name', 'type', 'serial', 'unit', 'responsible', 'code'].includes(k));

  const save = async () => {
    if (!changed.length) return onClose();
    for (const k of ['name', 'serial', 'responsible', 'code'] as const)
      if (!form[k].trim()) return setFlash({ kind: 'error', text: 'Tên, số hiệu, người chịu trách nhiệm và mã QR không được để trống.' });
    if (!/^QRCB-\d{3,}$/i.test(form.code.trim()))
      return setFlash({ kind: 'error', text: 'Mã QR phải có dạng QRCB-xxx (ví dụ QRCB-037).' });
    const body = Object.fromEntries(changed.map((k) => [k, String(form[k]).trim()]));
    const r = await run(
      () => api.updateWeapon(w.id, body),
      (x) => `Đã lưu thông tin ${x.code}.${qrChanged ? ' Thông tin trên tem QR đã đổi — nhớ in lại tem.' : ''}`,
    );
    if (r) onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-3 sm:p-6" onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
        className={`${card} my-auto w-full max-w-3xl p-4 shadow-xl`}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-bold uppercase">Sửa thông tin vũ khí</h2>
            <p className="text-sm text-[var(--muted)]">
              {w.code} • {w.name} — {w.serial}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 hover:bg-black/5" aria-label="Đóng">
            <X />
          </button>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <label className={labelCls}>
            Tên vũ khí
            <input value={form.name} onChange={(e) => set('name', e.target.value)} className={inputCls} />
          </label>
          <label className={labelCls}>
            Loại
            <select value={form.type} onChange={(e) => set('type', e.target.value)} className={inputCls}>
              {!types.some((t) => t.name === form.type) && <option>{form.type}</option>}
              {types.map((t) => (
                <option key={t.id}>{t.name}</option>
              ))}
            </select>
          </label>
          <label className={labelCls}>
            Số hiệu súng
            <input value={form.serial} onChange={(e) => set('serial', e.target.value)} className={inputCls} />
          </label>
          <label className={labelCls}>
            Đơn vị quản lý
            <select value={form.unit} onChange={(e) => set('unit', e.target.value)} className={inputCls}>
              {!units.some((u) => u.name === form.unit) && <option>{form.unit}</option>}
              {units.map((u) => (
                <option key={u.id}>{u.name}</option>
              ))}
            </select>
          </label>
          <label className={labelCls}>
            Người chịu trách nhiệm
            <input value={form.responsible} onChange={(e) => set('responsible', e.target.value)} className={inputCls} />
          </label>
          <label className={labelCls}>
            Mã QR
            <input
              value={form.code}
              onChange={(e) => set('code', e.target.value)}
              pattern="[Qq][Rr][Cc][Bb]-\d{3,}"
              title="Dạng QRCB-xxx, ví dụ QRCB-037"
              className={`${inputCls} font-mono uppercase`}
            />
          </label>
          <label className={labelCls}>
            Ngày bảo dưỡng gần nhất
            <input
              type="date"
              value={form.last}
              onChange={(e) => e.target.value && set('last', e.target.value)}
              className={inputCls}
            />
          </label>
          <div className={labelCls}>
            Bảo dưỡng tiếp theo
            <div className="mt-1 rounded-lg border border-[var(--line)] p-2.5 font-normal opacity-70">
              {fmtDate(next)}
              {form.last !== init.last ? ' (tính lại)' : ''}
            </div>
          </div>
        </div>
        {form.code.trim().toUpperCase() !== init.code && (
          <p className="mt-3 rounded-lg bg-[var(--amber-soft)] p-2 text-sm font-semibold text-[var(--amber)]">
            Đổi mã QR: tem cũ ({init.code}) sẽ không quét ra vũ khí này nữa — cần in và dán tem mới.
          </p>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-xl border px-4 py-3 font-bold">
            Hủy
          </button>
          <button
            type="submit"
            disabled={busy || !changed.length}
            className="rounded-xl bg-[var(--green)] px-5 py-3 font-bold text-white disabled:opacity-50"
          >
            Lưu thay đổi
          </button>
        </div>
      </form>
    </div>
  );
}
