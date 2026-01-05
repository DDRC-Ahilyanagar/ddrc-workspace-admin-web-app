import { NextRequest, NextResponse } from 'next/server';
import { Logger } from '@/lib/logger';
import { handleSubmit } from '../submit-answers/route';

/**
 * Public form submission endpoint - no authentication required
 * Uses the same handleSubmit function as field officer app (/api/submit-answers)
 * This ensures both routes store data identically in surveys table with survey_json
 * 
 * Public route has its own questions (subset of all 221 questions) - kept as is
 * But storage format strictly follows field officer app pattern
 */
export async function POST(request: NextRequest) {
  try {
    // Read the original body as text to preserve it
    const bodyText = await request.text();
    let body: any = {};
    try {
      body = JSON.parse(bodyText);
    } catch {
      return NextResponse.json(
        { ok: false, error: 'Invalid JSON' },
        { status: 400 }
      );
    }
    
    // Normalize body to match submit-answers format
    // Accept both aadhar_id and aadhaar_id, convert to aadhaar_id (field officer app format)
    const normalizedBody = {
      ...body,
      aadhaar_id: body.aadhaar_id || body.aadhar_id,
      aadhar_id: body.aadhaar_id || body.aadhar_id, // Keep both for compatibility
      user_id: body.user_id || 1, // Public submissions use user_id = 1 (system user)
      source: body.source || 'Divyang Self', // Set default source for public submissions
    };

    // Create a new request with normalized body
    // handleSubmit will parse the body again, so we need to provide it as text
    const normalizedRequest = new NextRequest(request.url, {
      method: 'POST',
      headers: {
        ...Object.fromEntries(request.headers.entries()),
        'content-type': 'application/json',
      },
      body: JSON.stringify(normalizedBody),
    });

    // Call the same handleSubmit function used by field officer app
    // This ensures both routes use exactly the same storage logic
    // Pass user = null since this is a public (unauthenticated) submission
    return await handleSubmit(normalizedRequest, null);
  } catch (error: any) {
    Logger.error('PUBLIC_SUBMIT_FAILED', {
      error: error.message,
      stack: error.stack,
    });
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to submit survey' },
      { status: 500 }
    );
  }
}

