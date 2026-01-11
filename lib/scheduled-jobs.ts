import cron from 'node-cron';
import { Logger } from './logger';
import { autoAssignSurveys } from './auto-assign-surveys';

// Lock flag to prevent concurrent auto-assignment runs
let isAutoAssignRunning = false;

/**
 * Poll for unassigned surveys and assign them
 * Runs every 10 seconds
 */
async function pollAndAssignSurveys() {
  // Prevent concurrent executions
  if (isAutoAssignRunning) {
    Logger.info('AUTO_ASSIGN_POLL_SKIPPED', {
      reason: 'Previous assignment still running',
      timestamp: new Date().toISOString()
    });
    return;
  }

  isAutoAssignRunning = true;
  
  try {
    Logger.info('AUTO_ASSIGN_POLL_STARTED', {
      timestamp: new Date().toISOString()
    });

    // Call autoAssignSurveys without surveyId to process all unassigned surveys
    const result = await autoAssignSurveys();
    
    if (result.ok && result.assigned > 0) {
      Logger.info('AUTO_ASSIGN_POLL_SUCCESS', {
        assigned: result.assigned,
        checked: result.checked,
        message: result.message,
        timestamp: new Date().toISOString()
      });
    } else if (result.checked > 0) {
      Logger.info('AUTO_ASSIGN_POLL_NO_ASSIGNMENTS', {
        checked: result.checked,
        message: result.message,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error: any) {
    Logger.error('AUTO_ASSIGN_POLL_ERROR', {
      error: error?.message || String(error),
      stack: error?.stack,
      timestamp: new Date().toISOString()
    });
  } finally {
    isAutoAssignRunning = false;
  }
}

/**
 * Initialize scheduled jobs
 * This should be called when the server starts
 */
export function initializeScheduledJobs() {
  // Schedule daily stats email at 9 PM (21:00) every day
  // Cron format: minute hour day month day-of-week
  // '0 21 * * *' means: at 21:00 (9 PM) every day
  cron.schedule('0 21 * * *', async () => {
    Logger.info('DAILY_STATS_EMAIL_JOB_STARTED', { timestamp: new Date().toISOString() });
    
    try {
      // For internal server-side calls, use localhost with the correct port
      // Prefer NEXT_PUBLIC_APP_URL if set, otherwise construct from PORT
      const port = process.env.PORT || '3000';
      const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 
                      process.env.API_BASE_URL || 
                      process.env.NEXT_PUBLIC_APP_URL ||
                      `http://127.0.0.1:${port}`;
      const apiToken = process.env.DAILY_STATS_API_TOKEN || '';
      
      // Remove trailing slash and ensure we have the correct base URL
      const cleanBaseUrl = baseUrl.replace(/\/$/, '');
      const url = `${cleanBaseUrl}/api/admin/send-daily-stats`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiToken ? { 'Authorization': `Bearer ${apiToken}` } : {}),
        },
      });

      // Check if response is OK and is JSON
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        Logger.error('DAILY_STATS_EMAIL_JOB_FAILED', {
          timestamp: new Date().toISOString(),
          status: response.status,
          statusText: response.statusText,
          error: errorText.substring(0, 200), // Limit error text length
        });
        return;
      }

      // Check content type before parsing JSON
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const text = await response.text().catch(() => 'Unknown error');
        Logger.error('DAILY_STATS_EMAIL_JOB_INVALID_RESPONSE', {
          timestamp: new Date().toISOString(),
          contentType,
          response: text.substring(0, 200), // Limit response text length
        });
        return;
      }

      const result = await response.json();
      
      if (result.ok) {
        Logger.info('DAILY_STATS_EMAIL_JOB_SUCCESS', {
          timestamp: new Date().toISOString(),
          summary: result.summary,
        });
      } else {
        Logger.error('DAILY_STATS_EMAIL_JOB_FAILED', {
          timestamp: new Date().toISOString(),
          error: result.error,
        });
      }
    } catch (error: any) {
      Logger.error('DAILY_STATS_EMAIL_JOB_ERROR', {
        timestamp: new Date().toISOString(),
        error: error?.message || String(error),
        stack: error?.stack,
      });
    }
  }, {
    timezone: 'Asia/Kolkata', // Indian Standard Time
  });

  // Auto-assign surveys polling service
  // Runs every 10 seconds to check for unassigned surveys
  // Only processes surveys with:
  // - user_id = 1 (unassigned)
  // - source = 'Divyang Self' or 'Excel Import'
  // - Has a gaav (village) in survey_json
  // - Not already in survey_assignments table
  const pollInterval = setInterval(() => {
    pollAndAssignSurveys().catch((error) => {
      Logger.error('AUTO_ASSIGN_POLL_INTERVAL_ERROR', {
        error: error?.message || String(error),
        timestamp: new Date().toISOString()
      });
    });
  }, 10000); // 10 seconds = 10000 milliseconds

  // Start the first poll immediately (after 5 seconds to let server fully start)
  setTimeout(() => {
    pollAndAssignSurveys().catch((error) => {
      Logger.error('AUTO_ASSIGN_POLL_INITIAL_ERROR', {
        error: error?.message || String(error),
        timestamp: new Date().toISOString()
      });
    });
  }, 5000);

  Logger.info('SCHEDULED_JOBS_INITIALIZED', {
    daily_stats_email: 'Scheduled at 9:00 PM IST daily',
    auto_assign_surveys: 'Polling every 10 seconds for unassigned surveys',
  });
}

