export type WeaponStatus =
  | 'Tốt'
  | 'Đang bảo dưỡng'
  | 'Phân cấp 2'
  | 'Phân cấp 3'
  | 'Phân cấp 4'
  | 'Phân cấp 5'
  | 'Đang mượn';
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
  /** Mã bí mật trong link tem QR: <site>/w/<publicToken> */
  publicToken?: string | null;
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
  /** Hẹn giờ trả (YYYY-MM-DDTHH:MM) — rỗng nếu không hẹn */
  dueAt?: string;
}

export interface ReportGroup {
  name: string;
  total: number;
  /** Số lượng theo từng tình trạng, cùng thứ tự với Report.statuses */
  byStatus: number[];
}

export interface Report {
  period: 'week' | 'month';
  from: string;
  to: string;
  label: string;
  generatedAt: string;
  statuses: string[];
  total: number;
  byType: ReportGroup[];
  byUnit: ReportGroup[];
  activity: {
    maintenance: number;
    maintenanceByResult: { result: string; count: number }[];
    borrowed: number;
    returned: number;
    added: number;
    retired: number;
  };
  overdue: number;
  soon: number;
  due: {
    code: string; name: string; serial: string; type: string; unit: string; responsible: string; status: string;
    last_maint: string; next_maint: string; daysLeft: number; level: 'Quá hạn' | 'Sắp đến hạn' | 'Trong hạn';
  }[];
  unreturned: {
    code: string; name: string; serial: string; type: string; unit: string; responsible: string;
    borrower: string; purpose: string; borrow_at: string; recorded_by: string | null; hoursOut: number;
  }[];
}

/** Thông tin hiện trên trang công khai khi quét tem QR (không cần đăng nhập). */
export interface PublicWeapon {
  code: string;
  name: string;
  type: string;
  serial: string;
  unit: string;
  responsible: string;
  status: string;
  last: string;
  next: string;
  retired: boolean;
  hasPhoto: boolean;
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
  /** Phiếu mượn quá giờ hẹn trả */
  loansOverdue?: number;
  byType: { type: string; count: number }[];
}

export interface Alerts {
  overdue: Weapon[];
  soon: Weapon[];
  loansOverdue?: Loan[];
}

/** Một đợt kiểm đếm bằng quét QR */
export interface Check {
  id: number;
  note: string;
  unit: string;
  startedAt: string;
  finishedAt: string | null;
  startedBy: string;
  finishedBy: string | null;
  total: number;
  checked: number;
  /** chưa quét nhưng đang cho mượn */
  borrowed: number;
  missing: number;
}
export interface CheckItem {
  weaponId: number;
  code: string;
  name: string;
  serial: string;
  type: string;
  unit: string;
  responsible: string;
  status: WeaponStatus;
  statusAtStart: WeaponStatus;
  checkedAt: string | null;
  method: 'qr' | 'tay' | null;
  checkedBy: string | null;
}
export interface CheckDetail extends Check {
  items: CheckItem[];
}

export const GRADES: WeaponStatus[] = ['Phân cấp 2', 'Phân cấp 3', 'Phân cấp 4', 'Phân cấp 5'];
export const STATUSES: WeaponStatus[] = ['Tốt', 'Đang bảo dưỡng', ...GRADES, 'Đang mượn'];
/** Chỉ được xuất kho cho mượn khi ở các tình trạng này */
export const LOANABLE_STATUSES: WeaponStatus[] = ['Tốt', 'Phân cấp 2'];
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
export const RETURN_WEAPON_STATUSES: WeaponStatus[] = ['Tốt', 'Đang bảo dưỡng', ...GRADES];

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

/** 1 tin nhắn giữa 2 tài khoản */
export interface Message {
  id: number;
  fromId: number;
  toId: number;
  body: string;
  createdAt: string;
  readAt: string | null;
}

/** 1 người trong danh bạ nhắn tin */
export interface Contact {
  id: number;
  username: string;
  fullName: string;
  role: Role;
  unitLabel: string;
  unread: number;
  last: { body: string; createdAt: string; mine: boolean } | null;
}
