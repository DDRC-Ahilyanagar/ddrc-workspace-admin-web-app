# Registration Number Format for Public Forms

## Format Options

### Format 1: DDRC/DIVYANG/MMYY/GAAV/TALUKA/AADHAR4
**Structure:** `DDRC/DIVYANG/MMYY/GAAV_SHORT/TALUKA_SHORT/AADHAR_LAST4`

**Examples:**
- `DDRC/DIVYANG/0124/PUNE/PUNE/1234` (January 2024, Pune, Pune, Aadhaar ends with 1234)
- `DDRC/DIVYANG/0324/AHMED/AHMED/5678` (March 2024, Ahmednagar, Ahmednagar, Aadhaar ends with 5678)
- `DDRC/DIVYANG/1224/NASHIK/NASHIK/9012` (December 2024, Nashik, Nashik, Aadhaar ends with 9012)

### Format 2: DD/MMYY/GAV/TAL/AADHAR4 (Shorter)
**Structure:** `DD/MMYY/GAAV_SHORT/TALUKA_SHORT/AADHAR_LAST4`

**Examples:**
- `DD/0124/PN/PN/1234` (January 2024, Pune short: PN, Aadhaar ends with 1234)
- `DD/0324/AHM/AHM/5678` (March 2024, Ahmednagar short: AHM, Aadhaar ends with 5678)
- `DD/1224/NSK/NSK/9012` (December 2024, Nashik short: NSK, Aadhaar ends with 9012)

### Format 3: DDRC-DIVYANG-MMYY-GAV-TAL-AADHAR4 (With hyphens)
**Structure:** `DDRC-DIVYANG-MMYY-GAAV_SHORT-TALUKA_SHORT-AADHAR_LAST4`

**Examples:**
- `DDRC-DIVYANG-0124-PUNE-PUNE-1234`
- `DDRC-DIVYANG-0324-AHMED-AHMED-5678`
- `DDRC-DIVYANG-1224-NASHIK-NASHIK-9012`

## Recommended Format: Format 1

**Format:** `DDRC/DIVYANG/MMYY/GAAV_SHORT/TALUKA_SHORT/AADHAR_LAST4`

### Rules:
1. **Prefix:** Always starts with `DDRC/DIVYANG/`
2. **Month/Year:** `MMYY` format (e.g., 0124 for January 2024, 1224 for December 2024)
3. **Village Short Form:** First 4-6 uppercase letters of village name (remove spaces, special chars)
4. **Taluka Short Form:** First 4-6 uppercase letters of taluka name (remove spaces, special chars)
5. **Aadhaar Last 4:** Last 4 digits of Aadhaar number
6. **Separator:** Forward slash `/` between segments

### Short Form Generation Rules:
- Convert to uppercase
- Remove spaces, special characters, and diacritics
- Take first 4-6 characters
- If village/taluka name is short (< 4 chars), use full name in uppercase
- If name contains common words like "Nagar", "Pur", "Gao", etc., include them in short form

### More Examples:

**Example 1:**
- Date: January 15, 2024
- Village: "Pune City"
- Taluka: "Pune"
- Aadhaar: 123456789012
- **Registration:** `DDRC/DIVYANG/0124/PUNEC/PUNE/9012`

**Example 2:**
- Date: March 20, 2024
- Village: "Ahmednagar Nagar"
- Taluka: "Ahmednagar"
- Aadhaar: 987654321098
- **Registration:** `DDRC/DIVYANG/0324/AHMED/AHMED/1098`

**Example 3:**
- Date: December 5, 2024
- Village: "Nashik Road"
- Taluka: "Nashik"
- Aadhaar: 456789012345
- **Registration:** `DDRC/DIVYANG/1224/NASHIK/NASHIK/2345`

**Example 4:**
- Date: February 10, 2024
- Village: "Shirdi"
- Taluka: "Rahata"
- Aadhaar: 789012345678
- **Registration:** `DDRC/DIVYANG/0224/SHIRD/RAHAT/5678`

**Example 5:**
- Date: November 25, 2024
- Village: "Aurangabad"
- Taluka: "Aurangabad"
- Aadhaar: 234567890123
- **Registration:** `DDRC/DIVYANG/1124/AURAN/AURAN/0123`

## Implementation Notes

- Generate registration number only for public form submissions (source: "Divyang Self")
- Store registration number in database (add new column `registration_number` to `surveys` table)
- Include registration number in SMS sent to divyang
- Registration number should be unique (can add sequence number if needed for uniqueness)
