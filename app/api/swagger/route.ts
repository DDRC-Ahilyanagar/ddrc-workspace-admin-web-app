import swaggerJsdoc from 'swagger-jsdoc';
import { NextResponse } from 'next/server';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'DDRC Survey API',
      version: '1.0.0',
      description: 'API documentation for DDRC Survey Portal',
    },
    servers: [
      {
        url: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000',
        description: 'Development server',
      },
    ],
    tags: [
      { name: 'Authentication', description: 'Authentication endpoints' },
      { name: 'Aadhaar', description: 'Aadhaar card management' },
      { name: 'Questions', description: 'Survey questions' },
      { name: 'Sections', description: 'Survey sections' },
      { name: 'Location', description: 'Location data (talukas, villages, grams)' },
      { name: 'Address', description: 'Address processing' },
      { name: 'Answers', description: 'Survey answers submission' },
      { name: 'OCR', description: 'Optical Character Recognition for card processing' },
      { name: 'Upload', description: 'File upload endpoints' },
      { name: 'System', description: 'System endpoints (health, monitoring)' },
    ],
  },
  apis: ['./app/api/**/route.ts'],
};

const swaggerSpec = swaggerJsdoc(options);

export async function GET() {
  return NextResponse.json(swaggerSpec);
}

