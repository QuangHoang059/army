'use client';

import { useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useData } from '@/components/DataProvider';
import { PageTitle, card, inputCls, labelCls } from '@/components/ui';
import { api } from '@/lib/api';
import { PhienHieuField } from '@/components/UserEditDialog';

export default function AccountPage() {
  const { user, isAdmin, setUser } = useAuth();
  const { busy, run, setFlash } = useData();
  const [f, setF] = useState({ current: '', password: '', confirm: '' });
  const [label, setLabel] = useState(user?.unitLabel || '');

  const saveLabel = async (e: React.FormEvent) => {
    e.preventDefault();
    const u = await run(() => api.updateProfile(label), 'Đã lưu phiên hiệu.');
    if (u) {
      setUser(u);
      setLabel(u.unitLabel);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (f.password !== f.confirm) {
      setFlash({ kind: 'error', text: 'Mật khẩu nhập lại không khớp.' });
      return;
    }
    const ok = await run(() => api.changePassword(f.current, f.password), 'Đã đổi mật khẩu. Các thiết bị khác đã bị đăng xuất.');
    if (ok) setF({ current: '', password: '', confirm: '' });
  };

  return (
    <section>
      <PageTitle
        title="Tài khoản của tôi"
        sub={
          <>
            {user?.fullName} • <span className="font-mono">{user?.username}</span> • {isAdmin ? 'Admin' : 'User'}
          </>
        }
      />
      <form onSubmit={saveLabel} className={`${card} mt-4 grid max-w-[520px] gap-3 p-4`}>
        <h2 className="font-bold">Phiên hiệu đơn vị</h2>
        <PhienHieuField value={label} onChange={setLabel} />
        <button
          type="submit"
          disabled={busy || label.trim().replace(/\s+/g, ' ') === (user?.unitLabel || '')}
          className="rounded-xl bg-[var(--green)] px-5 py-3 font-bold text-white disabled:opacity-50"
        >
          Lưu phiên hiệu
        </button>
      </form>

      <form onSubmit={submit} className={`${card} mt-4 grid max-w-[420px] gap-3 p-4`}>
        <h2 className="font-bold">Đổi mật khẩu</h2>
        <label className={labelCls}>
          Mật khẩu hiện tại
          <input
            type="password"
            value={f.current}
            onChange={(e) => setF({ ...f, current: e.target.value })}
            autoComplete="current-password"
            required
            className={inputCls}
          />
        </label>
        <label className={labelCls}>
          Mật khẩu mới (ít nhất 6 ký tự)
          <input
            type="password"
            value={f.password}
            onChange={(e) => setF({ ...f, password: e.target.value })}
            minLength={6}
            autoComplete="new-password"
            required
            className={inputCls}
          />
        </label>
        <label className={labelCls}>
          Nhập lại mật khẩu mới
          <input
            type="password"
            value={f.confirm}
            onChange={(e) => setF({ ...f, confirm: e.target.value })}
            minLength={6}
            autoComplete="new-password"
            required
            className={inputCls}
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="rounded-xl bg-[var(--green)] px-5 py-3 font-bold text-white disabled:opacity-50"
        >
          Đổi mật khẩu
        </button>
      </form>
    </section>
  );
}
