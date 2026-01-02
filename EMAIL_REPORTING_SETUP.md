# Email Reporting System Setup

## Overview
This document describes the daily email reporting system that sends dashboard statistics to admins and field officers every day at 8 PM IST.

## Features
- **Daily Reports**: Automatically sends email reports every 24 hours at 8:00 PM IST
- **Admin Reports**: Contains overall statistics and all field officers' performance
- **Field Officer Reports**: Contains individual statistics for each field officer
- **Email Logging**: All sent emails are logged in the `email_logs` table
- **Optional Email**: Field officers can optionally provide email during signup

## SQL Queries to Run

### 1. Create Email Logs Table
Run the SQL file: `create_email_logs_table.sql`
```sql
CREATE TABLE IF NOT EXISTS `email_logs` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `recipient_type` enum('admin','field_officer') NOT NULL,
  `recipient_email` varchar(255) NOT NULL,
  `recipient_user_id` bigint unsigned DEFAULT NULL,
  `email_subject` varchar(500) NOT NULL,
  `email_body` text NOT NULL,
  `status` enum('sent','failed','pending') DEFAULT 'pending',
  `error_message` text DEFAULT NULL,
  `sent_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_recipient_type` (`recipient_type`),
  KEY `idx_recipient_email` (`recipient_email`),
  KEY `idx_recipient_user_id` (`recipient_user_id`),
  KEY `idx_status` (`status`),
  KEY `idx_sent_at` (`sent_at`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `fk_email_logs_user` FOREIGN KEY (`recipient_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 2. Add Email Column to Access Requests Table
Run the SQL file: `add_email_to_access_requests.sql`
This adds an optional `email` column to the `access_requests` table for field officer signup.

## Environment Variables

Add these to your `.env` file:

```env
# SMTP Configuration (Hostinger)
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=587
SMTP_SECURE=false # STARTTLS
SMTP_USER=noreply@bitnix.store
SMTP_PASSWORD=Uegshle@1989!

# Optional: API Token for scheduled job authentication
DAILY_STATS_API_TOKEN=some-long-random-string

# Optional: Base URL for API calls (defaults to localhost:3000)
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000
```

**Note**: The SMTP configuration is already set up for Hostinger. Make sure your `.env` file contains these exact values.

## How It Works

1. **Scheduled Job**: The `instrumentation.ts` file initializes the scheduled job when the server starts
2. **Cron Schedule**: Runs every day at 8:00 PM IST (`0 20 * * *`)
3. **API Endpoint**: `/api/admin/send-daily-stats` handles the email sending logic
4. **Email Service**: `lib/email-service.ts` manages email sending and logging
5. **Database Logging**: Every email attempt is logged in `email_logs` table with status (sent/failed/pending)

## Email Content

### Admin Email Includes:
- Overall statistics (total surveys, completed, pending, active officers)
- Field officers performance table with individual stats

### Field Officer Email Includes:
- Individual statistics (completed, pending, total surveys)
- Wallet balance calculation (based on completed surveys)

## Flutter App Changes

The Flutter app (`request_access.dart`) now includes:
- Optional email input field during signup
- Email validation
- Email is sent to the backend with the access request

## Manual Testing

You can manually trigger the email sending by calling:
```bash
curl -X POST http://localhost:3000/api/admin/send-daily-stats \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer some-long-random-string"
```

Or if no token is set in `.env`, just:
```bash
curl -X POST http://localhost:3000/api/admin/send-daily-stats \
  -H "Content-Type: application/json"
```

**Note**: Make sure your `.env` file is in the root directory (`ddrc-workspace-admin-web-app/.env`) with the SMTP configuration provided.

## Monitoring

Check email logs:
```sql
SELECT * FROM email_logs ORDER BY created_at DESC LIMIT 50;
```

Check failed emails:
```sql
SELECT * FROM email_logs WHERE status = 'failed' ORDER BY created_at DESC;
```

## Troubleshooting

1. **Emails not sending**: Check SMTP configuration in `.env`
2. **Scheduled job not running**: Ensure `instrumentationHook: true` is in `next.config.mjs`
3. **No emails received**: Check `email_logs` table for error messages
4. **Field officers without email**: They are automatically skipped (no error)

