const SMS_CONFIG = {
  url: process.env.SMS_URL || 'https://msg.icloudsms.com/rest/services/sendSMS/sendGroupSms',
  authKey: process.env.SMS_AUTH_KEY || '7e717a70bd48264130d89f149c798bc4',
  senderId: 'DDRCVK',
  routeId: process.env.SMS_ROUTE_ID || '1',
  contentType: process.env.SMS_CONTENT_TYPE || 'english',
};

function getDLTTemplate(type: 'login' | 'registration' = 'login'): string {
  // New approved English template as the primary default
  const DEFAULT_TEMPLATE = 'Dear User, Your OTP to login at DDRC, Nagar is {#var#} Please do not share this with anyone. For Queries contact. 9022147060. VIKHE PATIL FOUNDATION ';

  const template = process.env.SMS_OTP_TEMPLATE || DEFAULT_TEMPLATE;

  if (!template.includes('{#var#}')) {
    console.warn('[SMS] WARNING: Template does not contain {#var#} placeholder, using default template');
    return DEFAULT_TEMPLATE;
  }

  return template;
}

export function buildDLTMessage(otp: string, type: 'login' | 'registration' = 'login'): string {
  if (!otp || typeof otp !== 'string') {
    throw new Error('OTP must be a non-empty string');
  }

  const cleanOtp = otp.replace(/\D/g, '');
  if (!cleanOtp || cleanOtp.length === 0) {
    throw new Error('OTP must contain at least one digit');
  }

  const template = getDLTTemplate(type);
  const message = template.replace('{#var#}', cleanOtp);

  const isProduction = process.env.NODE_ENV === 'production';
  const logPreview = isProduction
    ? message.replace(cleanOtp, '****').substring(0, 50)
    : message.substring(0, 50);

  console.log('[SMS] DLT Message built:', {
    length: message.length,
    preview: logPreview,
    type
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
    const isUnicode = /[^\x00-\x7F]/.test(message);
    const contentType = isUnicode ? 'unicode' : SMS_CONFIG.contentType;

    params.append('smsContentType', contentType);
    params.append('peid', process.env.SMS_PEID || '1201159134371424108');
    params.append('templateid', process.env.SMS_TEMPLATE_ID || '1207161546059282362');

    const url = `${SMS_CONFIG.url}?${params.toString()}`;

    // High visibility logging
    console.log('\n🔵 --- SMS API REQUEST ---');
    console.log('URL:', url.replace(SMS_CONFIG.authKey, '***AUTH_KEY***'));
    console.log('Mobile:', mobile);
    console.log('SenderID:', SMS_CONFIG.senderId);
    console.log('Content-Type:', params.get('smsContentType'));
    console.log('Message Length:', message.length);
    console.log('--------------------------\n');

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Cache-Control': 'no-cache',
      },
    });

    const httpCode = response.status;
    const raw = await response.text();

    console.log('\n🟢 --- SMS API RESPONSE ---');
    console.log('Status Code:', httpCode);
    console.log('Raw Response:', raw);
    console.log('---------------------------\n');

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
 * Generate a registration number based on the specified format:
 * [MMYY][TALUKA_SHORT][VILLAGE_SHORT][AADHAAR_LAST4]
 * Example: 0126KOLRAH5678 (Jan 2026, Kolhapur taluka, Rahimatpur village, Aadhaar ends in 5678)
 * 
 * @param aadhaarNumber - The full Aadhaar number (12 digits)
 * @param village - Village name (Marathi or English)
 * @param taluka - Taluka name (Marathi or English)
 * @returns Formatted registration number string
 */
export function generateRegistrationNumber(
  aadhaarNumber: string,
  village: string = 'UNK',
  taluka: string = 'UNK'
): string {
  // 1. Month and Year (mmyy, where yy is last 2 digits of year)
  const now = new Date();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const year = now.getFullYear().toString().substring(2);
  const mmyy = `${month}${year}`;

  // 2. Taluka and Village short codes (3 characters each)
  // Instead of stripping all non-English chars (which breaks for Marathi names),
  // we take the first 3 characters of whatever name is provided.
  const talukaShort = (taluka || 'UNK').trim().substring(0, 3).toUpperCase().padEnd(3, 'X');
  const villageShort = (village || 'UNK').trim().substring(0, 3).toUpperCase().padEnd(3, 'X');

  // 3. Last 4 digits of Aadhaar
  const cleanAadhaar = aadhaarNumber.replace(/\D/g, '');
  const aadhaarLast4 = cleanAadhaar.length >= 4
    ? cleanAadhaar.substring(cleanAadhaar.length - 4)
    : cleanAadhaar.padStart(4, '0');

  // Format: DDRC/mmyy/TAL/LAST4
  // Length: 4 + 1 + 4 + 1 + 3 + 1 + 4 = 18 characters (Safe < 20)
  const registrationNumber = `DDRC/${mmyy}/${talukaShort}/${aadhaarLast4}`;

  console.log('[SMS] Generated registration number:', {
    registrationNumber,
    aadhaar: `****${aadhaarLast4}`,
    village,
    taluka,
    mmyy
  });

  return registrationNumber;
}

/**
 * Get registration number with label
 */
export function getPublicFormCompletionTemplate(registrationNumber?: string): string {
  const regNumVar = registrationNumber || 'DDRC/0000/UNK/0000';
  const template = `दिव्यांग नोंदणी सेवेसाठी आपली प्राथमिक माहिती यशस्वीरित्या नोंदवली गेली आहे. आपला नोंदणी क्रमांक: {#var#}. दिव्यांग सेवा लाभ व पुढील पडताळणीसाठी आमचे क्षेत्रीय सर्वेक्षण अधिकारी लवकरच आपल्याशी संपर्क साधतील. काही शंका असल्यास संपर्क करा: 0241 277 7772. धन्यवाद – PADMSHRI DR VITHALRAO VIKHE PATIL FOUNDATION`;
  return template.replace('{#var#}', regNumVar);
}

/**
 * Get the form completion SMS template for field officer form submissions (fully completed)
 */
function getFieldOfficerCompletionTemplate(): string {
  const DEFAULT_TEMPLATE = 'आपला सर्वेक्षण फॉर्म पूर्णपणे नोंदवण्यात आला आहे. पुढील प्रक्रिया संबंधित विभागा मार्फत लवकरच राबवली जाईल. काही शंका असल्यास कृपया संपर्क करा: 0241 277 7772. धन्यवाद.– VIKHE PATIL FOUNDATION';
  return process.env.SMS_FIELD_OFFICER_COMPLETION_TEMPLATE || DEFAULT_TEMPLATE;
}

/**
 * Field Officer submission notification template
 */
export function getFieldOfficerSubmissionNotificationTemplate(holderName: string, registrationNumber: string): string {
  const regText = registrationNumber ? ` (रजिस्ट्रेशन नंबर: ${registrationNumber})` : '';
  return `नवीन सर्वेक्षण प्राप्त झाले आहे: ${holderName}${regText}. कृपया पुढील कार्यवाहीसाठी तपासा. धन्यवाद. PADMSHRI DR VITHALRAO VIKHE PATIL FOUNDATION`;
}

/**
 * Build SMS message for form completion notification
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
 * Get the field officer signup success SMS template
 */
export function getFieldOfficerSignupTemplate(): string {
  return 'आपण यशस्वीपणे नोंदणी केली आहे. Admin मंजुरीनंतर लॉगिन करता येईल. मंजुरी SMS द्वारे कळवली जाईल.PADMSHRI DR VITHALRAO VIKHE PATIL FOUNDATION';
}

/**
 * Get the field officer approval success SMS template
 */
export function getFieldOfficerApprovalTemplate(): string {
  return 'आपले खाते Admin कडून मंजूर झाले आहे. आता आपण लॉगिन करू शकता. PADMSHRI DR VITHALRAO VIKHE PATIL FOUNDATION';
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

    // High priority: Check for direct phone property
    if (surveyJson.phone || surveyJson.mobile) {
      const explicitPhone = String(surveyJson.phone || surveyJson.mobile).replace(/\D/g, '');
      if (explicitPhone.length === 10 && /^[6-9]/.test(explicitPhone)) {
        return explicitPhone;
      }
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
        // if (questionId !== 157 && questionId !== 9) { // Skip parent's mobile number
        return digits;
        // }
      }
    }

    // Double fallback: Explicitly check for Parent's mobile (question_id 9) if we still haven't found one
    // behaving strictly on IDs now that we are desperate
    for (const item of items) {
      const questionId = item.question_id || item.questionId;
      if (questionId === 9) {
        const answer = item.answer || item.value || '';
        const digits = String(answer).replace(/\D/g, '');
        if (digits.length === 10 && /^[6-9]/.test(digits)) {
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
 * This function also handles sending notification SMS to the assigned/submitting field officer
 * 
 * @param surveyJson - The survey data containing answers
 * @param surveyId - Optional survey ID for logging
 * @param isFieldOfficerSubmission - true if submitted by field officer (fully completed), false for public (partial)
 * @param registrationNumber - Optional registration number to include in SMS
 * @param officerPhone - Optional phone number of the field officer to notify
 */
export async function sendFormCompletionSMS(
  surveyJson: any,
  surveyId?: number,
  isFieldOfficerSubmission: boolean = false,
  registrationNumber?: string,
  officerPhone?: string
): Promise<{ ok: boolean; phone?: string; error?: string; officer_notified?: boolean }> {
  try {
    const phone = extractDivyangPhone(surveyJson);
    const holderName = surveyJson?.holder_name || surveyJson?.name || 'Divyang';

    if (!phone) {
      console.log('[SMS] No valid phone number found in survey data', { survey_id: surveyId });
      // If we have an officer phone, we might still want to notify them?
      // But usually we need the beneficiary phone for the primary SMS
    }

    // 1. Send SMS to beneficiary/applicant
    let success = false;
    let smsError = '';
    if (phone) {
      const message = buildFormCompletionMessage(isFieldOfficerSubmission, registrationNumber);
      const result = await sendSMS(phone, message);
      success = result.ok;
      smsError = result.error || '';

      if (success) {
        console.log('[SMS] Form completion SMS sent to beneficiary successfully', {
          phone: phone.substring(0, 3) + '****' + phone.substring(7),
          survey_id: surveyId
        });
      } else {
        console.error('[SMS] Failed to send form completion SMS to beneficiary', {
          phone: phone.substring(0, 3) + '****' + phone.substring(7),
          survey_id: surveyId,
          error: smsError
        });
      }
    }

    // 2. Notification for field officer is handled strictly via FCM in autoAssignSurveys
    // No SMS is sent to field officer as per requirements
    let officerNotified = false;
    /* 
    if (officerPhone) {
      // ... (code removed)
    }
    */

    return {
      ok: success,
      phone: phone || undefined,
      error: smsError || undefined,
      officer_notified: officerNotified
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
