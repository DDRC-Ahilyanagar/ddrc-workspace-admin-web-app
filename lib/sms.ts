const SMS_CONFIG = {
  url: process.env.SMS_URL || 'https://msg.icloudsms.com/rest/services/sendSMS/sendGroupSms',
  authKey: process.env.SMS_AUTH_KEY || '7e717a70bd48264130d89f149c798bc4',
  senderId: process.env.SMS_SENDER_ID || 'DDRCVK',
  routeId: process.env.SMS_ROUTE_ID || '1',
  contentType: process.env.SMS_CONTENT_TYPE || 'english',
};

function getDLTTemplate(): string {
  const template = process.env.SMS_OTP_TEMPLATE;
  if (!template) {
    throw new Error('SMS_OTP_TEMPLATE environment variable is required for DLT compliance');
  }
  if (!template.includes('{#var#}')) {
    throw new Error('SMS_OTP_TEMPLATE must contain {#var#} placeholder for DLT compliance');
  }
  return template;
}

export function buildDLTMessage(otp: string): string {
  if (!otp || typeof otp !== 'string') {
    throw new Error('OTP must be a non-empty string');
  }
  
  const cleanOtp = otp.replace(/\D/g, '');
  if (!cleanOtp || cleanOtp.length === 0) {
    throw new Error('OTP must contain at least one digit');
  }
  
  const template = getDLTTemplate();
  const message = template.replace('{#var#}', cleanOtp);
  
  const isProduction = process.env.NODE_ENV === 'production';
  const logPreview = isProduction 
    ? message.replace(cleanOtp, '****').substring(0, 50)
    : message.substring(0, 50);
  
  console.log('[SMS] DLT Message built:', {
    length: message.length,
    preview: logPreview,
  });
  
  return message;
}

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
    
    const isProduction = process.env.NODE_ENV === 'production';
    const logMessage = isProduction 
      ? message.replace(/\d{4,}/g, '****').substring(0, 50) + '...'
      : message.substring(0, 100) + '...';
    
    console.log('[SMS] Message to send:', logMessage);
    console.log('[SMS] Full URL:', url.substring(0, 200) + '...');
    
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
    // 3001 = Success (alternative success code)
    // 3002 = Invalid sender ID
    // 3003 = Invalid route ID
    // 3004 = Invalid mobile number
    // 3005 = Insufficient balance
    // 3006 = DLT template not approved
    // Other codes = Various errors
    const isSuccess = httpCode >= 200 && httpCode < 300 && 
                      (responseCode === '2001' || responseCode === '3001' || responseCode === '200' || responseCode === undefined);
    
    const errorMessages: Record<string, string> = {
      '3002': 'Invalid senderId (DDRCVK) - may not be approved/registered',
      '3003': 'Invalid routeId',
      '3004': 'Invalid mobile number format',
      '3005': 'Insufficient SMS balance',
      '3006': 'DLT template not approved',
    };
    
    let errorMessage: string | undefined;
    if (!isSuccess) {
      if (responseCode && errorMessages[responseCode]) {
        errorMessage = errorMessages[responseCode];
      } else if (httpCode < 200 || httpCode >= 300) {
        errorMessage = `HTTP Error: ${httpCode}`;
      } else if (responseCode) {
        errorMessage = `SMS Service Error: ${responseCode}`;
      } else {
        errorMessage = 'SMS sending failed - unknown error';
      }
      console.error('[SMS] Error:', {
        httpCode,
        responseCode,
        errorMessage,
        raw: raw.substring(0, 200),
      });
    }

    console.log('[SMS] Response:', {
      httpCode,
      responseCode,
      raw: raw.substring(0, 200), // Log first 200 chars
      success: isSuccess,
      error: errorMessage,
    });

    return {
      ok: isSuccess,
      raw,
      status: httpCode,
      responseCode,
      error: errorMessage,
    };
  } catch (error: any) {
    console.error('[SMS] Error:', {
      name: error.name,
      message: error.message,
      cause: error.cause,
      url: SMS_CONFIG.url,
    });
    return {
      ok: false,
      error: error.message || 'Unknown error',
      raw: null,
      status: 0,
    };
  }
}


