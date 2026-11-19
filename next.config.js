/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static site: every page is built to plain files in out/ and served as
  // Cloudflare Workers static assets. The API lives in worker/ (see
  // wrangler.jsonc); workers/apex-redirect sends the bare domain to www.
  output: 'export',
  images: {
    // Serve images as-is: thumbnails come pre-sized from R2 and avatars from
    // GitHub, and a static export has no image optimizer.
    unoptimized: true,
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
  webpack(config) {
    // Only the provider the site is built for (src/lib/auth/config.ts) is
    // ever mounted; keep the other one's SDK out of the Supabase bundle
    if (process.env.NEXT_PUBLIC_AUTH_PROVIDER !== 'workos') {
      config.resolve.alias['@workos-inc/authkit-react'] = false
    }
    return config
  },
}

module.exports = nextConfig
