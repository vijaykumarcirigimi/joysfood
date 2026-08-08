import type { NextConfig } from "next";

/**
 * Allow next/image to serve dish photos from this project's Supabase Storage
 * bucket. Derived from the env var rather than hardcoded so a different
 * Supabase project needs no code change.
 */
const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : undefined;

const nextConfig: NextConfig = {
  /**
   * Server Actions default to a 1 MB body, which rejected every real dish photo
   * with a 413 before the action ran — so the friendly "Photo must be under
   * 5 MB" check inside it could never fire.
   *
   * Photos are now downscaled in the browser (src/lib/image-resize.ts) and
   * arrive around 200 KB, so this is only a safety net for an image that
   * resists resizing. Deliberately not higher: Vercel's serverless functions
   * cap a request body at about 4.5 MB whatever this says, so a larger number
   * here would promise something the platform will not honour.
   */
  experimental: {
    serverActions: { bodySizeLimit: "4mb" },
  },
  images: {
    remotePatterns: supabaseHost
      ? [
          {
            protocol: "https",
            hostname: supabaseHost,
            pathname: "/storage/v1/object/public/**",
          },
        ]
      : [],
  },
};

export default nextConfig;
