/** @type {import('next').NextConfig} */
const API_URL = process.env.API_URL || 'http://localhost:4000';

const nextConfig = {
  // Proxy /api/* tới backend Node để tránh CORS khi chạy cùng máy.
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${API_URL}/api/:path*` }];
  },
};

export default nextConfig;
