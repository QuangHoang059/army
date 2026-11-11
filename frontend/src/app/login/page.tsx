'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { LogIn, Shield } from 'lucide-react';
import { safeNext, useAuth } from '@/components/AuthProvider';
import { inputCls, labelCls } from '@/components/ui';

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <Login />
    </Suspense>
  );
}

function Login() {
  const router = useRouter();
  const next = safeNext(useSearchParams().get('next'));
  const { user, login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Đã đăng nhập → đi tiếp. Link /api/... (vd link ảnh trên tem QR) là trang của backend → tải lại hẳn trang.
  useEffect(() => {
    if (!user) return;
    if (next.startsWith('/api/')) window.location.replace(next);
    else router.replace(next);
  }, [user, next, router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await login(username.trim(), password);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg)] px-4 py-10">
      <form
        onSubmit={submit}
        className="w-full max-w-[380px] overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-lg"
      >
        <div className="flex items-center gap-3 border-b-4 border-[var(--gold)] bg-[var(--green)] px-5 py-4 text-white">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-[var(--green)]">
            <Shield size={24} />
          </div>
          <div>
            <div className="font-display text-lg font-bold uppercase leading-tight">Đăng nhập</div>
            <div className="text-xs font-semibold text-green-100">Quản lý Vũ khí - Trang bị bằng mã QR</div>
          </div>
        </div>
        <div className="grid gap-3 p-5">
          <label className={labelCls}>
            Tên đăng nhập
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoCapitalize="none"
              autoFocus
              required
              className={inputCls}
            />
          </label>
          <label className={labelCls}>
            Mật khẩu
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              className={inputCls}
            />
          </label>
          {err && (
            <p className="rounded-lg border border-red-300 bg-[var(--red-soft)] px-3 py-2 text-sm font-semibold text-[var(--red)]">
              {err}
            </p>
          )}
          <button
            type="submit"
            disabled={busy || !!user}
            className="mt-1 flex items-center justify-center gap-2 rounded-xl bg-[var(--green)] px-5 py-3 font-bold text-white disabled:opacity-50"
          >
            <LogIn size={18} /> {busy || user ? 'Đang đăng nhập…' : 'Đăng nhập'}
          </button>
        </div>
      </form>
    </div>
  );
}
