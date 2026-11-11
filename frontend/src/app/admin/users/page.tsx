'use client';

import { useCallback, useEffect, useState } from 'react';
import { KeyRound, Lock, Pencil, Plus, Trash2, Unlock } from 'lucide-react';
import { AdminOnly, useAuth } from '@/components/AuthProvider';
import { useData } from '@/components/DataProvider';
import { PageTitle, card, inputCls, labelCls } from '@/components/ui';
import { UserEditDialog } from '@/components/UserEditDialog';
import { api } from '@/lib/api';
import type { Role, User } from '@/lib/types';

const ROLE_LABEL: Record<Role, string> = { admin: 'Admin — toàn quyền', user: 'User — xem, ghi bảo dưỡng, mượn trả' };
const EMPTY = { username: '', fullName: '', unitLabel: '', role: 'user' as Role, password: '' };

export default function UsersPage() {
  return (
    <AdminOnly>
      <Users />
    </AdminOnly>
  );
}

function Users() {
  const { busy, run, setFlash } = useData();
  const { user: me, setUser } = useAuth();
  const [editing, setEditing] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [form, setForm] = useState(EMPTY);

  const load = useCallback(() => api.users().then(setUsers).catch((e) => setFlash({ kind: 'error', text: e.message })), [setFlash]);
  useEffect(() => {
    load();
  }, [load]);

  /** Chạy thao tác rồi tải lại danh sách tài khoản. */
  const act = async <T,>(fn: () => Promise<T>, msg: string | ((r: T) => string)) => {
    const r = await run(fn, msg);
    await load();
    return r;
  };

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const u = await act(() => api.createUser({ ...form, username: form.username.trim(), fullName: form.fullName.trim(), unitLabel: form.unitLabel.trim() }), (u) => `Đã tạo tài khoản ${u.username}.`);
    if (u) setForm(EMPTY);
  };

  const resetPassword = (u: User) => {
    const pw = prompt(`Mật khẩu mới cho ${u.username} (ít nhất 6 ký tự):`);
    if (pw) act(() => api.updateUser(u.id, { password: pw }), `Đã đặt lại mật khẩu cho ${u.username}.`);
  };

  return (
    <section>
      <PageTitle
        title="Tài khoản"
        sub="Admin: thêm / sửa / xoá vũ khí, quản lý loại trang bị và tài khoản. User: xem, quét QR, ghi bảo dưỡng, ghi mượn — trả."
      />

      <form onSubmit={add} className={`${card} mt-4 grid gap-3 p-4 md:grid-cols-4`}>
        <label className={labelCls}>
          Tên đăng nhập
          <input
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            placeholder="vd: trungdoi1"
            pattern="[a-zA-Z0-9._\-]{3,32}"
            title="3–32 ký tự: chữ không dấu, số, dấu chấm, gạch dưới, gạch ngang"
            autoCapitalize="none"
            autoComplete="off"
            required
            className={inputCls}
          />
        </label>
        <label className={labelCls}>
          Họ tên
          <input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required className={inputCls} />
        </label>
        <label className={`${labelCls} md:col-span-2`}>
          Phiên hiệu đơn vị (hiện trên đầu trang)
          <input
            value={form.unitLabel}
            onChange={(e) => setForm({ ...form, unitLabel: e.target.value })}
            placeholder="vd: Trung đội 2 — Đại đội 7"
            maxLength={100}
            className={inputCls}
          />
        </label>
        <label className={labelCls}>
          Vai trò
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })} className={inputCls}>
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>
        </label>
        <label className={labelCls}>
          Mật khẩu
          <input
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            minLength={6}
            autoComplete="new-password"
            required
            className={inputCls}
          />
        </label>
        <div className="md:col-span-4">
          <button
            type="submit"
            disabled={busy}
            className="flex items-center gap-2 rounded-xl bg-[var(--green)] px-5 py-3 font-bold text-white disabled:opacity-50"
          >
            <Plus size={18} /> Tạo tài khoản
          </button>
        </div>
      </form>

      <div className={`${card} mt-3 divide-y`}>
        {users.map((u) => {
          const self = u.id === me?.id;
          return (
            <div key={u.id} className={`flex flex-wrap items-center gap-3 px-4 py-3 ${u.active ? '' : 'opacity-60'}`}>
              <div className="min-w-[180px] flex-1">
                <b>{u.fullName}</b> {self && <span className="text-xs font-bold text-[var(--green)]">(bạn)</span>}
                <div className="font-mono text-sm text-[var(--muted)]">
                  {u.username}
                  {!u.active && <span className="ml-2 font-sans font-bold text-[var(--red)]">• Đã khoá</span>}
                </div>
                <button
                  onClick={() => setEditing(u)}
                  disabled={busy}
                  title="Sửa họ tên / phiên hiệu đơn vị"
                  className="mt-0.5 flex items-center gap-1 text-left text-sm font-semibold text-[var(--green)] disabled:opacity-40"
                >
                  <Pencil size={13} /> {u.unitLabel || <i className="font-normal text-[var(--muted)]">Chưa đặt phiên hiệu</i>}
                </button>
              </div>
              <select
                value={u.role}
                disabled={busy || self}
                title={self ? 'Không thể tự đổi quyền của chính mình' : 'Đổi vai trò'}
                onChange={(e) => {
                  const role = e.target.value as Role;
                  act(() => api.updateUser(u.id, { role }), `${u.username}: ${ROLE_LABEL[role]}.`);
                }}
                className="rounded-lg border p-2 text-sm font-semibold"
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
              <button
                onClick={() => resetPassword(u)}
                disabled={busy}
                title="Đặt lại mật khẩu"
                aria-label={`Đặt lại mật khẩu ${u.username}`}
                className="rounded-lg border p-2 disabled:opacity-40"
              >
                <KeyRound size={16} />
              </button>
              <button
                onClick={() =>
                  act(() => api.updateUser(u.id, { active: !u.active }), `${u.active ? 'Đã khoá' : 'Đã mở khoá'} ${u.username}.`)
                }
                disabled={busy || self}
                title={u.active ? 'Khoá tài khoản (đăng xuất khỏi mọi thiết bị)' : 'Mở khoá'}
                aria-label={`${u.active ? 'Khoá' : 'Mở khoá'} ${u.username}`}
                className="rounded-lg border p-2 disabled:opacity-40"
              >
                {u.active ? <Lock size={16} /> : <Unlock size={16} />}
              </button>
              <button
                onClick={() => {
                  if (confirm(`Xoá tài khoản ${u.username}?`)) act(() => api.deleteUser(u.id), `Đã xoá tài khoản ${u.username}.`);
                }}
                disabled={busy || self}
                title="Xoá tài khoản"
                aria-label={`Xoá ${u.username}`}
                className="rounded-lg border border-red-300 p-2 text-[var(--red)] disabled:opacity-40"
              >
                <Trash2 size={16} />
              </button>
            </div>
          );
        })}
      </div>

      {editing && (
        <UserEditDialog
          u={editing}
          onClose={() => setEditing(null)}
          onSaved={(u) => {
            load();
            if (u.id === me?.id) setUser(u); // sửa chính mình → đầu trang đổi ngay
          }}
        />
      )}
    </section>
  );
}
