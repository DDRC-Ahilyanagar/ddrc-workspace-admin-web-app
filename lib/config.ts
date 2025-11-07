export const CONFIG = {
  OTP_EXPIRY_MINUTES: parseInt(process.env.OTP_EXPIRY_MINUTES || '5'),
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || 'AIzaSyB4Fp8Go8HT7sGB6lm-SGAk_TXPiqEMVyo',
  UPLOAD_BASE: process.env.UPLOAD_BASE || 'https://bitnix.store/ddrc-app',
};

