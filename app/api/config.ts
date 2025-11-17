const normalizeBase = (value?: string | null) => {
  if (!value || !value.trim()) {
    return 'http://localhost:3000/api';
  }
  return value.endsWith('/') ? value.slice(0, -1) : value;
};

export const API_BASE = normalizeBase(
  process.env.API_BASE || process.env.NEXT_PUBLIC_API_URL
);

export const UPLOAD_BASE = normalizeBase(
  process.env.UPLOAD_BASE || process.env.API_BASE || process.env.NEXT_PUBLIC_API_URL
);

