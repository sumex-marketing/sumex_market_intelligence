import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Faster RSC serialization — reduces time-to-first-byte on route transitions
  experimental: {
    // Optimise server action bundles (Next 16+)
    optimizeServerReact: true,
  },

  // Avoid re-fetching Google Fonts on every cold start
  compiler: {
    // Remove console.log in production for slightly faster responses
    removeConsole: process.env.NODE_ENV === "production"
      ? { exclude: ["error", "warn"] }
      : false,
  },
};

export default nextConfig;
