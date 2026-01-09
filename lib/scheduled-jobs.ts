import cron from 'node-cron';
import { Logger } from './logger';

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

  // NOTE: Auto-assign surveys polling job has been removed
  // Surveys are now assigned immediately when submitted via public form
  // The auto-assignment happens in real-time in submit-answers route

  Logger.info('SCHEDULED_JOBS_INITIALIZED', {
    daily_stats_email: 'Scheduled at 9:00 PM IST daily',
    auto_assign_surveys: 'Immediate assignment on submission (no polling)',
  });
}

