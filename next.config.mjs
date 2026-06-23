/** @type {import('next').NextConfig} */
const nextConfig = {
  // ESLint is available via `npm run lint`; we don't gate builds on it during the
  // Phase 0 migration so the unported legacy kit can't block a build.
  eslint: { ignoreDuringBuilds: true },
  images: {
    // Hosts next/image may optimize: the seed's Unsplash photos and our own
    // Supabase Storage bucket (scraped images are copied there).
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },
};

export default nextConfig;
