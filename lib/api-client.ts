const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api';

export interface ApiResponse<T = any> {
  ok: boolean;
  error?: string;
  [key: string]: any;
}

export async function apiCall<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(`${API_BASE}/${endpoint}`, {
      ...options,
      credentials: 'include',
      cache: 'no-store', // Prevent caching
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        ...options.headers,
      },
    });

    const data = await response.json();
    return data;
  } catch (error: any) {
    console.error('API call failed:', error);
    return {
      ok: false,
      error: error.message || 'Network error',
    };
  }
}

export async function sendOTP(phone: string, source: 'web' | 'mobile' = 'mobile'): Promise<ApiResponse> {
  return apiCall('send-otp', {
    method: 'POST',
    body: JSON.stringify({ phone, source }),
  });
}

export async function fetchUserByPhone(phone: string): Promise<ApiResponse> {
  return apiCall('app/dashboard', {
    method: 'POST',
    body: JSON.stringify({ phone }),
  });
}

export async function verifyOTP(phone: string, otp: string, name: string, source: 'web' | 'mobile' = 'mobile'): Promise<ApiResponse> {
  return apiCall('verify-otp', {
    method: 'POST',
    body: JSON.stringify({ phone, otp, name, source }),
  });
}

export async function uploadImage(file: File): Promise<string | null> {
  try {
    const formData = new FormData();
    formData.append('files', file);
    
    const userName = typeof window !== 'undefined' ? localStorage.getItem('user_name') || '' : '';
    const userPhone = typeof window !== 'undefined' ? localStorage.getItem('user_phone') || '' : '';
    if (userName) formData.append('user_name', userName);
    if (userPhone) formData.append('user_phone', userPhone);

    const response = await fetch(`${API_BASE}/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error('Upload failed');
    }

    const data = await response.json();
    // Prefer path over url, as path is always relative and won't have localhost issues
    return data.path || data.url || null;
  } catch (error) {
    console.error('Image upload failed:', error);
    return null;
  }
}

export async function getQuestions(): Promise<ApiResponse> {
  return apiCall('get-questions');
}

export async function createAadhar(aadharNo: string, frontImage?: string, backImage?: string): Promise<ApiResponse> {
  const payload: any = {
    aadhar_no: aadharNo,
    user_id: 1,
  };
  if (frontImage) payload.front_image = frontImage;
  if (backImage) payload.back_image = backImage;

  return apiCall('create-aadhar', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function submitAnswers(userId: number, aadharId: number, items: any[], source?: string): Promise<ApiResponse> {
  return apiCall('submit-answers', {
    method: 'POST',
    body: JSON.stringify({
      user_id: userId,
      aadhar_id: aadharId,
      items,
      source: source || 'Divyang Self',
    }),
  });
}

export async function processOCR(imageFile: File, cardType: 'aadhaar' | 'udid'): Promise<ApiResponse> {
  try {
    const formData = new FormData();
    formData.append('image', imageFile);
    formData.append('card_type', cardType);

    const response = await fetch(`${API_BASE}/ocr`, {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('OCR API error:', {
        status: response.status,
        statusText: response.statusText,
        error: data.error || data.message || 'Unknown error',
        fullResponse: data
      });
      return {
        ok: false,
        error: data.error || data.message || `OCR processing failed (${response.status})`,
      };
    }

    return data;
  } catch (error: any) {
    console.error('OCR processing failed:', error);
    return {
      ok: false,
      error: error.message || 'OCR processing failed - Network error',
    };
  }
}

export async function processOCRDual(frontImage: File | null, backImage: File | null, cardType: 'aadhaar' | 'udid' = 'aadhaar', passkey?: string): Promise<ApiResponse> {
  try {
    const formData = new FormData();
    if (frontImage) formData.append('front_image', frontImage);
    if (backImage) formData.append('back_image', backImage);
    formData.append('card_type', cardType);

    const response = await fetch(`${API_BASE}/ocr`, {
      method: 'POST',
      body: formData,
      headers: passkey ? { 'x-passkey': passkey } as any : undefined,
    });

    const data = await response.json();
    return data;
  } catch (error: any) {
    console.error('OCR processing (dual) failed:', error);
    return { ok: false, error: error.message || 'OCR processing failed' };
  }
}

