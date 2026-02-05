import { getDbPool } from './db';
import { Logger } from './logger';

export type SignupStep =
  | 'selfie_uploaded'
  | 'personal_info_entered'
  | 'otp_sent'
  | 'otp_verified'
  | 'territory_selected'
  | 'bank_details_saved'
  | 'profile_completed';

export interface SignupLogData {
  phone: string;
  user_id?: number;
  step: SignupStep;
  step_number: number;
  status: 'started' | 'completed' | 'failed';
  data?: any;
  error_message?: string;
}

/**
 * Log a field officer signup step
 */
export async function logSignupStep(logData: SignupLogData): Promise<void> {
  try {
    const pool = getDbPool();
    // Add timeout to connection attempt to avoid hanging the entire request
    const conn = await Promise.race([
      pool.getConnection(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Database connection timeout in logger')), 3000)
      )
    ]) as any;

    try {
      // Ensure table exists
      await conn.execute(`
        CREATE TABLE IF NOT EXISTS field_officer_signup_logs (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          user_id BIGINT UNSIGNED NULL,
          phone VARCHAR(20) NOT NULL,
          step VARCHAR(50) NOT NULL,
          step_number INT NOT NULL,
          status ENUM('started', 'completed', 'failed') DEFAULT 'started',
          data JSON NULL,
          error_message TEXT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          KEY idx_user_id (user_id),
          KEY idx_phone (phone),
          KEY idx_step (step),
          KEY idx_created_at (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);

      // Insert log entry
      await conn.execute(
        `INSERT INTO field_officer_signup_logs 
         (user_id, phone, step, step_number, status, data, error_message)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          logData.user_id || null,
          logData.phone,
          logData.step,
          logData.step_number,
          logData.status,
          logData.data ? JSON.stringify(logData.data) : null,
          logData.error_message || null,
        ]
      );

      Logger.info('SIGNUP_STEP_LOGGED', {
        phone: logData.phone,
        user_id: logData.user_id,
        step: logData.step,
        step_number: logData.step_number,
        status: logData.status,
      });
    } finally {
      conn.release();
    }
  } catch (error: any) {
    // Don't throw - logging should never break the main flow
    Logger.error('SIGNUP_LOG_ERROR', {
      error: error?.message,
      step: logData.step,
      phone: logData.phone,
    });
  }
}

/**
 * Get step number for a given step
 */
export function getStepNumber(step: SignupStep): number {
  const stepMap: Record<SignupStep, number> = {
    'selfie_uploaded': 1,
    'personal_info_entered': 2,
    'otp_sent': 2,
    'otp_verified': 3,
    'territory_selected': 4,
    'bank_details_saved': 5,
    'profile_completed': 5,
  };
  return stepMap[step] || 0;
}
