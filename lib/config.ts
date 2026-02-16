const fallbackApiBase = 'http://localhost:3000/api';

const normalizeBase = (value?: string | null) => {
  if (!value || !value.trim()) return fallbackApiBase;
  return value.endsWith('/') ? value.slice(0, -1) : value;
};

// Base URL for the application
export const BASE_URL = (typeof window !== 'undefined' ?
  window.location.origin :
  (process.env.NEXT_PUBLIC_APP_URL || 'https://surveys.ddrcnagar.in'));

// Helper function to convert relative image paths to absolute URLs
export const getAbsoluteImageUrl = (path: string | null | undefined): string => {
  if (!path) return '';

  // If already an absolute URL, normalize it to the current environment's BASE_URL if it's a known domain
  if (path.startsWith('http://') || path.startsWith('https://')) {
    const isLocal = path.includes('localhost') || path.includes('127.0.0.1');
    const isProduction = path.includes('surveys.ddrcnagar.in');

    if (isLocal || isProduction) {
      try {
        const urlObj = new URL(path);
        // Only rewrite if the origin is different from our current BASE_URL origin
        const currentOrigin = new URL(BASE_URL).origin;
        if (urlObj.origin !== currentOrigin) {
          return `${BASE_URL}${urlObj.pathname}${urlObj.search}${urlObj.hash}`;
        }
      } catch {
        // If URL parsing fails, return as-is
      }
    }
    return path;
  }

  // If it's a relative path starting with /, make it absolute
  if (path.startsWith('/')) {
    return `${BASE_URL}${path}`;
  }

  // If it looks like a filename (has extension), assume it's in uploads
  if (path.match(/\.(jpg|jpeg|png|gif|webp|pdf)$/i)) {
    // Remove any leading path separators and ensure it starts with /uploads/
    const cleanPath = path.replace(/^\/+/, '').replace(/^uploads\//, '');
    return `${BASE_URL}/uploads/${cleanPath}`;
  }

  // If it's just a UUID or filename without extension, check if it's in uploads format
  if (path.match(/^[a-f0-9-]{36}$/i)) {
    // It's a UUID, likely a filename - check if it needs .jpg extension
    return `${BASE_URL}/uploads/${path}.jpg`;
  }

  // If it contains 'uploads' but doesn't start with /, add it
  if (path.includes('uploads') && !path.startsWith('/')) {
    return `${BASE_URL}/${path}`;
  }

  // Otherwise, treat as relative path and make it absolute
  return `${BASE_URL}/${path}`;
};

export const CONFIG = {
  OTP_EXPIRY_MINUTES: parseInt(process.env.OTP_EXPIRY_MINUTES || '5'),
  UPLOAD_BASE: normalizeBase(
    process.env.UPLOAD_BASE ||
    process.env.API_BASE ||
    process.env.NEXT_PUBLIC_API_URL ||
    fallbackApiBase
  ),
  BASE_URL,
};

