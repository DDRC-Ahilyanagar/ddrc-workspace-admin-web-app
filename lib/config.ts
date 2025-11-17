const fallbackApiBase = 'http://localhost:3000/api';

const normalizeBase = (value?: string | null) => {
  if (!value || !value.trim()) return fallbackApiBase;
  return value.endsWith('/') ? value.slice(0, -1) : value;
};

export const CONFIG = {
  OTP_EXPIRY_MINUTES: parseInt(process.env.OTP_EXPIRY_MINUTES || '5'),
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || 'AIzaSyB4Fp8Go8HT7sGB6lm-SGAk_TXPiqEMVyo',
  UPLOAD_BASE: normalizeBase(
    process.env.UPLOAD_BASE ||
      process.env.API_BASE ||
      process.env.NEXT_PUBLIC_API_URL ||
      fallbackApiBase
  ),
};

