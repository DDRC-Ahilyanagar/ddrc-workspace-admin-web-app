import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // External packages for server components
  serverExternalPackages: ['tesseract.js'],
  // Turbopack configuration
  turbopack: {
    // Allow external packages
  },
};

export default nextConfig;
