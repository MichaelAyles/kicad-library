/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static site: every page is built to plain files in out/ and served as
  // Cloudflare Workers static assets. The API lives in worker/ (see
  // wrangler.jsonc); workers/apex-redirect sends the bare domain to www.
  output: 'export',
  images: {
    // Serve images as-is: thumbnails come pre-sized from R2 and avatars from
    // GitHub, so Vercel Image Optimization would only add cost.
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
}

module.exports = nextConfig
