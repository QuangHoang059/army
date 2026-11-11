import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/components/AuthProvider';

export const metadata: Metadata = {
  title: 'Quản lý Vũ khí - Trang bị QR',
  description: 'Trung đội 2  — Đại đội 7: quản lý vũ khí, bảo dưỡng, bàn giao bằng mã QR',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
