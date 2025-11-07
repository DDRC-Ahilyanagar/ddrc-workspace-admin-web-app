import { NextRequest, NextResponse } from 'next/server';
import { Logger } from '@/lib/logger';
import { CONFIG } from '@/lib/config';

/**
 * @swagger
 * /api/arrange-address:
 *   post:
 *     summary: Arrange address using Gemini AI
 *     tags: [Address]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               street:
 *                 type: string
 *               village:
 *                 type: string
 *               taluka:
 *                 type: string
 *               district:
 *                 type: string
 *               state:
 *                 type: string
 *               pincode:
 *                 type: string
 *               full_address:
 *                 type: string
 *     responses:
 *       200:
 *         description: Address arranged successfully
 *       400:
 *         description: No address data provided
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    Logger.info('hit_arrange_address', { raw: JSON.stringify(body), req: body });

    // Sanitization for noisy OCR tokens and non-address phrases
    const sanitize = (text: string): string => {
      if (!text) return '';
      let t = String(text);
      // Remove phone numbers
      t = t.replace(/\b\+?\d{10,}\b/g, '');
      // Remove common Aadhaar card boilerplate/noise words
      const blacklist = [
        'information',
        'to establish identity',
        'authenticate online',
        'note:',
        'children on attaining',
        'years of age',
        'need to update biometric information',
        'non-government services',
        'government services',
        'future',
        'father:',
        'mother:',
        'guardian:',
        'female', // also remove gender tokens from address
        'male',
        'afrifemale',
        'afrimale',
      ];
      for (const w of blacklist) {
        const re = new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, r => r), 'gi');
        t = t.replace(re, '');
      }
      // Remove relationship tokens D/O, S/O, W/O, etc.
      t = t.replace(/\b([dsw]\/?o)\.?/gi, '');
      // Collapse duplicate commas and spaces
      t = t.replace(/\s*,\s*,+/g, ', ').replace(/\s{2,}/g, ' ').replace(/\s*\,\s*/g, ', ').trim();
      // Trim leading/trailing commas
      t = t.replace(/^,+|,+$/g, '').trim();
      return t;
    };

    const street = sanitize(body.street || '');
    const village = sanitize(body.village || '');
    const taluka = sanitize(body.taluka || '');
    const district = sanitize(body.district || '');
    const state = sanitize(body.state || '');
    const pincode = sanitize(body.pincode || '');
    const fullAddress = sanitize(body.full_address || '');

    // Heuristic gender detection from provided text fields
    const detectGender = (text: string): '' | 'Male' | 'Female' => {
      if (!text) return '';
      const t = text.toLowerCase();
      // Strong keywords first
      if (/(female|wife|daughter)\b/i.test(text)) return 'Female';
      if (/(male|husband|son)\b/i.test(text)) return 'Male';
      // Relationship abbreviations
      if (/(d\/o|d-?o)/i.test(text)) return 'Female';
      if (/(s\/o|s-?o)/i.test(text)) return 'Male';
      return '';
    };
    // For gender detection, use the original raw text fields if available to avoid over-sanitization
    const rawConcat = [body.street, body.village, body.taluka, body.district, body.state, body.pincode, body.full_address]
      .filter(Boolean)
      .join(' ');
    const gender = detectGender(rawConcat);

    const components: string[] = [];
    if (street) components.push(`Street/Building: ${street}`);
    if (village) components.push(`Village: ${village}`);
    if (taluka) components.push(`Taluka: ${taluka}`);
    if (district) components.push(`District: ${district}`);
    if (state) components.push(`State: ${state}`);
    if (pincode) components.push(`Pincode: ${pincode}`);

    let addressComponentsText = components.join('\n');
    if (fullAddress) {
      if (addressComponentsText) {
        addressComponentsText += `\n\nFull Address (from OCR):\n${fullAddress}`;
      } else {
        addressComponentsText = `Full Address (from OCR):\n${fullAddress}`;
      }
    }

    if (!addressComponentsText) {
      return NextResponse.json(
        { success: false, error: 'No address data provided' },
        { status: 400 }
      );
    }

    // Build the prompt (same as PHP version)
    const prompt = `You are an expert in Indian geography and address formatting. Your task is to parse the given address information, filter out OCR errors, identify each address component correctly, use your knowledge to fill in missing information, and return a complete and accurate Indian address.

**Given Address Components:**
${addressComponentsText}

**Your Task:**
1. **FILTER OUT OCR ERRORS:**
   - Remove random OCR artifacts (e.g., "Scamed", "wim", "Camiscaser", "frE", "HEINISE", "ArrG", "afRr", "3TETT")
   - Remove incomplete words, meaningless strings, and gibberish
   - Keep only legitimate Indian address components

2. **IDENTIFY AND CLASSIFY each address component:**
   - **Building/Apartment**: Building names, apartment names, house numbers
   - **Locality/Street**: Street names, area names, locality names
   - **Village**: Village names
   - **Taluka/Tehsil**: Taluka or tehsil names
   - **District**: District names
   - **State**: State name
   - **Pincode**: 6-digit pincode

3. **USE YOUR KNOWLEDGE TO FILL MISSING INFORMATION:**
   - **PRIORITY ORDER (MOST IMPORTANT FIRST):**
     1. **FIRST: Use information explicitly mentioned in the address text** - If the address text clearly mentions a district, taluka, village, or state, USE IT. Trust the OCR-extracted text as the primary source.
     2. **SECOND: Use pincode lookup** - If a component is missing but pincode is provided, use your Indian postal code database knowledge to identify the missing component from the pincode.
     3. **THIRD: Use geographic knowledge** - Only if the above two don't help, use your general geographic knowledge.
   
   - **PINCODE VERIFICATION:**
     * If pincode is provided AND a component (district/taluka) is already mentioned in the address text:
       - Verify if the mentioned component matches the pincode
       - If they match, use the mentioned component (trust the address text)
       - If they don't match, use your Indian postal code lookup to determine the correct component from the pincode (pincode is authoritative)
     * If pincode is provided BUT a component is missing:
       - Use your Indian postal code database to identify the missing component from the pincode
     * Use accurate Indian postal code lookup data - look up the actual postal records, don't guess
   
   - **EXTRACTION FROM ADDRESS TEXT:**
     * Carefully read the full address text provided
     * Extract and use any district names, taluka names, village names, or state names that are clearly mentioned
     * Even if there are OCR errors, if you can clearly identify a valid Indian district/taluka/village name, use it
     * Filter out OCR artifacts but keep legitimate geographic names
   
   - **VERIFICATION**: 
     * After extracting components, cross-check with pincode if available
     * If there's a conflict between address text and pincode lookup, prefer pincode lookup as it's more authoritative
     * Ensure all components are consistent with each other and with Indian postal system

4. **ARRANGE IN CORRECT SEQUENCE:**
   Arrange components in this EXACT order (include all that are available or can be identified):
   - Building/Apartment (if available)
   - Locality/Street (if available)
   - Village (if available or identifiable)
   - Taluka (if available or identifiable from village/district)
   - District (if available or identifiable)
   - State (if available or identifiable - default to Maharashtra if district/taluka suggests it)
   - Pincode (if available)

5. **OUTPUT FORMAT - Return JSON:**
   You MUST return a valid JSON object with the following structure:
   {
     "building": "Building/Apartment name or empty string",
     "locality": "Locality/Street name or empty string",
     "village": "Village name or empty string",
     "taluka": "Taluka/Tehsil name or empty string",
     "district": "District name or empty string",
     "state": "State name or empty string",
     "pincode": "6-digit pincode or empty string",
     "formatted": "Complete formatted address with commas"
   }
   
   - For each component, use empty string "" if not available
   - The "formatted" field should contain the complete address in comma-separated format
   - Do NOT add labels or prefixes in the formatted address
   - Return ONLY valid JSON, no explanations or additional text
   - Ensure the address is complete and accurate using your knowledge

6. **General Guidelines:**
   - Extract all valid Indian geographic names from the address text, even if mixed with OCR errors
   - Use pincode lookup from Indian postal code database to verify and fill missing components
   - If address text mentions a district/taluka but pincode lookup shows different information, trust the pincode as authoritative
   - Filter out all OCR artifacts while preserving legitimate address components
   - Return complete and accurate addresses based on actual Indian postal system data

**IMPORTANT:**
- Return ONLY valid JSON in the exact format specified above
- Do NOT add explanations, notes, labels, or any text outside the JSON
- Use your geographic knowledge to complete missing components
- Ensure the address is accurate and complete
- Filter out all OCR errors completely
- The JSON must be parseable - no extra text before or after

Now, parse the given address, filter OCR errors, identify components, use your knowledge to fill missing information, and return the JSON object with all components and formatted address:`;

    const requestBody = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
        topK: 1,
        topP: 0.8,
        maxOutputTokens: 200,
      },
    };

    const models = ['gemini-1.5-flash', 'gemini-2.0-flash-exp', 'gemini-1.5-pro'];
    const apiVersions = ['v1beta', 'v1'];

    for (const apiVersion of apiVersions) {
      for (const model of models) {
        try {
          const url = `https://generativelanguage.googleapis.com/${apiVersion}/models/${model}:generateContent?key=${CONFIG.GEMINI_API_KEY}`;
          
          const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
          });

          if (response.ok) {
            const data = await response.json();
            const parts = data.candidates?.[0]?.content?.parts || [];
            const firstText = Array.isArray(parts) && parts.length > 0 && parts[0]?.text ? parts[0].text : '';
            if (firstText) {
              let text = String(firstText).trim();
              text = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '');
              try {
                const addressJson = JSON.parse(text);
                if (addressJson) {
                  const formatted = addressJson.formatted || 
                    [addressJson.building, addressJson.locality, addressJson.village, 
                     addressJson.taluka, addressJson.district, addressJson.state, 
                     addressJson.pincode].filter(Boolean).join(', ');

                  return NextResponse.json({
                    success: true,
                    address: formatted,
                    formatted,
                    components: {
                      building: addressJson.building || '',
                      locality: addressJson.locality || '',
                      village: addressJson.village || '',
                      taluka: addressJson.taluka || '',
                      district: addressJson.district || '',
                      state: addressJson.state || '',
                      pincode: addressJson.pincode || '',
                    },
                    gender,
                    model_used: model,
                  });
                }
              } catch {}
            }
          }
        } catch (e) {
          continue;
        }
      }
    }

    // Fallback: best-effort formatting without AI to avoid 500s
    const fallbackFormatted = [
      street || undefined,
      village || undefined,
      taluka || undefined,
      district || undefined,
      state || undefined,
      pincode || undefined,
    ].filter(Boolean).join(', ');

    return NextResponse.json({
      success: true,
      address: fallbackFormatted,
      formatted: fallbackFormatted,
      components: {
        building: '',
        locality: '',
        village,
        taluka,
        district,
        state,
        pincode,
      },
      gender,
      model_used: 'fallback',
    });
  } catch (error: any) {
    Logger.error('arrange_address_exception', { error: error.message });
    return NextResponse.json(
      { success: false, error: `Server error: ${error.message}` },
      { status: 500 }
    );
  }
}

