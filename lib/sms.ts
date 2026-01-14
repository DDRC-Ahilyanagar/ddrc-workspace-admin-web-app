const SMS_CONFIG = {
  url: process.env.SMS_URL || 'https://msg.icloudsms.com/rest/services/sendSMS/sendGroupSms',
  authKey: process.env.SMS_AUTH_KEY || '7e717a70bd48264130d89f149c798bc4',
  senderId: process.env.SMS_SENDER_ID || 'DDRCVK',
  routeId: process.env.SMS_ROUTE_ID || '1',
  contentType: process.env.SMS_CONTENT_TYPE || 'english',
};

function getDLTTemplate(): string {
  // Default template with {#var#} placeholder
  const DEFAULT_OTP_TEMPLATE = 'Dear User, Your OTP to login at DDRC, Nagar is {#var#} Please do not share this with anyone. For Queries contact. 9022147060. VIKHE PATIL FOUNDATION';

  const template = process.env.SMS_OTP_TEMPLATE || DEFAULT_OTP_TEMPLATE;

  if (!template.includes('{#var#}')) {
    console.warn('[SMS] WARNING: Template does not contain {#var#} placeholder, using default template');
    return DEFAULT_OTP_TEMPLATE;
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

/**
 * Get the form completion SMS template for public form submissions
 * Can be configured via SMS_FORM_COMPLETION_TEMPLATE environment variable
 * If not set, returns a default Marathi message for partial submissions
 */
function getPublicFormCompletionTemplate(registrationNumber?: string): string {
  // Default Marathi message informing divyang about successful submission
  // "Your primary information has been successfully recorded..."
  let DEFAULT_TEMPLATE = 'आपली प्राथमिक माहिती यशस्वीरित्या नोंदवली गेली आहे.';

  if (registrationNumber) {
    DEFAULT_TEMPLATE += ` आपला नोंदणी क्रमांक: ${registrationNumber}.`;
  }

  DEFAULT_TEMPLATE += ' पुढील टप्प्यासाठी आमचे क्षेत्रीय सर्वेक्षण अधिकारी लवकरच आपल्याशी संपर्क साधून सविस्तर माहिती नोंदवतील. काही शंका असल्यास कृपया संपर्क करा: 0241 277 7772. धन्यवाद.– VIKHE PATIL FOUNDATION';

  const template = process.env.SMS_FORM_COMPLETION_TEMPLATE || DEFAULT_TEMPLATE;

  // Replace {REG_NUM} placeholder if present in custom template
  if (registrationNumber && template.includes('{REG_NUM}')) {
    return template.replace('{REG_NUM}', registrationNumber);
  }

  return template;
}

/**
 * Get the form completion SMS template for field officer form submissions (fully completed)
 * Can be configured via SMS_FIELD_OFFICER_COMPLETION_TEMPLATE environment variable
 * If not set, returns a default Marathi message for fully completed forms
 */
function getFieldOfficerCompletionTemplate(): string {
  // Default Marathi message informing divyang that their form is fully completed
  // "Your survey form has been fully recorded..."
  const DEFAULT_TEMPLATE = 'आपला सर्वेक्षण फॉर्म पूर्णपणे नोंदवण्यात आला आहे. पुढील प्रक्रिया संबंधित विभागा मार्फत लवकरच राबवली जाईल. काही शंका असल्यास कृपया संपर्क करा: 0241 277 7772. धन्यवाद.– VIKHE PATIL FOUNDATION';

  const template = process.env.SMS_FIELD_OFFICER_COMPLETION_TEMPLATE || DEFAULT_TEMPLATE;

  return template;
}

/**
 * Build SMS message for form completion notification
 * @param isFieldOfficerSubmission - true if submitted by field officer (fully completed), false for public (partial)
 * @param registrationNumber - Optional registration number to include in public form SMS
 */
export function buildFormCompletionMessage(isFieldOfficerSubmission: boolean = false, registrationNumber?: string): string {
  const message = isFieldOfficerSubmission
    ? getFieldOfficerCompletionTemplate()
    : getPublicFormCompletionTemplate(registrationNumber);

  const isProduction = process.env.NODE_ENV === 'production';
  const logPreview = message.substring(0, 50);

  console.log('[SMS] Form Completion Message built:', {
    length: message.length,
    preview: logPreview,
    isFieldOfficerSubmission,
    has_registration_number: !!registrationNumber,
  });

  return message;
}

/**
 * Extract divyang's phone number from survey data
 * Looks for answers that match phone number pattern (10 digits starting with 6-9)
 * Also checks known question IDs for mobile number fields (question_id 100 is typically mobile number)
 * Returns the first valid 10-digit phone number found
 */
export function extractDivyangPhone(surveyJson: any): string | null {
  try {
    if (!surveyJson || typeof surveyJson !== 'object') {
      return null;
    }

    // Handle both array format and object format
    const items = Array.isArray(surveyJson) ? surveyJson :
      (surveyJson.items || surveyJson.answers || []);

    if (!Array.isArray(items)) {
      return null;
    }

    // Known question IDs for mobile number fields (can be extended)
    // Question 100 is typically "मोबाईल नं" (Mobile Number)
    const mobileQuestionIds = [100, 6];

    // First, try to find by question_id (more reliable)
    for (const item of items) {
      const questionId = item.question_id || item.questionId;
      const answer = item.answer || item.value || '';

      if (mobileQuestionIds.includes(questionId)) {
        const digits = String(answer).replace(/\D/g, '');
        if (digits.length === 10 && /^[6-9]/.test(digits)) {
          return digits;
        }
      }
    }

    // Fallback: Look for any answer that looks like a valid Indian mobile number
    // This handles cases where question_id might not be in our known list
    for (const item of items) {
      const answer = item.answer || item.value || '';
      const digits = String(answer).replace(/\D/g, '');

      // Validate it's a 10-digit Indian mobile number (starts with 6-9)
      if (digits.length === 10 && /^[6-9]/.test(digits)) {
        // Additional check: make sure it's not a parent's mobile (question 157 is parent mobile)
        const questionId = item.question_id || item.questionId;
        if (questionId !== 157 && questionId !== 9) { // Skip parent's mobile number
          return digits;
        }
      }
    }

    return null;
  } catch (error: any) {
    console.error('[SMS] Error extracting phone from survey:', error);
    return null;
  }
}

/**
 * Send SMS to divyang after form completion
 * This is called asynchronously after successful form submission
 * @param surveyJson - The survey data containing answers
 * @param surveyId - Optional survey ID for logging
 * @param isFieldOfficerSubmission - true if submitted by field officer (fully completed), false for public (partial)
 * @param registrationNumber - Optional registration number to include in SMS
 */
export async function sendFormCompletionSMS(surveyJson: any, surveyId?: number, isFieldOfficerSubmission: boolean = false, registrationNumber?: string): Promise<{ ok: boolean; phone?: string; error?: string }> {
  try {
    const phone = extractDivyangPhone(surveyJson);

    if (!phone) {
      console.log('[SMS] No valid phone number found in survey data', { survey_id: surveyId });
      return { ok: false, error: 'No valid phone number found' };
    }

    const message = buildFormCompletionMessage(isFieldOfficerSubmission, registrationNumber);
    const result = await sendSMS(phone, message);

    if (result.ok) {
      console.log('[SMS] Form completion SMS sent successfully', {
        phone: phone.substring(0, 3) + '****' + phone.substring(7),
        survey_id: surveyId
      });
    } else {
      console.error('[SMS] Failed to send form completion SMS', {
        phone: phone.substring(0, 3) + '****' + phone.substring(7),
        survey_id: surveyId,
        error: result.error
      });
    }

    return {
      ok: result.ok,
      phone,
      error: result.error,
    };
  } catch (error: any) {
    console.error('[SMS] Error in sendFormCompletionSMS:', {
      error: error.message,
      survey_id: surveyId,
    });
    return {
      ok: false,
      error: error.message || 'Unknown error',
    };
  }
}


