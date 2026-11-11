'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ChevronRight, MapPin, Pencil, Plus, Search, User } from 'lucide-react';
import { useData } from '@/components/DataProvider';
import { PhotoPicker } from '@/components/PhotoPicker';
import { WeaponEditDialog } from '@/components/WeaponEditDialog';
import { PageTitle, QrCode, StatusBadge, card, inputCls, labelCls } from '@/components/ui';
import { api } from '@/lib/api';
import { addDays, dayOffset, daysUntil, fmtDate } from '@/lib/date';
import { MAINT_INTERVAL_DAYS, STATUSES, UNITS, type Weapon } from '@/lib/types';
import { useAuth } from '@/components/AuthProvider';

const RETIRED = 'Đã thanh lý';

const EMPTY_FORM = {
  code: '',
  name: 'Súng tiểu liên STV380',
  serial: '',
  type: 'STV380',
  unit: 'Trung đội 1',
  responsible: '',
  status: 'Tốt' as Weapon['status'],
  last: dayOffset(0),
};

export default function WeaponsPage() {
  const { weapons, types, busy, run, setFlash } = useData();
  const { isAdmin } = useAuth();
  const [q, setQ] = useState('');
  const [unit, setUnit] = useState('Tất cả');
  const [status, setStatus] = useState('Tất cả');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [photo, setPhoto] = useState<{ blob: Blob; url: string } | null>(null);
  const [rows, setRows] = useState<Weapon[]>(weapons);
  const [editing, setEditing] = useState<Weapon | null>(null);

  // Lọc phía server (debounce khi gõ). Khi `weapons` thay đổi (sau thêm mới) cũng lọc lại.
  useEffect(() => {
    const t = setTimeout(() => {
      api
        .weapons(status === RETIRED ? { q, unit, retired: '1' } : { q, unit, status })
        .then(setRows)
        .catch((e) => setFlash({ kind: 'error', text: e.message }));
    }, 200);
    return () => clearTimeout(t);
  }, [q, unit, status, weapons, setFlash]);

  // Loại mặc định không còn trong danh mục (admin đã xoá / đổi tên) → chọn loại đầu tiên
  useEffect(() => {
    if (types.length && !types.some((t) => t.name === form.type)) setForm((f) => ({ ...f, type: types[0].name }));
  }, [types, form.type]);

  const next = useMemo(() => addDays(form.last, MAINT_INTERVAL_DAYS), [form.last]);

  const save = async () => {
    if (!form.serial.trim() || !form.responsible.trim()) {
      setFlash({ kind: 'error', text: 'Vui lòng nhập đủ Số hiệu súng và Người chịu trách nhiệm.' });
      return;
    }
    const code = form.code.trim().toUpperCase();
    if (code && !/^QRCB-\d{3,}$/.test(code)) {
      setFlash({ kind: 'error', text: 'Mã QR phải có dạng QRCB-xxx (ví dụ QRCB-037), hoặc để trống để tự tạo.' });
      return;
    }
    const w = await run(
      async () => {
        const w = await api.createWeapon(form);
        if (photo)
          await api.uploadPhoto(w.id, photo.blob).catch((e) => {
            throw new Error(`Đã thêm ${w.code} nhưng tải ảnh lỗi: ${e.message}. Mở "Chi tiết" để thử tải ảnh lại.`);
          });
        return w;
      },
      (w) => `Đã thêm ${w.name} — ${w.serial} (mã ${w.code}).`,
    );
    if (w) {
      setShowForm(false);
      setForm(EMPTY_FORM);
      setPhoto(null);
    }
  };

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PageTitle
          title="Danh sách Vũ khí - Trang bị"
          sub={`${rows.length} / ${weapons.length} đầu vũ khí • Mỗi vũ khí có mã QR riêng`}
        />
        {isAdmin && (
          <button
            onClick={() => setShowForm((s) => !s)}
            className="flex items-center gap-2 rounded-xl bg-[var(--red)] px-4 py-3 font-bold text-white shadow"
          >
            <Plus /> Thêm vũ khí mới
          </button>
        )}
      </div>

      {isAdmin && showForm && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
          className={`${card} mt-3 grid gap-3 p-4 md:grid-cols-3`}
        >
          <label className={labelCls}>
            Tên vũ khí
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} />
          </label>
          <label className={labelCls}>
            <span className="flex items-baseline justify-between gap-2">
              Loại
              <Link href="/admin/types" className="text-xs font-semibold text-[var(--green)] underline">
                Sửa danh mục loại
              </Link>
            </span>
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className={inputCls}>
              {types.map((t) => (
                <option key={t.id}>{t.name}</option>
              ))}
            </select>
          </label>
          <label className={labelCls}>
            Số hiệu súng
            <input
              value={form.serial}
              onChange={(e) => setForm({ ...form, serial: e.target.value })}
              placeholder="VN-037"
              className={inputCls}
            />
          </label>
          <label className={labelCls}>
            Đơn vị quản lý
            <select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className={inputCls}>
              {UNITS.map((u) => (
                <option key={u}>{u}</option>
              ))}
            </select>
          </label>
          <label className={labelCls}>
            Người chịu trách nhiệm
            <input
              value={form.responsible}
              onChange={(e) => setForm({ ...form, responsible: e.target.value })}
              className={inputCls}
            />
          </label>
          <label className={labelCls}>
            Mã QR (để trống để tự tạo)
            <input
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              placeholder="QRCB-037"
              pattern="[Qq][Rr][Cc][Bb]-\d{3,}"
              title="Dạng QRCB-xxx, ví dụ QRCB-037"
              className={inputCls}
            />
          </label>
          <label className={labelCls}>
            Ngày bảo dưỡng gần nhất
            <input
              type="date"
              value={form.last}
              onChange={(e) => e.target.value && setForm({ ...form, last: e.target.value })}
              className={inputCls}
            />
          </label>
          <label className={labelCls}>
            Ngày bảo dưỡng tiếp theo (tự động)
            <input type="date" value={next} readOnly className={`${inputCls} opacity-70`} />
          </label>
          <div className={`${labelCls} md:col-span-3`}>
            Ảnh minh hoạ (chụp bằng máy ảnh hoặc chọn từ máy — không bắt buộc)
            <div className="mt-1 flex items-end gap-3">
              <PhotoPicker src={photo?.url} width={180} onPick={(blob, url) => setPhoto({ blob, url })} />
              {photo && (
                <button type="button" onClick={() => setPhoto(null)} className="text-xs font-bold text-[var(--red)] underline">
                  Bỏ ảnh
                </button>
              )}
            </div>
          </div>
          <div className="flex items-end gap-2">
            <button
              type="submit"
              disabled={busy}
              className="rounded-xl bg-[var(--green)] px-5 py-3 font-bold text-white disabled:opacity-50"
            >
              Lưu vũ khí
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="rounded-xl border px-4 py-3 font-bold">
              Hủy
            </button>
          </div>
        </form>
      )}

      <div className={`${card} mt-4 grid gap-2 p-3 md:grid-cols-[1fr_180px_180px]`}>
        <label className="relative block">
          <Search className="absolute left-3 top-3.5 text-gray-400" size={18} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm tên, số hiệu, mã QR, người quản lý…"
            className="w-full rounded-xl border py-3 pl-10 pr-3"
          />
        </label>
        <select value={unit} onChange={(e) => setUnit(e.target.value)} className="rounded-xl border p-3 font-semibold">
          <option>Tất cả</option>
          {UNITS.map((u) => (
            <option key={u}>{u}</option>
          ))}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-xl border p-3 font-semibold">
          <option>Tất cả</option>
          {STATUSES.map((s) => (
            <option key={s}>{s}</option>
          ))}
          <option>{RETIRED}</option>
        </select>
      </div>

      {/* Bảng — màn hình lớn */}
      <div className={`${card} mt-3 hidden overflow-x-auto lg:block`}>
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="bg-[var(--green)] text-white">
            <tr>
              {['Mã QR', 'Tên vũ khí', 'Số hiệu', 'Loại', 'Đơn vị', 'Người chịu trách nhiệm', 'Tình trạng', 'Bảo dưỡng gần nhất', 'Bảo dưỡng tiếp theo', ''].map(
                (h, i) => (
                  <th key={i} className="p-3">
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((w) => {
              const over = daysUntil(w.next) < 0;
              return (
                <tr key={w.id} className="border-t align-top">
                  <td className="p-2">
                    <QrCode w={w} size={70} />
                  </td>
                  <td className="p-3 font-bold">{w.name}</td>
                  <td className="p-3 font-mono">{w.serial}</td>
                  <td className="p-3">{w.type}</td>
                  <td className="p-3">{w.unit}</td>
                  <td className="p-3">{w.responsible}</td>
                  <td className="p-3">
                    <StatusBadge s={w.retired ? RETIRED : w.status} />
                  </td>
                  <td className="p-3">{fmtDate(w.last)}</td>
                  <td className={`p-3 font-bold ${over ? 'text-[var(--red)]' : ''}`}>
                    {fmtDate(w.next)}
                    {over ? ' • Quá hạn' : ''}
                  </td>
                  <td className="p-3">
                    <div className="flex flex-col gap-1.5">
                      <Link
                        href={`/scan?code=${w.code}`}
                        className="flex items-center gap-1 whitespace-nowrap rounded-lg bg-[var(--green)] px-3 py-2 font-bold text-white"
                      >
                        Chi tiết <ChevronRight size={15} />
                      </Link>
                      {isAdmin && !w.retired && (
                        <button
                          onClick={() => setEditing(w)}
                          className="flex items-center gap-1 whitespace-nowrap rounded-lg border px-3 py-1.5 font-bold"
                        >
                          <Pencil size={14} /> Sửa
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Thẻ — di động */}
      <div className="mt-3 grid gap-3 lg:hidden">
        {rows.map((w) => (
          <article key={w.id} className={`${card} p-4`}>
            <div className="flex gap-3">
              <QrCode w={w} size={90} />
              <div className="min-w-0 flex-1">
                <b className="block">{w.name}</b>
                <div className="text-sm text-[var(--muted)]">
                  {w.serial} • {w.type}
                </div>
                <div className="mt-1 flex items-center gap-1 text-sm">
                  <MapPin size={14} />
                  {w.unit}
                </div>
                <div className="mt-1 flex items-center gap-1 text-sm">
                  <User size={14} />
                  {w.responsible}
                </div>
                <div className="mt-2">
                  <StatusBadge s={w.retired ? RETIRED : w.status} />
                </div>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between border-t pt-3 text-sm">
              <span>
                Bảo dưỡng tiếp theo:{' '}
                <b className={daysUntil(w.next) < 0 ? 'text-[var(--red)]' : ''}>{fmtDate(w.next)}</b>
              </span>
              <div className="flex gap-2">
                {isAdmin && !w.retired && (
                  <button onClick={() => setEditing(w)} className="flex items-center gap-1 rounded-lg border px-3 py-2 font-bold">
                    <Pencil size={14} /> Sửa
                  </button>
                )}
                <Link href={`/scan?code=${w.code}`} className="rounded-lg bg-[var(--green)] px-3 py-2 font-bold text-white">
                  Chi tiết
                </Link>
              </div>
            </div>
          </article>
        ))}
      </div>

      {editing && <WeaponEditDialog w={editing} onClose={() => setEditing(null)} />}

      {rows.length === 0 && (weapons.length > 0 || status === RETIRED) && (
        <p className="mt-4 rounded-xl bg-[var(--surface)] p-5 text-center font-semibold">
          Không tìm thấy vũ khí phù hợp bộ lọc.
        </p>
      )}
    </section>
  );
}
