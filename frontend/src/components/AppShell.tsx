'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ArrowLeftRight,
  CheckCircle2,
  Building2,
  Database,
  FileSpreadsheet,
  HardDrive,
  History,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Package,
  QrCode,
  RefreshCw,
  Shield,
  Tags,
  TriangleAlert,
  UserCog,
  Wrench,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useData } from './DataProvider';
import { useAuth } from './AuthProvider';
import { api } from '@/lib/api';

const NAV = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/weapons', label: 'Vũ khí - Trang bị', icon: Package },
  { href: '/scan', label: 'Quét QR', icon: QrCode },
  { href: '/maintenance', label: 'Sổ Bảo dưỡng', icon: Wrench },
  { href: '/loans', label: 'Bàn giao / Mượn - Trả', icon: ArrowLeftRight },
  { href: '/alerts', label: 'Cảnh báo', icon: TriangleAlert },
  { href: '/reports', label: 'Báo cáo - Thống kê', icon: FileSpreadsheet },
  { href: '/admin/types', label: 'Loại trang bị', icon: Tags, admin: true },
  { href: '/admin/units', label: 'Đơn vị quản lý', icon: Building2, admin: true },
  { href: '/admin/users', label: 'Tài khoản', icon: UserCog, admin: true },
  { href: '/admin/audit', label: 'Nhật ký', icon: History, admin: true },
  { href: '/admin/backups', label: 'Sao lưu', icon: HardDrive, admin: true },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { stats, loading, error, flash, setFlash, reload, run, busy, weapons } = useData();
  const { user, isAdmin, logout } = useAuth();
  const [today, setToday] = useState('');

  useEffect(() => {
    setToday(
      new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }),
    );
  }, []);

  const alertCount = (stats?.over || 0) + (stats?.soon || 0);
  // Trang quản trị / tài khoản vẫn dùng được khi chưa có vũ khí nào
  const settingsPage = pathname.startsWith('/admin') || pathname === '/account';
  const empty = !loading && !error && weapons.length === 0 && !settingsPage;

  return (
    <div className="min-h-screen overflow-x-clip bg-[var(--bg)]">
      <header className="sticky top-0 z-30 border-b-4 border-[var(--gold)] bg-[var(--green)] text-white shadow-md">
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-3 px-3 py-3 sm:px-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-[var(--green)]">
            <Shield size={26} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate font-display text-lg font-bold uppercase leading-tight sm:text-2xl" title={user?.unitLabel}>
              {user?.unitLabel || 'Quản lý Vũ khí - Trang bị'}
            </div>
            <div className="text-[12px] font-semibold text-green-100 sm:text-sm">
              Quản lý Vũ khí - Trang bị bằng mã QR {today && `• ${today}`}
            </div>
          </div>
          <button
            onClick={reload}
            className="flex items-center gap-2 rounded-lg bg-white/15 px-3 py-2 text-sm font-bold hover:bg-white/25"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Tải lại
          </button>
          <span className="hidden rounded-full bg-[var(--red)] px-3 py-1 text-xs font-bold sm:inline">
            {stats && stats.over > 0 ? `${stats.over} quá hạn` : 'Sẵn sàng chiến đấu'}
          </span>
          <div className="flex items-center gap-1 rounded-lg bg-black/15 py-1 pl-3 pr-1 text-sm">
            <span className="max-w-[140px] truncate font-bold" title={user?.username}>
              {user?.fullName}
            </span>
            <span
              className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                isAdmin ? 'bg-[var(--gold)] text-black' : 'bg-white/20'
              }`}
            >
              {isAdmin ? 'Admin' : 'User'}
            </span>
            <Link href="/account" title="Đổi mật khẩu" aria-label="Đổi mật khẩu" className="rounded p-1.5 hover:bg-white/20">
              <KeyRound size={16} />
            </Link>
            <button onClick={logout} title="Đăng xuất" aria-label="Đăng xuất" className="rounded p-1.5 hover:bg-white/20">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1280px] grid-cols-[minmax(0,1fr)] gap-4 px-3 py-4 sm:px-5 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="min-w-0 lg:sticky lg:top-[92px] lg:self-start">
          <nav className="tab-scroll flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
            {NAV.filter((n) => !n.admin || isAdmin).map(({ href, label, icon: Icon }) => {
              const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex shrink-0 items-center gap-2 rounded-xl border px-3 py-3 text-left text-sm font-bold ${
                    active
                      ? 'border-[var(--green)] bg-[var(--green)] text-white shadow'
                      : 'border-[var(--line)] bg-[var(--surface)] hover:border-[var(--green)]'
                  }`}
                >
                  <Icon size={19} />
                  {label}
                  {href === '/alerts' && alertCount > 0 && (
                    <span className="ml-auto rounded-full bg-[var(--red)] px-2 py-0.5 text-[11px] text-white">
                      {alertCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
          <div className="mt-3 hidden rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 lg:block">
            <p className="text-xs font-bold uppercase tracking-wide text-[var(--muted)]">Quy định nhanh</p>
            <ul className="mt-2 space-y-2 text-[13px] leading-snug">
              <li>
                • Bảo dưỡng định kỳ <b>30 ngày</b> / lần.
              </li>
              <li>• Mượn phải ghi giờ mượn — giờ trả.</li>
              <li>
                • Vũ khí quá hạn: <b className="text-[var(--red)]">không xuất kho</b>.
              </li>
            </ul>
          </div>
        </aside>

        <main className="min-w-0">
          {flash && (
            <div
              className={`mb-3 flex items-start gap-2 rounded-xl border px-4 py-3 text-sm font-semibold ${
                flash.kind === 'ok'
                  ? 'border-green-300 bg-[var(--green-soft)]'
                  : 'border-red-300 bg-[var(--red-soft)] text-[var(--red)]'
              }`}
            >
              {flash.kind === 'ok' ? (
                <CheckCircle2 className="mt-0.5 shrink-0" size={18} />
              ) : (
                <TriangleAlert className="mt-0.5 shrink-0" size={18} />
              )}
              <span className="flex-1">{flash.text}</span>
              <button onClick={() => setFlash(null)} aria-label="Đóng thông báo">
                <X size={16} />
              </button>
            </div>
          )}

          {error && (
            <div className="mb-3 rounded-xl border border-red-300 bg-[var(--red-soft)] px-4 py-3 text-sm font-semibold">
              Chưa kết nối được máy chủ dữ liệu: {error}. Kiểm tra backend đã chạy chưa rồi bấm “Tải lại”.
            </div>
          )}

          {loading && weapons.length === 0 ? (
            <div className="rounded-2xl bg-[var(--surface)] p-8 text-center font-semibold">Đang tải dữ liệu đơn vị…</div>
          ) : empty ? (
            <div className="rounded-2xl border-2 border-dashed border-[var(--green)] bg-[var(--surface)] p-6 text-center">
              <Database className="mx-auto mb-2" size={36} />
              <h2 className="font-display text-xl font-bold uppercase">Chưa có dữ liệu vũ khí</h2>
              <p className="mx-auto mt-1 max-w-[520px] text-sm text-[var(--muted)]">
                Nạp bộ dữ liệu mẫu của Đại đội (36 vũ khí, 5 phiếu bảo dưỡng, 3 phiếu bàn giao) để bắt đầu demo, hoặc
                vào “Vũ khí - Trang bị” để thêm thủ công.
              </p>
              {!isAdmin && (
                <p className="mt-3 text-sm font-semibold">Liên hệ quản trị viên (admin) để nhập dữ liệu vũ khí.</p>
              )}
              <div className={`mt-4 flex-wrap justify-center gap-2 ${isAdmin ? 'flex' : 'hidden'}`}>
                <button
                  disabled={busy}
                  onClick={() => run(api.seed, (r) => `Đã nạp ${r.weapons + r.maintenance + r.loans} bản ghi mẫu.`)}
                  className="rounded-xl bg-[var(--green)] px-5 py-3 font-bold text-white disabled:opacity-50"
                >
                  {busy ? 'Đang nạp…' : 'Nạp dữ liệu mẫu Đại đội'}
                </button>
                {pathname !== '/weapons' && (
                  <Link href="/weapons" className="rounded-xl border px-5 py-3 font-bold">
                    Thêm vũ khí
                  </Link>
                )}
              </div>
            </div>
          ) : null}

          {!(loading && weapons.length === 0) && (!empty || pathname === '/weapons') && (
            <div className={empty ? 'mt-4' : ''}>{children}</div>
          )}

          <footer className="mt-6 border-t pt-4 text-center text-xs text-[var(--muted)]">
            {user?.unitLabel ? `${user.unitLabel} • ` : ''}Quản lý Vũ khí - Trang bị bằng mã QR • Bảo dưỡng định kỳ 30 ngày
          </footer>
        </main>
      </div>
    </div>
  );
}
