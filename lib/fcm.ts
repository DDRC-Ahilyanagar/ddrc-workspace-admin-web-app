import { Logger } from './logger';
import { getDbPool } from './db';
import * as jwt from 'jsonwebtoken';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Get OAuth2 access token for FCM V1 API
 */
async function getAccessToken(): Promise<string | null> {
  try {
    let serviceAccount: any;
    
    // Try to load from file path first
    const serviceAccountPath = process.env.FCM_SERVICE_ACCOUNT_PATH;
    if (serviceAccountPath) {
      try {
        const fullPath = path.resolve(process.cwd(), serviceAccountPath);
        const fileContent = fs.readFileSync(fullPath, 'utf8');
        serviceAccount = JSON.parse(fileContent);
      } catch (fileError: any) {
        Logger.error('FCM_SERVICE_ACCOUNT_FILE_ERROR', {
          error: fileError.message,
          path: serviceAccountPath,
        });
        return null;
      }
    } else {
      // Try to load from environment variable
      const serviceAccountJson = process.env.FCM_SERVICE_ACCOUNT_JSON;
      if (!serviceAccountJson) {
        Logger.error('FCM_SERVICE_ACCOUNT_NOT_CONFIGURED', {
          note: 'FCM V1 API requires FCM_SERVICE_ACCOUNT_JSON or FCM_SERVICE_ACCOUNT_PATH',
        });
        return null;
      }
      serviceAccount = JSON.parse(serviceAccountJson);
    }

    const { private_key, client_email } = serviceAccount;
    const now = Math.floor(Date.now() / 1000);
    
    // Create JWT for OAuth2
    const token = jwt.sign(
      {
        iss: client_email,
        sub: client_email,
        aud: 'https://oauth2.googleapis.com/token',
        iat: now,
        exp: now + 3600, // 1 hour
        scope: 'https://www.googleapis.com/auth/firebase.messaging',
      },
      private_key,
      { algorithm: 'RS256' }
    );

    // Exchange JWT for access token
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: token,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      Logger.error('FCM_OAUTH_TOKEN_ERROR', { error });
      return null;
    }

    const result = await response.json();
    return result.access_token;
  } catch (error: any) {
    Logger.error('FCM_GET_ACCESS_TOKEN_ERROR', { error: error.message });
    return null;
  }
}

/**
 * Send FCM push notification to a user
 * Uses Firebase Cloud Messaging V1 API (recommended) with fallback to Legacy API
 */
export async function sendFCMPushNotification(
  userId: number,
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<{ ok: boolean; error?: string }> {
  try {
    // Try V1 API first (recommended)
    const serviceAccountPath = process.env.FCM_SERVICE_ACCOUNT_PATH;
    const serviceAccountJson = process.env.FCM_SERVICE_ACCOUNT_JSON;
    const projectId = process.env.FCM_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
    
    // Fallback to Legacy API if V1 not configured
    const fcmServerKey = process.env.FCM_SERVER_KEY;
    
    if (!serviceAccountJson && !serviceAccountPath && !fcmServerKey) {
      Logger.info('FCM_NOT_CONFIGURED', {
        user_id: userId,
        note: 'FCM push notifications disabled - no configuration found',
      });
      return { ok: false, error: 'FCM not configured' };
    }

    const pool = getDbPool();
    const conn = await pool.getConnection();

    try {
      // Get FCM token(s) for the user
      // First try users table
      let fcmTokens: string[] = [];
      
      try {
        const [userRows]: any = await conn.query(
          `SELECT fcm_token FROM users WHERE id = ? AND fcm_token IS NOT NULL AND fcm_token != ''`,
          [userId]
        );
        
        if (Array.isArray(userRows)) {
          fcmTokens = userRows
            .map((row: any) => row.fcm_token?.toString().trim())
            .filter((token: string) => token && token.length > 10);
        }
      } catch (e: any) {
        // If fcm_token column doesn't exist, try fcm_tokens table
        if (e.code === 'ER_BAD_FIELD_ERROR') {
          const [tokenRows]: any = await conn.query(
            `SELECT fcm_token FROM fcm_tokens WHERE user_id = ?`,
            [userId]
          );
          
          if (Array.isArray(tokenRows)) {
            fcmTokens = tokenRows
              .map((row: any) => row.fcm_token?.toString().trim())
              .filter((token: string) => token && token.length > 10);
          }
        } else {
          throw e;
        }
      }

      if (fcmTokens.length === 0) {
        Logger.info('FCM_NO_TOKEN_FOUND', {
          user_id: userId,
          note: 'User has no registered FCM token',
        });
        return { ok: false, error: 'No FCM token found for user' };
      }

      // Send notification to all tokens
      const results = await Promise.allSettled(
        fcmTokens.map(async (token) => {
          // Try V1 API first (recommended)
          if ((serviceAccountJson || serviceAccountPath) && projectId) {
            try {
              const accessToken = await getAccessToken();
              if (!accessToken) {
                throw new Error('Failed to get OAuth2 access token');
              }

              const v1Url = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;
              const response = await fetch(v1Url, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${accessToken}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  message: {
                    token: token,
                    notification: {
                      title: title,
                      body: body,
                    },
                    data: Object.fromEntries(
                      Object.entries(data || {}).map(([k, v]) => [k, String(v)])
                    ),
                    android: {
                      priority: 'high',
                      notification: {
                        sound: 'default',
                        channelId: 'ddrc_notifications',
                      },
                    },
                  },
                }),
              });

              // Check if response is JSON before parsing
              const contentType = response.headers.get('content-type') || '';
              let result: any;
              
              if (contentType.includes('application/json')) {
                try {
                  result = await response.json();
                } catch (jsonError: any) {
                  const text = await response.text();
                  Logger.error('FCM_V1_JSON_PARSE_ERROR', {
                    user_id: userId,
                    status: response.status,
                    statusText: response.statusText,
                    responseText: text.substring(0, 200),
                  });
                  throw new Error(`Invalid JSON response: ${response.statusText}`);
                }
              } else {
                const text = await response.text();
                Logger.error('FCM_V1_NON_JSON_RESPONSE', {
                  user_id: userId,
                  status: response.status,
                  statusText: response.statusText,
                  contentType: contentType,
                  responseText: text.substring(0, 200),
                });
                throw new Error(`Non-JSON response: ${response.status} ${response.statusText}`);
              }
              
              if (response.ok && result.name) {
                Logger.info('FCM_V1_PUSH_SENT', {
                  user_id: userId,
                  token: token.substring(0, 20) + '...',
                });
                return { ok: true, token };
              } else {
                Logger.error('FCM_V1_PUSH_FAILED', {
                  user_id: userId,
                  token: token.substring(0, 20) + '...',
                  error: result.error?.message || JSON.stringify(result),
                  status: response.status,
                });
                
                // If token is invalid, remove it from database
                if (result.error?.status === 'INVALID_ARGUMENT' || 
                    result.error?.status === 'NOT_FOUND') {
                  try {
                    await conn.query(
                      `DELETE FROM fcm_tokens WHERE user_id = ? AND fcm_token = ?`,
                      [userId, token]
                    );
                    Logger.info('FCM_TOKEN_REMOVED', { user_id: userId, reason: result.error?.status });
                  } catch (e) {
                    // Ignore cleanup errors
                  }
                }
                
                return { ok: false, token, error: result.error?.message || `HTTP ${response.status}` };
              }
            } catch (v1Error: any) {
              Logger.error('FCM_V1_ERROR', {
                user_id: userId,
                error: v1Error.message,
                note: 'Falling back to Legacy API if available',
              });
              // Fall through to Legacy API
            }
          }

          // Fallback to Legacy API if V1 failed or not configured
          if (fcmServerKey) {
            try {
              const response = await fetch('https://fcm.googleapis.com/fcm/send', {
                method: 'POST',
                headers: {
                  'Authorization': `key=${fcmServerKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  to: token,
                  notification: {
                    title: title,
                    body: body,
                    sound: 'default',
                  },
                  data: data || {},
                  priority: 'high',
                }),
              });

              // Check if response is JSON before parsing
              const contentType = response.headers.get('content-type') || '';
              let result: any;
              
              if (contentType.includes('application/json')) {
                try {
                  result = await response.json();
                } catch (jsonError: any) {
                  const text = await response.text();
                  Logger.error('FCM_LEGACY_JSON_PARSE_ERROR', {
                    user_id: userId,
                    status: response.status,
                    statusText: response.statusText,
                    responseText: text.substring(0, 200),
                  });
                  return { ok: false, token, error: `Invalid JSON response: ${response.statusText}` };
                }
              } else {
                const text = await response.text();
                Logger.error('FCM_LEGACY_NON_JSON_RESPONSE', {
                  user_id: userId,
                  status: response.status,
                  statusText: response.statusText,
                  contentType: contentType,
                  responseText: text.substring(0, 200),
                });
                return { ok: false, token, error: `Non-JSON response: ${response.status} ${response.statusText}` };
              }
              
              if (response.ok && result.success === 1) {
                Logger.info('FCM_LEGACY_PUSH_SENT', {
                  user_id: userId,
                  token: token.substring(0, 20) + '...',
                });
                return { ok: true, token };
              } else {
                Logger.error('FCM_LEGACY_PUSH_FAILED', {
                  user_id: userId,
                  token: token.substring(0, 20) + '...',
                  error: result.error || 'Unknown error',
                  status: response.status,
                });
                
                // If token is invalid, remove it from database
                if (result.error === 'InvalidRegistration' || result.error === 'NotRegistered') {
                  try {
                    await conn.query(
                      `DELETE FROM fcm_tokens WHERE user_id = ? AND fcm_token = ?`,
                      [userId, token]
                    );
                    Logger.info('FCM_TOKEN_REMOVED', { user_id: userId, reason: result.error });
                  } catch (e) {
                    // Ignore cleanup errors
                  }
                }
                
                return { ok: false, token, error: result.error || `HTTP ${response.status}` };
              }
            } catch (fetchError: any) {
              Logger.error('FCM_LEGACY_FETCH_ERROR', {
                user_id: userId,
                error: fetchError?.message || String(fetchError),
              });
              return { ok: false, token, error: fetchError?.message || 'Network error' };
            }
          }

          return { ok: false, token, error: 'Neither V1 nor Legacy API configured' };
        })
      );

      const successCount = results.filter(r => r.status === 'fulfilled' && r.value.ok).length;
      
      if (successCount > 0) {
        Logger.info('FCM_PUSH_COMPLETED', {
          user_id: userId,
          tokens_sent: successCount,
          tokens_total: fcmTokens.length,
        });
        return { ok: true };
      } else {
        return { ok: false, error: 'All FCM sends failed' };
      }
    } finally {
      conn.release();
    }
  } catch (error: any) {
    Logger.error('FCM_PUSH_ERROR', {
      user_id: userId,
      error: error.message,
    });
    return { ok: false, error: error.message };
  }
}
