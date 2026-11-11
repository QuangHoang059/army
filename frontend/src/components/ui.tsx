'use client';

import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import type { Weapon, WeaponStatus } from '@/lib/types';

const STATUS_CLS: Record<string, string> = {
  'Tốt': 'bg-[var(--green-soft)] text-[var(--green)] border-green-600',
  'Đang bảo dưỡng': 'bg-[var(--amber-soft)] text-[var(--amber)] border-amber-600',
  'Hỏng': 'bg-[var(--red-soft)] text-[var(--red)] border-red-600',
  'Đang mượn': 'bg-blue-50 text-blue-700 border-blue-500',
  'Đã trả': 'bg-gray-100 text-gray-700 border-gray-400',
  'Đã thanh lý': 'bg-gray-200 text-gray-600 border-gray-500',
};

export function StatusBadge({ s }: { s: WeaponStatus | string }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-bold ${STATUS_CLS[s] || 'bg-gray-100'}`}
    >
      {s}
    </span>
  );
}

type QrInfo = Pick<Weapon, 'code' | 'name' | 'serial' | 'type' | 'unit' | 'responsible' | 'photo'>;

/**
 * Địa chỉ gốc in vào link trên tem QR.
 * Có host thật → đặt NEXT_PUBLIC_SITE_URL (vd https://kho.example.vn) trong frontend/.env.local.
 * Tạm thời: lấy theo địa chỉ đang mở app (mở bằng IP LAN, vd http://192.168.1.10:3000, thì điện thoại cùng wifi mở được).
 */
function useSiteUrl() {
  const [url, setUrl] = useState(process.env.NEXT_PUBLIC_SITE_URL || '');
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_SITE_URL) setUrl(window.location.origin);
  }, []);
  return url.replace(/\/+$/, '');
}

/** Nội dung chữ ghi trong mã QR — quét bằng camera điện thoại thường cũng đọc được, không cần mạng.
 *  Dòng đầu luôn là mã QRCB-xxx để trang Quét QR của app tra cứu được.
 *  Nếu vũ khí có ảnh: thêm dòng link ảnh (link cố định theo mã, đổi ảnh không cần in lại tem). */
export const qrText = (w: QrInfo, siteUrl = '') =>
  [
    `Mã: ${w.code}`,
    `Tên: ${w.name}`,
    `Số hiệu: ${w.serial}`,
    `Loại: ${w.type}`,
    `Đơn vị: ${w.unit}`,
    `Người quản lý: ${w.responsible}`,
    ...(w.photo && siteUrl ? [`Ảnh: ${siteUrl}/api/weapons/${encodeURIComponent(w.code)}/photo`] : []),
  ].join('\n');

/** Mã QR thật, chứa thông tin vũ khí dạng chữ (thay đổi đơn vị / người quản lý thì cần in lại tem). */
export function QrCode({ w, size = 132 }: { w: QrInfo; size?: number }) {
  const siteUrl = useSiteUrl();
  return (
    <div style={{ width: size }}>
      <div className="qr-box">
        <QRCodeSVG value={qrText(w, siteUrl)} size={size - 18} level="L" style={{ width: '100%', height: 'auto' }} />
      </div>
      <div className="mt-1 text-center text-[11px] font-bold tracking-widest">{w.code}</div>
    </div>
  );
}

export function PageTitle({ title, sub }: { title: string; sub?: React.ReactNode }) {
  return (
    <div>
      <h1 className="font-display text-2xl font-bold uppercase">{title}</h1>
      {sub && <p className="mt-1 text-sm text-[var(--muted)]">{sub}</p>}
    </div>
  );
}

export const inputCls = 'mt-1 w-full rounded-lg border border-[var(--line)] p-2.5';
export const labelCls = 'text-sm font-bold';
export const card = 'rounded-2xl border border-[var(--line)] bg-[var(--surface)]';
