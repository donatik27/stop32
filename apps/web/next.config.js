/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@polymarket/shared', '@polymarket/database'],
  outputFileTracing: true,
  outputFileTracingIncludes: {
    'app/api/**/*': [
      './node_modules/.prisma/client/**',
      './node_modules/@prisma/engines/**',
    ],
  },
}

module.exports = nextConfig

