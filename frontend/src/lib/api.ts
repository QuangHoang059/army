import type { Alerts, AuditEntry, Backup, Loan, Maintenance, Role, Stats, User, Weapon, WeaponDetail, WeaponType } from './types';

/** Phát ra khi API trả 401 (phiên hết hạn / bị khoá) → AuthProvider đưa về trang đăng nhập. */
export const AUTH_EXPIRED_EVENT = 'auth:expired';

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
  if (!res.ok) throw new Error(data?.error || `Không kết nối được máy chủ (${res.status})`);
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
  uploadPhoto: (id: number, img: Blob) =>
    request<Weapon>(`/weapons/${id}/photo`, { method: 'PUT', body: img, headers: { 'content-type': img.type || 'image/jpeg' } }),
  deletePhoto: (id: number) => request<Weapon>(`/weapons/${id}/photo`, { method: 'DELETE' }),

  maintenance: () => request<Maintenance[]>('/maintenance'),
  createMaintenance: (m: { weaponCode: string; date: string; content: string; worker: string; result: string }) =>
    post<Maintenance>('/maintenance', m),

  loans: (status?: string) => request<Loan[]>(`/loans${status ? `?status=${encodeURIComponent(status)}` : ''}`),
  createLoan: (l: { weaponCode: string; borrower: string; purpose: string; borrowAt: string }) =>
    post<Loan>('/loans', l),
  returnLoan: (id: number, b: { returnAt: string; returnStatus: string; weaponStatus: string }) => post<Loan>(`/loans/${id}/return`, b),

  // ---- Nhật ký & sao lưu (admin) ----
  audit: (f: { q?: string; action?: string; before?: number; limit?: number } = {}) => {
    const qs = new URLSearchParams(
      Object.entries(f).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)]),
    ).toString();
    return request<{ items: AuditEntry[]; more: boolean }>(`/audit${qs ? `?${qs}` : ''}`);
  },
  backups: () => request<{ dir: string; items: Backup[] }>('/backups'),
  createBackup: () => post<Backup>('/backups', {}),

  seed: () => post<{ weapons: number; maintenance: number; loans: number }>('/seed', {}),
};
