'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Loader2, ShieldAlert } from 'lucide-react';
import { AUTH_EXPIRED_EVENT, IP_BLOCKED, api } from '@/lib/api';
import type { User } from '@/lib/types';
import { DataProvider } from './DataProvider';
import { AppShell } from './AppShell';

interface AuthCtx {
  user: User | null;
  isAdmin: boolean;
  login: (username: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  /** Cập nhật thông tin tài khoản đang đăng nhập (sau khi sửa phiên hiệu). */
  setUser: (u: User) => void;
}

const Ctx = createContext<AuthCtx | null>(null);

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth must be used inside AuthProvider');
  return c;
}

/** Đường dẫn quay lại sau đăng nhập — chỉ chấp nhận đường dẫn nội bộ (chặn chuyển hướng sang trang ngoài). */
export const safeNext = (n: string | null) => (n && n.startsWith('/') && !n.startsWith('//') && !n.startsWith('/login') ? n : '/');

/**
 * Bọc toàn app: kiểm tra phiên đăng nhập.
 * - /login: hiện trang đăng nhập riêng (không có menu, không tải dữ liệu).
 * - Trang khác: chưa đăng nhập → chuyển sang /login?next=<trang hiện tại>.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [checked, setChecked] = useState(false);
  const [blocked, setBlocked] = useState<string | null>(null);

  useEffect(() => {
    api
      .me()
      .then(setUser)
      .catch((e) => {
        setUser(null);
        if (e instanceof Error && e.name === IP_BLOCKED) setBlocked(e.message);
      })
      .finally(() => setChecked(true));
    const expired = () => setUser(null);
    window.addEventListener(AUTH_EXPIRED_EVENT, expired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, expired);
  }, []);

  const isLogin = pathname === '/login';
  // Trang công khai khi quét tem QR: không cần đăng nhập, không có menu / dữ liệu khác
  const isPublic = pathname.startsWith('/w/');

  useEffect(() => {
    if (checked && !user && !blocked && !isLogin && !isPublic) {
      const here = window.location.pathname + window.location.search;
      router.replace(`/login?next=${encodeURIComponent(here)}`);
    }
  }, [checked, user, blocked, isLogin, isPublic, router]);

  const login = useCallback(async (username: string, password: string) => {
    const u = await api.login(username, password);
    setUser(u);
    return u;
  }, []);

  const logout = useCallback(async () => {
    await api.logout().catch(() => undefined);
    setUser(null); // effect phía trên sẽ chuyển sang /login
  }, []);

  const value = { user, isAdmin: user?.role === 'admin', login, logout, setUser };

  let body: React.ReactNode;
  if (blocked)
    body = (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg)] px-4">
        <div className="w-full max-w-[440px] rounded-2xl border border-red-300 bg-[var(--surface)] p-6 text-center shadow-lg">
          <ShieldAlert className="mx-auto mb-2 text-[var(--red)]" size={44} />
          <h1 className="font-display text-xl font-bold uppercase">Không được phép truy cập</h1>
          <p className="mt-2 text-sm font-semibold">{blocked}</p>
          <p className="mt-3 text-xs text-[var(--muted)]">
            Hệ thống chỉ mở cho máy tính trong mạng nội bộ của đơn vị.
          </p>
        </div>
      </div>
    );
  else if (isLogin || isPublic) body = children;
  else if (!checked || !user)
    body = (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg)] text-[var(--muted)]">
        <Loader2 className="animate-spin" />
      </div>
    );
  else
    body = (
      // key: đổi tài khoản → tải lại dữ liệu từ đầu
      <DataProvider key={user.id}>
        <AppShell>{children}</AppShell>
      </DataProvider>
    );

  return <Ctx.Provider value={value}>{body}</Ctx.Provider>;
}

/** Bọc nội dung chỉ dành cho admin (trang quản trị). */
export function AdminOnly({ children }: { children: React.ReactNode }) {
  const { isAdmin } = useAuth();
  if (!isAdmin)
    return (
      <div className="rounded-2xl border border-red-300 bg-[var(--red-soft)] p-6 text-center font-semibold">
        Trang này chỉ dành cho quản trị viên (admin).
      </div>
    );
  return <>{children}</>;
}
