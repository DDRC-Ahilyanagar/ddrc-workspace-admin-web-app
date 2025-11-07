import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, addSecurityHeaders } from './lib/middleware';

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Apply security headers
  addSecurityHeaders(response);

  // Apply rate limiting to API routes
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const rateLimitResponse = rateLimit(request);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }
  }

  return response;
}

export const config = {
  matcher: [
    '/api/:path*',
  ],
};

