/** @type {import('next').NextConfig} */
const nextConfig = {
  // Note: serverExternalPackages is only available in Next.js 15+
  // For Next.js 14, external packages are handled automatically
  // turbopack is a CLI flag (--turbo), not a config option
  productionBrowserSourceMaps: false,
  experimental: {
    // Mark heavy/binary packages as external to speed up build and prevent hangs
    serverComponentsExternalPackages: [
      'puppeteer',
      'sharp',
      'tesseract.js',
      '@ckeditor/ckeditor5-build-classic',
      '@google-cloud/vision'
    ],
    // Disable multi-threaded build workers to prevent hangs on Windows
    workerThreads: false,
  },
  // Disable type-check and lint during build to prevent hanging
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;

