import type { Alerts, AuditEntry, Check, CheckDetail, CheckItem, Backup, Contact, Loan, Message, Maintenance, PublicWeapon, Report, Role, Stats, User, Weapon, WeaponDetail, WeaponType } from './types';

/** Phát ra khi API trả 401 (phiên hết hạn / bị khoá) → AuthProvider đưa về trang đăng nhập. */
export const AUTH_EXPIRED_EVENT = 'auth:expired';
export const IP_BLOCKED = 'IpBlocked';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      ...init,
      headers: { 'content-type': 'application/json', ...(init?.headers || {}) },
      cache: 'no-store',
    });
  } catch {
    throw new Error('Không kết nối được máy chủ.');
  }
  if (res.status === 401 && !path.startsWith('/auth/')) window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.error || `Không kết nối được máy chủ (${res.status})`);
    // Máy ngoài dải IP được phép (mạng quân sự) → AuthProvider hiện màn hình chặn
    if (data?.code === 'ip_blocked') err.name = IP_BLOCKED;
    throw err;
  }
  return data as T;
}

const post = <T>(path: string, body: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(body) });
const put = <T>(path: string, body: unknown) => request<T>(path, { method: 'PUT', body: JSON.stringify(body) });
const del = (path: string) => request<void>(path, { method: 'DELETE' });

export const api = {
  // ---- Đăng nhập ----
  me: () => request<User>('/auth/me'),
  login: (username: string, password: string) => post<User>('/auth/login', { username, password }),
  logout: () => post<void>('/auth/logout', {}),
  changePassword: (current: string, password: string) => post<{ ok: true }>('/auth/password', { current, password }),
  updateProfile: (unitLabel: string) => put<User>('/auth/profile', { unitLabel }),

  // ---- Tài khoản (admin) ----
  users: () => request<User[]>('/users'),
  createUser: (u: { username: string; fullName: string; unitLabel: string; role: Role; password: string }) => post<User>('/users', u),
  updateUser: (id: number, u: Partial<{ fullName: string; unitLabel: string; role: Role; active: boolean; password: string }>) =>
    put<User>(`/users/${id}`, u),
  deleteUser: (id: number) => del(`/users/${id}`),

  // ---- Danh mục loại (xem: mọi người; sửa: admin) ----
  weaponTypes: () => request<WeaponType[]>('/weapon-types'),
  createWeaponType: (name: string) => post<WeaponType>('/weapon-types', { name }),
  renameWeaponType: (id: number, name: string) => put<WeaponType>(`/weapon-types/${id}`, { name }),
  deleteWeaponType: (id: number) => del(`/weapon-types/${id}`),

  // ---- Danh mục đơn vị quản lý (xem: mọi người; sửa: admin) ----
  units: () => request<WeaponType[]>('/units'),
  createUnit: (name: string) => post<WeaponType>('/units', { name }),
  renameUnit: (id: number, name: string) => put<WeaponType>(`/units/${id}`, { name }),
  deleteUnit: (id: number) => del(`/units/${id}`),

  stats: () => request<Stats>('/stats'),
  alerts: () => request<Alerts>('/alerts'),

  weapons: (f: { q?: string; unit?: string; status?: string; retired?: '0' | '1' | 'all' } = {}) => {
    const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v) as [string, string][]).toString();
    return request<Weapon[]>(`/weapons${qs ? `?${qs}` : ''}`);
  },
  weapon: (key: string) => request<WeaponDetail>(`/weapons/${encodeURIComponent(key)}`),
  createWeapon: (w: Partial<Weapon>) => post<Weapon>('/weapons', w),
  updateWeapon: (id: number, w: Partial<Weapon>) =>
    request<Weapon>(`/weapons/${id}`, { method: 'PUT', body: JSON.stringify(w) }),
  deleteWeapon: (id: number) => request<void>(`/weapons/${id}`, { method: 'DELETE' }),
  retireWeapon: (id: number, reason: string) => post<Weapon>(`/weapons/${id}/retire`, { reason }),
  restoreWeapon: (id: number) => post<Weapon>(`/weapons/${id}/restore`, {}),
  rotatePublicToken: (id: number) => post<Weapon>(`/weapons/${id}/public-token`, {}),
  report: (period: 'week' | 'month', date: string) => request<Report>(`/reports?period=${period}&date=${date}`),
  /** Tải file Excel báo cáo về máy */
  exportReport: async (period: 'week' | 'month', date: string) => {
    const res = await fetch(`/api/reports/export.xlsx?period=${period}&date=${date}`, { cache: 'no-store' });
    if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || `Không xuất được file (${res.status})`);
    const name = /filename="([^"]+)"/.exec(res.headers.get('content-disposition') || '')?.[1] || 'BaoCao_VKTB.xlsx';
    const url = URL.createObjectURL(await res.blob());
    const a = Object.assign(document.createElement('a'), { href: url, download: name });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    return name;
  },
  publicWeapon: (token: string) => request<PublicWeapon>(`/public/w/${encodeURIComponent(token)}`),
  uploadPhoto: (id: number, img: Blob) =>
    request<Weapon>(`/weapons/${id}/photo`, { method: 'PUT', body: img, headers: { 'content-type': img.type || 'image/jpeg' } }),
  deletePhoto: (id: number) => request<Weapon>(`/weapons/${id}/photo`, { method: 'DELETE' }),

  maintenance: () => request<Maintenance[]>('/maintenance'),
  createMaintenance: (m: { weaponCode: string; date: string; content: string; worker: string; result: string }) =>
    post<Maintenance>('/maintenance', m),

  loans: (status?: string) => request<Loan[]>(`/loans${status ? `?status=${encodeURIComponent(status)}` : ''}`),
  createLoan: (l: { weaponCode: string; borrower: string; purpose: string; borrowAt: string; dueAt?: string }) =>
    post<Loan>('/loans', l),
  returnLoan: (id: number, b: { returnAt: string; returnStatus: string; weaponStatus: string }) => post<Loan>(`/loans/${id}/return`, b),

  // ---- Kiểm đếm bằng quét QR ----
  checks: () => request<Check[]>('/checks'),
  check: (id: number) => request<CheckDetail>(`/checks/${id}`),
  startCheck: (b: { unit?: string; note?: string }) => post<Check>('/checks', b),
  checkScan: (id: number, key: string, method: 'qr' | 'tay' = 'qr') =>
    post<{ item: CheckItem; already: boolean }>(`/checks/${id}/scan`, { key, method }),
  checkUncheck: (id: number, weaponId: number) => post<{ ok: true }>(`/checks/${id}/uncheck`, { weaponId }),
  finishCheck: (id: number) => post<Check>(`/checks/${id}/finish`, {}),
  deleteCheck: (id: number) => del(`/checks/${id}`),

  // ---- Tin nhắn ----
  contacts: () => request<Contact[]>('/messages/contacts'),
  unreadMessages: () => request<{ unread: number }>('/messages/unread'),
  conversation: (userId: number, after = 0) =>
    request<{ items: Message[]; seenUpTo: number }>(`/messages/with/${userId}${after ? `?after=${after}` : ''}`),
  sendMessage: (toId: number, body: string) => post<Message>('/messages', { toId, body }),

  // ---- Nhật ký & sao lưu (admin) ----
  audit: (f: { q?: string; action?: string; before?: number; limit?: number } = {}) => {
    const qs = new URLSearchParams(
      Object.entries(f).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)]),
    ).toString();
    return request<{ items: AuditEntry[]; more: boolean }>(`/audit${qs ? `?${qs}` : ''}`);
  },
  backups: () => request<{ dir: string; items: Backup[] }>('/backups'),
  createBackup: () => post<Backup>('/backups', {}),
  /** Tải bản sao lưu mã hoá (.vkbak) về máy */
  exportBackup: async (name: string, password: string) => {
    const res = await fetch(`/api/backups/${encodeURIComponent(name)}/export`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password }),
      cache: 'no-store',
    });
    if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || `Không tải được (${res.status})`);
    const file = /filename="([^"]+)"/.exec(res.headers.get('content-disposition') || '')?.[1] || `${name}.vkbak`;
    const url = URL.createObjectURL(await res.blob());
    const a = Object.assign(document.createElement('a'), { href: url, download: file });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    return file;
  },

  seed: () => post<{ weapons: number; maintenance: number; loans: number }>('/seed', {}),
};
