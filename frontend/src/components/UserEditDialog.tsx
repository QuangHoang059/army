'use client';

import { useEffect, useState } from 'react';
import { Shield, X } from 'lucide-react';
import { useData } from '@/components/DataProvider';
import { card, inputCls, labelCls } from '@/components/ui';
import { api } from '@/lib/api';
import type { User } from '@/lib/types';

const DEFAULT_TITLE = 'Quản lý Vũ khí - Trang bị';
const SUGGEST = ['Trung đội 1 — Đại đội 7', 'Trung đội 2 — Đại đội 7', 'Trung đội 3 — Đại đội 7', 'Đại đội 7 — Tiểu đoàn 1'];

/** Xem trước dải tiêu đề đầu trang với phiên hiệu đang nhập. */
export function HeaderPreview({ label }: { label: string }) {
  return (
    <div className="overflow-hidden rounded-xl border-b-4 border-[var(--gold)] bg-[var(--green)] px-3 py-2.5 text-white shadow">
      <div className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[var(--green)]">
          <Shield size={20} />
        </div>
        <div className="min-w-0">
          <div className="truncate font-display text-base font-bold uppercase leading-tight sm:text-lg">
            {label.trim() || DEFAULT_TITLE}
          </div>
          <div className="text-[11px] font-semibold text-green-100">Quản lý Vũ khí - Trang bị bằng mã QR</div>
        </div>
      </div>
    </div>
  );
}

/** Hộp thoại admin sửa họ tên + phiên hiệu đơn vị của 1 tài khoản. */
export function UserEditDialog({ u, onClose, onSaved }: { u: User; onClose: () => void; onSaved: (u: User) => void }) {
  const { busy, run } = useData();
  const [fullName, setFullName] = useState(u.fullName);
  const [unitLabel, setUnitLabel] = useState(u.unitLabel);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const patch: { fullName?: string; unitLabel?: string } = {};
  if (fullName.trim() !== u.fullName) patch.fullName = fullName.trim();
  if (unitLabel.trim().replace(/\s+/g, ' ') !== u.unitLabel) patch.unitLabel = unitLabel;
  const changed = Object.keys(patch).length > 0;

  const save = async () => {
    if (!changed) return onClose();
    const r = await run(() => api.updateUser(u.id, patch), `Đã cập nhật tài khoản ${u.username}.`);
    if (r) {
      onSaved(r);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-3 sm:p-6" onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
        className={`${card} my-auto w-full max-w-lg p-4 shadow-xl`}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-bold uppercase">Sửa tài khoản</h2>
            <p className="font-mono text-sm text-[var(--muted)]">{u.username}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 hover:bg-black/5" aria-label="Đóng">
            <X />
          </button>
        </div>

        <div className="mt-3 grid gap-3">
          <label className={labelCls}>
            Họ tên
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} required className={inputCls} />
          </label>
          <PhienHieuField value={unitLabel} onChange={setUnitLabel} autoFocus />
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-xl border px-4 py-3 font-bold">
            Hủy
          </button>
          <button
            type="submit"
            disabled={busy || !changed || !fullName.trim()}
            className="rounded-xl bg-[var(--green)] px-5 py-3 font-bold text-white disabled:opacity-50"
          >
            Lưu thay đổi
          </button>
        </div>
      </form>
    </div>
  );
}

/** Ô nhập phiên hiệu + gợi ý nhanh + xem trước tiêu đề. Dùng ở hộp thoại admin và trang Tài khoản của tôi. */
export function PhienHieuField({
  value,
  onChange,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  autoFocus?: boolean;
}) {
  return (
    <div className="grid gap-2">
      <label className={labelCls}>
        Phiên hiệu đơn vị
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="vd: Trung đội 2 — Đại đội 7"
          maxLength={100}
          autoFocus={autoFocus}
          className={inputCls}
        />
        <span className="mt-1 flex justify-between text-xs font-normal text-[var(--muted)]">
          <span>Hiện trên đầu trang khi tài khoản này đăng nhập. Để trống = tiêu đề mặc định.</span>
          <span>{value.length}/100</span>
        </span>
      </label>
      <div className="flex flex-wrap gap-1.5">
        {SUGGEST.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onChange(s)}
            className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
              value.trim() === s ? 'border-[var(--green)] bg-[var(--green-soft)] text-[var(--green)]' : 'hover:bg-black/5'
            }`}
          >
            {s}
          </button>
        ))}
        <button type="button" onClick={() => onChange(`${value.trimEnd()} — `)} className="rounded-full border px-2.5 py-1 text-xs font-semibold hover:bg-black/5">
          Chèn “ — ”
        </button>
      </div>
      <div>
        <div className="mb-1 text-xs font-bold uppercase text-[var(--muted)]">Xem trước</div>
        <HeaderPreview label={value} />
      </div>
    </div>
  );
}
