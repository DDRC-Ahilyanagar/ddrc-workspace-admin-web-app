import cron from 'node-cron';
import { Logger } from './logger';

/**
 * Initialize scheduled jobs
 * This should be called when the server starts
 */
export function initializeScheduledJobs() {
  // Schedule daily stats email at 8 PM (20:00) every day
  // Cron format: minute hour day month day-of-week
  // '0 20 * * *' means: at 20:00 (8 PM) every day
  cron.schedule('0 20 * * *', async () => {
    Logger.info('DAILY_STATS_EMAIL_JOB_STARTED', { timestamp: new Date().toISOString() });
    
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.API_BASE_URL || 'http://localhost:3000';
      const apiToken = process.env.DAILY_STATS_API_TOKEN || '';
      
      const url = `${baseUrl}/api/admin/send-daily-stats`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiToken ? { 'Authorization': `Bearer ${apiToken}` } : {}),
        },
      });

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
      });
    }
  }, {
    timezone: 'Asia/Kolkata', // Indian Standard Time
  });

  Logger.info('SCHEDULED_JOBS_INITIALIZED', {
    daily_stats_email: 'Scheduled at 8:00 PM IST daily',
  });
}

