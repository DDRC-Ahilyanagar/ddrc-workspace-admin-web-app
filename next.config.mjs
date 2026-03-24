/** @type {import('next').NextConfig} */
const nextConfig = {
  // Next.js 16+ uses serverExternalPackages
  // Mark heavy/binary packages as external to speed up build and prevent hangs
  serverExternalPackages: [
    'puppeteer',
    'sharp',
    'tesseract.js',
    '@ckeditor/ckeditor5-build-classic',
    '@google-cloud/vision'
  ],
  productionBrowserSourceMaps: false,
  // Disable type-check during build to prevent hanging
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;

