// Default template with {#var#} placeholder
const DEFAULT_OTP_TEMPLATE = 'Dear User, Your OTP to login at DDRC, Nagar is {#var#} Please do not share this with anyone. For Queries contact. 9022147060. VIKHE PATIL FOUNDATION ';

// Get template from env or use default
const envTemplate = process.env.SMS_OTP_TEMPLATE;
let finalTemplate = envTemplate || DEFAULT_OTP_TEMPLATE;

// If env template doesn't contain {#var#}, use default
if (envTemplate && !envTemplate.includes('{#var#}')) {
  console.warn('[SMS] WARNING: SMS_OTP_TEMPLATE from env does not contain {#var#}, using default template');
  console.warn('[SMS] Env template:', envTemplate);
  finalTemplate = DEFAULT_OTP_TEMPLATE;
}

const SMS_CONFIG = {
  url: process.env.SMS_URL || 'http://msg.icloudsms.com/rest/services/sendSMS/sendGroupSms',
  authKey: process.env.SMS_AUTH_KEY || '7e717a70bd48264130d89f149c798bc4',
  senderId: process.env.SMS_SENDER_ID || 'DRCVK',
  routeId: process.env.SMS_ROUTE_ID || '1',
  contentType: process.env.SMS_CONTENT_TYPE || 'english',
  otpTemplate: finalTemplate,
};

export async function sendSMS(mobile: string, message: string): Promise<{ ok: boolean; raw?: any; status?: number; error?: string; responseCode?: string }> {
  try {
    // URLSearchParams automatically encodes the message, but we need to ensure proper encoding
    const params = new URLSearchParams();
    params.append('AUTH_KEY', SMS_CONFIG.authKey);
    params.append('message', message); // URLSearchParams will encode this properly
    params.append('senderId', SMS_CONFIG.senderId);
    params.append('routeId', SMS_CONFIG.routeId);
    params.append('mobileNos', mobile);
    params.append('smsContentType', SMS_CONFIG.contentType);

    const url = `${SMS_CONFIG.url}?${params.toString()}`;
    
    // Log the actual message being sent (for debugging)
    console.log('[SMS] Message to send:', message);
    console.log('[SMS] Full URL:', url.substring(0, 200) + '...'); // Log partial URL for debugging
    
    // Log the URL and parameters for debugging (without exposing sensitive data)
    console.log('[SMS] Sending SMS:', {
      url: SMS_CONFIG.url,
      senderId: SMS_CONFIG.senderId,
      routeId: SMS_CONFIG.routeId,
      mobile: mobile,
      contentType: SMS_CONFIG.contentType,
      messageLength: message.length,
    });
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    const httpCode = response.status;
    const raw = await response.text();
    
    // Parse the response to check for error codes
    let parsedResponse: any = null;
    let responseCode: string | undefined;
    try {
      parsedResponse = JSON.parse(raw);
      responseCode = parsedResponse.responseCode;
    } catch (e) {
      // Response is not JSON, keep raw text
    }

    // Check if responseCode indicates an error
    // iCloudSMS response codes:
    // 2001 = Success
    // 3001 = Invalid credentials/Auth key
    // 3002 = Invalid sender ID
    // 3003 = Invalid route ID
    // 3004 = Invalid mobile number
    // 3005 = Insufficient balance
    // 3006 = DLT template not approved
    // Other codes = Various errors
    const isSuccess = httpCode >= 200 && httpCode < 300 && 
                      (responseCode === '2001' || responseCode === '200' || responseCode === undefined);
    
    if (!isSuccess && responseCode) {
      const errorMessages: Record<string, string> = {
        '3001': 'Invalid AUTH_KEY or credentials',
        '3002': 'Invalid senderId (DRCVK) - may not be approved/registered',
        '3003': 'Invalid routeId',
        '3004': 'Invalid mobile number format',
        '3005': 'Insufficient SMS balance',
        '3006': 'DLT template not approved',
      };
      console.error('[SMS] Error Code:', responseCode, errorMessages[responseCode] || 'Unknown error');
    }

    console.log('[SMS] Response:', {
      httpCode,
      responseCode,
      raw: raw.substring(0, 200), // Log first 200 chars
      success: isSuccess,
    });

    return {
      ok: isSuccess,
      raw,
      status: httpCode,
      responseCode,
    };
  } catch (error: any) {
    console.error('[SMS] Error:', error);
    return {
      ok: false,
      error: error.message,
      raw: null,
    };
  }
}

export function getOTPMessage(otp: string): string {
  // Validate OTP input
  if (!otp || typeof otp !== 'string') {
    console.error('[SMS] ERROR: Invalid OTP passed to getOTPMessage:', otp);
    throw new Error('OTP must be a non-empty string');
  }
  
  // Clean OTP: remove any non-digit characters and ensure it's only digits
  const cleanOtp = otp.replace(/\D/g, '');
  if (!cleanOtp || cleanOtp.length === 0) {
    console.error('[SMS] ERROR: OTP contains no digits:', otp);
    throw new Error('OTP must contain at least one digit');
  }
  
  // Directly concatenate OTP into the message
  const message = `Dear User, Your OTP to login at DDRC, Nagar is ${cleanOtp} Please do not share this with anyone. For Queries contact. 9022147060. VIKHE PATIL FOUNDATION `;
  
  console.log('[SMS] OTP:', cleanOtp);
  console.log('[SMS] Final message:', message);
  console.log('[SMS] Message length:', message.length);
  
  return message;
}

