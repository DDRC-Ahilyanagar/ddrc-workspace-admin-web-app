# DDRC Survey API - Full Stack Next.js

This is a full-stack Next.js application with API routes that replicate all PHP backend functionality.

## API Endpoints

All API endpoints are located in `app/api/` directory and follow Next.js App Router conventions.

### Authentication Endpoints

- **POST `/api/send-otp`** - Send OTP to phone number
- **POST `/api/verify-otp`** - Verify OTP and login user

### Aadhaar Endpoints

- **POST `/api/create-aadhar`** - Create or update Aadhaar record
- **POST `/api/get-aadhar-images`** - Get Aadhaar card images (front/back)

### Questions & Sections

- **GET `/api/get-questions`** - Get all survey questions
- **GET `/api/get-section-name`** - Get section name by ID

### Location Data

- **GET `/api/get-talukas`** - Get all talukas
- **GET `/api/get-villages`** - Get villages by taluka (query param: `taluka`)
- **GET `/api/get-grams`** - Get grams by taluka (query param: `taluka`)

### Address Processing

- **POST `/api/arrange-address`** - Arrange address using Gemini AI
  - Uses Google Gemini API to format and validate Indian addresses
  - Filters OCR errors and fills missing components using pincode lookup

### Survey Answers

- **POST `/api/submit-answers`** - Submit survey answers

### Documentation

- **GET `/api/swagger`** - Get Swagger/OpenAPI specification (JSON)
- **GET `/api-docs`** - Interactive Swagger UI documentation page

## Database Connection

Database configuration is managed through environment variables:
- `DB_HOST` - Database host (default: 127.0.0.1)
- `DB_USER` - Database username
- `DB_PASS` - Database password
- `DB_NAME` - Database name

Connection pooling is handled automatically via `lib/db.ts`.

## SMS Integration

SMS sending is configured via environment variables:
- `SMS_URL` - SMS provider URL
- `SMS_AUTH_KEY` - SMS authentication key
- `SMS_SENDER_ID` - SMS sender ID
- `SMS_ROUTE_ID` - SMS route ID
- `SMS_OTP_TEMPLATE` - OTP message template

## Gemini AI Integration

Address arrangement uses Google Gemini API:
- `GEMINI_API_KEY` - Gemini API key (configured in `lib/config.ts`)
- Automatically tries multiple models with fallback
- Filters OCR errors and validates Indian addresses

## Logging

All API requests are logged to `storage/logs/ddrc_api.log` using the Logger utility in `lib/logger.ts`.

## Swagger Documentation

Interactive API documentation is available at `/api-docs` page. The Swagger specification is automatically generated from JSDoc comments in API route files.

### Example Swagger Documentation

```typescript
/**
 * @swagger
 * /api/send-otp:
 *   post:
 *     summary: Send OTP to phone number
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               phone:
 *                 type: string
 */
```

## Environment Variables

Create a `.env.local` file (see `.env.local.example`) with:

```env
DB_HOST=127.0.0.1
DB_USER=your_db_user
DB_PASS=your_db_password
DB_NAME=your_db_name

SMS_URL=http://msg.icloudsms.com/rest/services/sendSMS/sendGroupSms
SMS_AUTH_KEY=your_sms_auth_key
SMS_SENDER_ID=ddrcvk
SMS_ROUTE_ID=1

OTP_EXPIRY_MINUTES=5

GEMINI_API_KEY=your_gemini_api_key

NEXT_PUBLIC_API_URL=/api
```

## Running the Application

```bash
# Development
npm run dev

# Production build
npm run build
npm start
```

## API Client

The frontend uses the API client in `lib/api-client.ts` which automatically routes to `/api` endpoints. All API calls return a consistent response format:

```typescript
{
  ok: boolean;
  error?: string;
  [key: string]: any;
}
```

