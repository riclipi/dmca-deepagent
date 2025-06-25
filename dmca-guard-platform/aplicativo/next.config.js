/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  outputFileTracingIncludes: {
    '/api/**/*': ['./prisma/**/*'],
  },
  i18n: {
    locales: ['en', 'pt'],
    defaultLocale: 'pt',
    localeDetection: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'img.freepik.com',
      },
      {
        protocol: 'https',
        hostname: 'thumbs.dreamstime.com',
      },
    ],
  },
};

module.exports = nextConfig;