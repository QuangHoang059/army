export type WeaponStatus = 'Tốt' | 'Đang bảo dưỡng' | 'Hỏng' | 'Đang mượn';
export type LoanStatus = 'Đang mượn' | 'Đã trả';

export interface Weapon {
  id: number;
  code: string;
  name: string;
  serial: string;
  type: string;
  unit: string;
  responsible: string;
  status: WeaponStatus;
  last: string;
  next: string;
  /** URL ảnh minh hoạ (/api/uploads/...) hoặc null */
  photo?: string | null;
  /** Đã thanh lý (loại khỏi biên chế) — giữ lại lịch sử, không cho ghi bảo dưỡng/mượn */
  retired?: boolean;
  retiredAt?: string | null;
  retiredReason?: string | null;
}

export interface Maintenance {
  id: number;
  weaponId: number;
  weaponCode: string;
  weaponName: string;
  date: string;
  content: string;
  worker: string;
  result: string;
  nextDate: string;
  /** Tài khoản đã ghi */
  recordedBy?: string | null;
}

export interface Loan {
  id: number;
  weaponId: number;
  weaponCode: string;
  weaponName: string;
  borrower: string;
  purpose: string;
  borrowAt: string;
  returnAt: string;
  returnStatus: string;
  status: LoanStatus;
  recordedBy?: string | null;
  returnedBy?: string | null;
}

export interface WeaponDetail extends Weapon {
  maintenance: Maintenance[];
  loans: Loan[];
  /** Xoá hẳn được (chưa có lịch sử nào) — ngược lại chỉ thanh lý */
  deletable?: boolean;
}

export interface Stats {
  total: number;
  using: number;
  maint: number;
  broken: number;
  borrowed: number;
  soon: number;
  over: number;
  byType: { type: string; count: number }[];
}

export interface Alerts {
  overdue: Weapon[];
  soon: Weapon[];
}

export const UNITS = ['Trung đội 1', 'Trung đội 2', 'Trung đội 3', 'Khối Đại đội'];
export const STATUSES: WeaponStatus[] = ['Tốt', 'Đang bảo dưỡng', 'Hỏng', 'Đang mượn'];
export const MAINT_RESULTS = ['Đạt', 'Đang theo dõi', 'Chưa đạt'];
export const LOAN_PURPOSES = ['Gác', 'Huấn luyện', 'Diễn tập', 'Nhiệm vụ khác'];
export const MAINT_INTERVAL_DAYS = 30;

export type Role = 'admin' | 'user';

export interface User {
  id: number;
  username: string;
  fullName: string;
  /** Phiên hiệu đơn vị hiện trên đầu trang, vd "Trung đội 2 — Đại đội 7". Rỗng = tiêu đề mặc định. */
  unitLabel: string;
  role: Role;
  active: boolean;
  createdAt: string;
}

/** Loại vũ khí - trang bị (danh mục do admin quản lý). count = số vũ khí đang thuộc loại này. */
export interface WeaponType {
  id: number;
  name: string;
  count: number;
}

/** Tình trạng vũ khí khi nhận lại sau mượn */
export const RETURN_WEAPON_STATUSES: WeaponStatus[] = ['Tốt', 'Đang bảo dưỡng', 'Hỏng'];

/** 1 dòng nhật ký thao tác */
export interface AuditEntry {
  id: number;
  at: string;
  actor: string;
  action: string;
  entity: string | null;
  summary: string;
  detail: unknown;
}

/** 1 bản sao lưu dữ liệu */
export interface Backup {
  name: string;
  label: string;
  createdAt: string;
  size: number;
  photos: number;
}
