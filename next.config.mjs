/** @type {import('next').NextConfig} */
const nextConfig = {
  // External packages for server components
  serverExternalPackages: ['tesseract.js'],
  // Turbopack configuration
  turbopack: {
    // Allow external packages
  },
};

export default nextConfig;

