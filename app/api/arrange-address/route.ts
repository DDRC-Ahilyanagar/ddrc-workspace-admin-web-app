/**
 * @fileoverview Address Arrangement and Sanitization API Route
 * @module app/api/arrange-address
 * @description This API endpoint processes and formats address components extracted from
 * Aadhaar cards or other documents. It sanitizes OCR noise, removes boilerplate text,
 * and formats the address into a standardized structure.
 * 
 * @author DDRC Development Team
 * @created 2026-02-14
 * @lastModified 2026-02-17
 * 
 * Key Features:
 * - Removes OCR noise and artifacts from address text
 * - Filters out Aadhaar card boilerplate text
 * - Detects gender from relationship indicators (S/O, D/O, W/O)
 * - Formats address components into a standardized structure
 * - Removes phone numbers and non-address information
 * 
 * @see {@link https://surveyapi.ddrcnagar.in/api-docs} API Documentation
 */

import { NextRequest, NextResponse } from 'next/server';
import { Logger } from '@/lib/logger';
import { CONFIG } from '@/lib/config';

/**
 * @swagger
 * /api/arrange-address:
 *   post:
 *     summary: Arrange address components
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
    if (street) components.push(street);
    if (village) components.push(village);
    if (taluka) components.push(taluka);
    if (district) components.push(district);
    if (state) components.push(state);
    if (pincode) components.push(pincode);

    const formatted = components.join(', ');

    return NextResponse.json({
      success: true,
      address: formatted,
      formatted,
      components: {
        building: '',
        locality: street || '',
        village: village || '',
        taluka: taluka || '',
        district: district || '',
        state: state || '',
        pincode: pincode || '',
      },
      gender,
      model_used: 'heuristic',
    });
  } catch (error: any) {
    Logger.error('arrange_address_exception', { error: error.message });
    return NextResponse.json(
      { success: false, error: `Server error: ${error.message}` },
      { status: 500 }
    );
  }
}

