# Survey Verification Workflow Setup

## Overview
This document describes the survey verification workflow system where:
1. Field officers capture surveys
2. Admin views surveys and suggests corrections
3. Verification officers view, edit, and verify surveys
4. Admin approves verified surveys

## SQL Queries to Run

### 1. Add Verification Officer Role
Run: `add_verification_officer_role.sql`
```sql
INSERT INTO `user_types` (`user_type`, `description`, `created_at`, `updated_at`)
SELECT 'verification_officer', 'Verification Officer - Can view and edit surveys, mark as verified', NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM `user_types` WHERE `user_type` = 'verification_officer'
);
```

### 2. Add Verification Columns to Surveys Table
Run: `add_survey_verification_columns.sql`
This adds the following columns to the `surveys` table:
- `verification_status` - ENUM('pending', 'under_review', 'verified', 'rejected')
- `admin_approval_status` - ENUM('pending', 'approved', 'rejected')
- `admin_corrections` - TEXT (for admin suggestions)
- `assigned_to` - BIGINT UNSIGNED (verification officer user_id)
- `verified_by` - BIGINT UNSIGNED (verification officer who verified)
- `verified_at` - TIMESTAMP
- `approved_by` - BIGINT UNSIGNED (admin who approved)
- `approved_at` - TIMESTAMP

## Workflow

### 1. Survey Capture
- Field officers capture surveys via mobile app
- Surveys with `source = 'Divyang Self'` are considered unassigned

### 2. Admin Actions
- **View Unassigned Surveys**: Admin can see all unassigned surveys in the dashboard
- **Add Corrections**: Admin can add correction suggestions to surveys
- **Assign to Verification Officer**: Admin can assign surveys to verification officers
- **Approve Verified Surveys**: Admin can approve surveys that have been verified

### 3. Verification Officer Actions
- **View Assigned Surveys**: Verification officers can see surveys assigned to them
- **Edit Surveys**: Verification officers can edit survey data based on admin corrections
- **Mark as Verified**: Verification officers can mark surveys as verified after corrections

### 4. Final Approval
- Admin reviews verified surveys and approves/rejects them

## API Endpoints

### GET /api/admin/surveys
- **Query Parameters**:
  - `filter=unassigned` - Show only unassigned surveys
  - `filter=pending` - Show pending verification
  - `filter=under_review` - Show under review
  - `filter=verified` - Show verified surveys
  - `filter=approved` - Show approved surveys

### POST /api/admin/surveys/[id]/verify
- **Role**: Admin only
- **Body**: `{ "corrections": "text" }`
- **Action**: Adds admin corrections and sets status to 'under_review'

### POST /api/admin/surveys/[id]/assign
- **Role**: Admin only
- **Body**: `{ "verification_officer_id": number }`
- **Action**: Assigns survey to verification officer

### POST /api/admin/surveys/[id]/mark-verified
- **Role**: Verification Officer only
- **Action**: Marks survey as verified (must be assigned to the officer)

### POST /api/admin/surveys/[id]/approve
- **Role**: Admin only
- **Body**: `{ "action": "approve" | "reject" }`
- **Action**: Approves or rejects a verified survey

## Dashboard Updates

### Unassigned Surveys Card
- Added "अनियुक्त सर्वेक्षण" (Unassigned Surveys) card to dashboard
- Shows count of surveys with `source = 'Divyang Self'` and `assigned_to IS NULL`

### Survey List Page
- Filter option to show unassigned surveys
- Display verification status and assignment information
- Action buttons based on user role

## Creating a Verification Officer User

After running the SQL to add the role, create a user in the database:

```sql
-- Example: Create a verification officer user
INSERT INTO users (name, contact_number, user_type, status, is_active, created_at, updated_at)
VALUES ('Verification Officer Name', '9876543210', 'verification_officer', 'active', 1, NOW(), NOW());
```

Or use the admin panel to create a user and set their role to "verification_officer".

## Status Flow

```
pending → under_review → verified → approved
   ↓           ↓            ↓
rejected   rejected    rejected
```

- **pending**: Survey captured, not yet reviewed
- **under_review**: Admin added corrections, assigned to verification officer
- **verified**: Verification officer completed corrections and marked as verified
- **approved**: Admin approved the verified survey
- **rejected**: Survey rejected at any stage

## Notes

- Unassigned surveys are those with `source = 'Divyang Self'` and `assigned_to IS NULL`
- Only admins can assign surveys to verification officers
- Verification officers can only mark surveys as verified if they are assigned to them
- Only admins can approve verified surveys
- All actions are logged in the database with timestamps and user IDs

