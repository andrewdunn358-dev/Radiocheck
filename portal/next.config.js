/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'customer-assets.emergentagent.com',
      },
      {
        protocol: 'https',
        hostname: 'static.prod-images.emergentagent.com',
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'staff.radiocheck.me' }],
        destination: '/staff/:path*',
      },
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'admin.radiocheck.me' }],
        destination: '/admin/:path*',
      },
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'training.radiocheck.me' }],
        destination: '/learning/:path*',
      },
    ];
  },
}

module.exports = nextConfig
