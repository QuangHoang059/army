import type { Metadata } from 'next';

// Trang công khai khi quét tem QR: không cho máy tìm kiếm lưu, không gửi link sang trang khác.
export const metadata: Metadata = {
  title: 'Thông tin vũ khí',
  description: 'Thông tin vũ khí - trang bị',
  robots: { index: false, follow: false, nocache: true },
  referrer: 'no-referrer',
};

export default function PublicWeaponLayout({ children }: { children: React.ReactNode }) {
  return children;
}
