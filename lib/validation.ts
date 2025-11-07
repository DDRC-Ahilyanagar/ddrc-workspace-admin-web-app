export function validatePhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, '');
  return digits.length === 10;
}

export function validateOTP(otp: string): boolean {
  const digits = otp.replace(/\D/g, '');
  return digits.length === 6;
}

export function validateAadhar(aadhar: string): boolean {
  const digits = aadhar.replace(/\D/g, '');
  return digits.length === 12;
}

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function sanitizeInput(input: string): string {
  return input.trim().replace(/[<>]/g, '');
}

export function validateRequired(value: any): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateRequest(body: any, rules: Record<string, (value: any) => boolean>): ValidationResult {
  const errors: string[] = [];
  
  for (const [field, validator] of Object.entries(rules)) {
    if (!validator(body[field])) {
      errors.push(`Invalid ${field}`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

