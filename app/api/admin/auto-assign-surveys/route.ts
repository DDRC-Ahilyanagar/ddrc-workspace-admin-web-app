import { NextRequest, NextResponse } from 'next/server';
import { Logger } from '@/lib/logger';
import { autoAssignSurveys } from '@/lib/auto-assign-surveys';

export const dynamic = 'force-dynamic';

/**
 * Auto-assign surveys based on GAV (village) matching
 * This endpoint is called by the scheduled job every 5 minutes
 * 
 * Logic:
 * 1. Find unassigned surveys (source = 'Divyang Self' and user_id = 1)
 * 2. Extract GAV (village) from survey_json
 * 3. Find online field officers and their GAV (from their latest survey)
 * 4. Match and assign surveys to field officers with matching GAV
 */
export async function POST(request: NextRequest) {
  try {
    // Optional: Add API token check for security
    // Only require token if it's set in environment
    const authHeader = request.headers.get('authorization');
    const apiToken = process.env.AUTO_ASSIGN_API_TOKEN || '';
    
    // If API token is configured, require it; otherwise allow without auth (for internal calls)
    if (apiToken && apiToken.trim() !== '') {
      if (!authHeader || authHeader !== `Bearer ${apiToken}`) {
        Logger.warn('AUTO_ASSIGN_UNAUTHORIZED', {
          hasHeader: !!authHeader,
          hasToken: !!apiToken,
        });
        return NextResponse.json(
          { ok: false, error: 'Unauthorized: Valid API token required' },
          { status: 401 }
        );
      }
    }

    // Use the shared auto-assignment function
    const result = await autoAssignSurveys();
    
    return NextResponse.json({
      ok: result.ok,
      message: result.message,
      assigned: result.assigned,
      checked: result.checked,
      details: result.details
    });
  } catch (error: any) {
    Logger.error('AUTO_ASSIGN_ERROR', {
      error: error?.message || String(error),
      stack: error?.stack
    });
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || 'Failed to auto-assign surveys',
        assigned: 0
      },
      { status: 500 }
    );
  }
}

