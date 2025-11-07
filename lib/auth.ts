import { NextRequest, NextResponse } from 'next/server';
import { dbQueryOne } from './db';

export interface AuthUser {
  id: number;
  name: string;
  phone: string; // contact number
  user_type: string;
  is_active: number;
}

export async function verifyAuth(request: NextRequest): Promise<{ user: AuthUser | null; error: string | null }> {
  try {
    // Check for Authorization header or session token
    const authHeader = request.headers.get('authorization');
    const sessionToken = request.cookies.get('session_token')?.value;
    
    if (!authHeader && !sessionToken) {
      return { user: null, error: 'Authentication required' };
    }

    // For now, we'll use phone-based authentication
    // In production, you might want to use JWT tokens
    const phone = authHeader?.replace('Bearer ', '') || sessionToken || '';
    
    if (!phone) {
      return { user: null, error: 'Invalid authentication token' };
    }

    // Query using contact_number column (phone column doesn't exist)
    const user = await dbQueryOne<AuthUser>(
      `SELECT id,
              name,
              contact_number AS phone,
              COALESCE(user_type, '') AS user_type,
              CASE
                WHEN status IS NOT NULL THEN (status = 'active')
                WHEN is_active IS NOT NULL THEN is_active
                ELSE 1
              END AS is_active
       FROM users
       WHERE contact_number = ?
         AND (status = 'active' OR is_active = 1 OR status IS NULL)
       LIMIT 1`,
      [phone]
    );

    if (!user) {
      return { user: null, error: 'User not found or inactive' };
    }

    return { user, error: null };
  } catch (error: any) {
    return { user: null, error: error.message };
  }
}

export function requireAuth(handler: (request: NextRequest, user: AuthUser) => Promise<NextResponse>) {
  return async (request: NextRequest) => {
    const { user, error } = await verifyAuth(request);
    
    if (!user || error) {
      return NextResponse.json(
        { ok: false, error: error || 'Authentication required' },
        { status: 401 }
      );
    }

    return handler(request, user);
  };
}

