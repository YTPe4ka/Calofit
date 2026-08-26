import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  async rewrites() {
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    const cleanBackendUrl = backendUrl.replace(/\/+$/, '').replace(/\/api\/v1$/, '');
    
    return [
      {
        source: '/api/v1/:path*',
        destination: `${cleanBackendUrl}/api/v1/:path*`,
      },
    ];
  },
};

export default withNextIntl(nextConfig);
