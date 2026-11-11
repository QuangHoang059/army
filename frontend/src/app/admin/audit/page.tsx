'use client';

import { useCallback, useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { AdminOnly } from '@/components/AuthProvider';
import { useData } from '@/components/DataProvider';
import { PageTitle, card } from '@/components/ui';
import { api } from '@/lib/api';
import type { AuditEntry } from '@/lib/types';

const GROUPS: [string, string][] = [
  ['', 'Tất cả thao tác'],
  ['weapon', 'Vũ khí (thêm / sửa / thanh lý / ảnh)'],
  ['maint', 'Bảo dưỡng'],
  ['loan', 'Mượn - trả'],
  ['type', 'Loại trang bị'],
  ['user', 'Tài khoản'],
  ['auth', 'Đăng nhập / đổi mật khẩu'],
  ['backup', 'Sao lưu'],
];

const ACTION_LABEL: Record<string, string> = {
  'weapon.create': 'Thêm vũ khí',
  'weapon.update': 'Sửa vũ khí',
  'weapon.status': 'Đổi tình trạng',
  'weapon.retire': 'Thanh lý',
  'weapon.restore': 'Khôi phục',
  'weapon.delete': 'Xoá vũ khí',
  'weapon.photo': 'Ảnh vũ khí',
  'weapon.photo.delete': 'Xoá ảnh',
  'maint.create': 'Ghi bảo dưỡng',
  'loan.create': 'Ghi mượn',
  'loan.return': 'Ghi trả',
  'type.create': 'Thêm loại',
  'type.rename': 'Đổi tên loại',
  'type.delete': 'Xoá loại',
  'user.create': 'Tạo tài khoản',
  'user.update': 'Sửa tài khoản',
  'user.delete': 'Xoá tài khoản',
  'auth.login': 'Đăng nhập',
  'auth.password': 'Đổi mật khẩu',
  'backup.create': 'Sao lưu',
};

const fmtAt = (iso: string) =>
  new Date(iso).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });

export default function AuditPage() {
  return (
    <AdminOnly>
      <Audit />
    </AdminOnly>
  );
}

function Audit() {
  const { setFlash } = useData();
  const [q, setQ] = useState('');
  const [action, setAction] = useState('');
  const [items, setItems] = useState<AuditEntry[]>([]);
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = useCallback(
    async (before?: number) => {
      setLoading(true);
      try {
        const r = await api.audit({ q: q.trim(), action, before, limit: 100 });
        setItems((cur) => (before ? [...cur, ...r.items] : r.items));
        setMore(r.more);
      } catch (e) {
        setFlash({ kind: 'error', text: (e as Error).message });
      } finally {
        setLoading(false);
      }
    },
    [q, action, setFlash],
  );

  useEffect(() => {
    const t = setTimeout(() => load(), 250);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <section>
      <PageTitle
        title="Nhật ký thao tác"
        sub="Ghi lại ai đã làm gì, lúc nào: thêm / sửa / thanh lý vũ khí, ghi bảo dưỡng, mượn - trả, tài khoản, đăng nhập. Không sửa / xoá được."
      />
      <div className={`${card} mt-4 grid gap-2 p-3 md:grid-cols-[1fr_280px]`}>
        <label className="relative block">
          <Search className="absolute left-3 top-3.5 text-gray-400" size={18} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm theo mã QR, số hiệu, người thao tác, nội dung…"
            className="w-full rounded-xl border py-3 pl-10 pr-3"
          />
        </label>
        <select value={action} onChange={(e) => setAction(e.target.value)} className="rounded-xl border p-3 font-semibold">
          {GROUPS.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </div>

      <div className={`${card} mt-3 overflow-x-auto`}>
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-[var(--green)] text-white">
            <tr>
              <th className="p-3">Thời gian</th>
              <th className="p-3">Người thao tác</th>
              <th className="p-3">Thao tác</th>
              <th className="p-3">Nội dung</th>
            </tr>
          </thead>
          <tbody>
            {items.map((a) => (
              <tr key={a.id} className="border-t align-top">
                <td className="whitespace-nowrap p-3">{fmtAt(a.at)}</td>
                <td className="p-3 font-semibold">{a.actor}</td>
                <td className="whitespace-nowrap p-3">
                  <span className="rounded-full bg-[var(--green-soft)] px-2 py-0.5 text-xs font-bold text-[var(--green)]">
                    {ACTION_LABEL[a.action] || a.action}
                  </span>
                </td>
                <td className="p-3">{a.summary}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && items.length === 0 && <p className="p-5 text-center font-semibold">Không có dòng nhật ký nào.</p>}
      </div>
      {more && (
        <button
          disabled={loading}
          onClick={() => load(items[items.length - 1]?.id)}
          className="mx-auto mt-3 block rounded-xl border px-5 py-2.5 font-bold disabled:opacity-50"
        >
          {loading ? 'Đang tải…' : 'Xem thêm'}
        </button>
      )}
    </section>
  );
}
