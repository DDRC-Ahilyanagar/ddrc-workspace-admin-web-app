/**
 * Helper functions to extract filter data from surveys
 * Used for generating filtered reports
 */

export interface SurveyFilterData {
  taluka: string | null;
  district: string | null;
  gender: string | null;
  disability: string | null;
  udid: string | null;
  source: string | null;
  fieldOfficerName: string | null;
  fieldOfficerId: number | null;
}

/**
 * Extract answer from survey_json
 */
export function getAnswerFromJson(surveyJson: any, questionId: string | number): string | null {
  if (!surveyJson) return null;
  try {
    const json = typeof surveyJson === 'string' ? JSON.parse(surveyJson) : surveyJson;
    if (!json || typeof json !== 'object') return null;
    const qid = String(questionId);
    
    // Check various possible structures
    if (json[qid]) return String(json[qid]).trim();
    if (json.answers && json.answers[qid]) return String(json.answers[qid]).trim();
    
    // Check if answers is an array
    if (Array.isArray(json.answers)) {
      const item = json.answers.find((item: any) => 
        String(item?.question_id || item?.questionId) === qid
      );
      if (item) return String(item.answer || item.value || '').trim();
    }
    
    // Check if json itself is an array
    if (Array.isArray(json)) {
      const item = json.find((item: any) => 
        String(item?.question_id || item?.questionId) === qid
      );
      if (item) return String(item.answer || item.value || '').trim();
    }
    
    return null;
  } catch {
    return null;
  }
}

/**
 * Extract all filter data from a survey row
 */
export function extractFilterData(row: any): SurveyFilterData {
  // Get taluka and district from survey_aadhar table
  const taluka = row.taluka ? String(row.taluka).trim() : null;
  const district = row.district ? String(row.district).trim() : null;
  const gender = row.gender ? String(row.gender).trim() : null;
  
  // Extract disability type (question ID 69)
  const disabilityAnswer = getAnswerFromJson(row.survey_json, 69);
  let disability: string | null = null;
  if (disabilityAnswer) {
    // Normalize disability name - take first part before comma or parenthesis
    const normalized = disabilityAnswer.split(',')[0].split('(')[0].trim();
    disability = normalized || null;
  }
  
  // Extract UDID status (question ID 66)
  const udidAnswer = getAnswerFromJson(row.survey_json, 66);
  let udid: string | null = null;
  if (udidAnswer) {
    const udidLower = udidAnswer.toLowerCase();
    udid = (udidLower.includes('होय') || udidLower.includes('yes')) ? 'Yes' : 'No';
  }
  
  // Get source from surveys table
  const source = row.source ? String(row.source).trim() : null;
  
  // Get field officer info
  const fieldOfficerName = row.user_name ? String(row.user_name).trim() : null;
  const fieldOfficerId = row.user_id ? Number(row.user_id) : null;
  
  return {
    taluka: taluka || 'इतर',
    district: district || 'इतर',
    gender: gender || 'निर्दिष्ट नाही',
    disability: disability || 'निर्दिष्ट नाही',
    udid: udid || 'निर्दिष्ट नाही',
    source: source || 'Divyang Self',
    fieldOfficerName: fieldOfficerName || null,
    fieldOfficerId: fieldOfficerId || null,
  };
}

/**
 * Normalize filter value for file naming (remove special characters)
 */
export function normalizeForFileName(value: string): string {
  return value
    .replace(/[^a-zA-Z0-9\u0900-\u097F\s-]/g, '') // Keep alphanumeric, Devanagari, spaces, hyphens
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .trim();
}

/**
 * Generate file name for reports
 */
export function generateReportFileName(
  filterType: string,
  filterValue: string,
  date: Date,
  format: 'pdf' | 'xlsx'
): string {
  const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
  const normalizedValue = normalizeForFileName(filterValue);
  return `${filterType}-${normalizedValue}-${dateStr}.${format}`;
}

