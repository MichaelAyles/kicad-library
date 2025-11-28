/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'pub-5cfb1ad5b22e451db2e5711b584b49c9.r2.dev',
      },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb', // For S-expression uploads
    },
  },
}

module.exports = nextConfig
