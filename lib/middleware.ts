import { NextRequest, NextResponse } from 'next/server';

// Simple rate limiting store (in production, use Redis)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();
const ENABLE_RATE_LIMIT = false;

const RATE_LIMIT = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 100, // max 100 requests per window
};

export function rateLimit(request: NextRequest): NextResponse | null {
  if (!ENABLE_RATE_LIMIT) {
    return null;
  }
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ||
    request.headers.get('x-real-ip') ||
    'unknown';
  const now = Date.now();

  const record = rateLimitStore.get(ip);

  if (!record || now > record.resetTime) {
    rateLimitStore.set(ip, {
      count: 1,
      resetTime: now + RATE_LIMIT.windowMs,
    });
    return null; // Allow request
  }

  if (record.count >= RATE_LIMIT.maxRequests) {
    return NextResponse.json(
      { ok: false, error: 'Too many requests, please try again later' },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil((record.resetTime - now) / 1000)),
        },
      }
    );
  }

  record.count++;
  return null; // Allow request
}

// Clean up old entries periodically - disabled to prevent build hangs
/*
const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build';
if (typeof setInterval !== 'undefined' && !isBuildPhase) {
  setInterval(() => {
    const now = Date.now();
    for (const [ip, record] of rateLimitStore.entries()) {
      if (now > record.resetTime) {
        rateLimitStore.delete(ip);
      }
    }
  }, 60000); // Clean up every minute
}
*/

export function addSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // CORS headers for API - allow mobile app connections
  // Allow all origins for development (restrict in production)
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-role, x-source, x-passkey, Accept');
  response.headers.set('Access-Control-Allow-Credentials', 'true');
  response.headers.set('Access-Control-Max-Age', '86400'); // Cache preflight for 24 hours

  return response;
}

