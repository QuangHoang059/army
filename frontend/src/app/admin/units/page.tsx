'use client';

import { useState } from 'react';
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import { AdminOnly } from '@/components/AuthProvider';
import { useData } from '@/components/DataProvider';
import { PageTitle, card, inputCls } from '@/components/ui';
import { api } from '@/lib/api';
import type { WeaponType } from '@/lib/types';

export default function UnitsPage() {
  return (
    <AdminOnly>
      <Units />
    </AdminOnly>
  );
}

function Units() {
  const { units, busy, run } = useData();
  const [name, setName] = useState('');

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    const t = await run(() => api.createUnit(n), (t) => `Đã thêm đơn vị "${t.name}".`);
    if (t) setName('');
  };

  return (
    <section>
      <PageTitle
        title="Danh mục đơn vị quản lý"
        sub="Danh sách hiện trong ô “Đơn vị quản lý” khi thêm / sửa vũ khí. Đổi tên một đơn vị sẽ đổi luôn cho các vũ khí thuộc đơn vị đó."
      />

      <form onSubmit={add} className={`${card} mt-4 flex flex-wrap gap-2 p-3`}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Tên đơn vị mới, ví dụ: Trung đội 1"
          maxLength={60}
          className="min-w-0 flex-1 rounded-xl border p-3"
        />
        <button
          type="submit"
          disabled={busy || !name.trim()}
          className="flex items-center gap-2 rounded-xl bg-[var(--green)] px-4 py-3 font-bold text-white disabled:opacity-50"
        >
          <Plus size={18} /> Thêm đơn vị
        </button>
      </form>

      <div className={`${card} mt-3 divide-y`}>
        {units.map((t) => (
          <TypeRow key={t.id} t={t} />
        ))}
        {units.length === 0 && <p className="p-5 text-center font-semibold">Chưa có đơn vị nào.</p>}
      </div>
    </section>
  );
}

function TypeRow({ t }: { t: WeaponType }) {
  const { busy, run } = useData();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(t.name);

  const save = async () => {
    const n = name.trim();
    if (!n || n === t.name) return setEditing(false);
    const ok = await run(
      () => api.renameUnit(t.id, n),
      (r) => `Đã đổi "${t.name}" thành "${r.name}"${t.count ? ` (cập nhật ${t.count} vũ khí)` : ''}.`,
    );
    if (ok) setEditing(false);
  };

  const remove = () => {
    if (!confirm(`Xoá đơn vị "${t.name}" khỏi danh mục?`)) return;
    run(() => api.deleteUnit(t.id), `Đã xoá đơn vị "${t.name}".`);
  };

  return (
    <div className="flex flex-wrap items-center gap-2 px-4 py-3">
      {editing ? (
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') save();
            if (e.key === 'Escape') setEditing(false);
          }}
          autoFocus
          maxLength={60}
          className={`${inputCls} mt-0 min-w-0 flex-1`}
        />
      ) : (
        <b className="min-w-0 flex-1">{t.name}</b>
      )}
      <span className="rounded-full bg-[var(--green-soft)] px-2.5 py-1 text-xs font-bold">{t.count} vũ khí</span>
      {editing ? (
        <>
          <button onClick={save} disabled={busy} aria-label="Lưu" className="rounded-lg bg-[var(--green)] p-2 text-white disabled:opacity-50">
            <Check size={16} />
          </button>
          <button
            onClick={() => {
              setName(t.name);
              setEditing(false);
            }}
            aria-label="Huỷ"
            className="rounded-lg border p-2"
          >
            <X size={16} />
          </button>
        </>
      ) : (
        <>
          <button onClick={() => setEditing(true)} aria-label={`Đổi tên ${t.name}`} title="Đổi tên" className="rounded-lg border p-2">
            <Pencil size={16} />
          </button>
          <button
            onClick={remove}
            disabled={busy || t.count > 0}
            aria-label={`Xoá ${t.name}`}
            title={t.count > 0 ? 'Còn vũ khí thuộc đơn vị này (kể cả đã thanh lý) — không xoá được' : 'Xoá'}
            className="rounded-lg border border-red-300 p-2 text-[var(--red)] disabled:opacity-40"
          >
            <Trash2 size={16} />
          </button>
        </>
      )}
    </div>
  );
}
