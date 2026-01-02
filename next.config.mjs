/** @type {import('next').NextConfig} */
const nextConfig = {
  // Note: serverExternalPackages is only available in Next.js 15+
  // For Next.js 14, external packages are handled automatically
  // turbopack is a CLI flag (--turbo), not a config option
  experimental: {
    instrumentationHook: true,
  },
};

export default nextConfig;

