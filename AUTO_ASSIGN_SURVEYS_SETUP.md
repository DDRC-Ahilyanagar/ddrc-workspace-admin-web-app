# Auto-Assign Surveys Based on GAV Matching

## Overview
This feature automatically assigns surveys submitted via the public URL to field officers based on GAV (Gram Panchayat/Village) matching. The system checks every 5 minutes for new unassigned surveys and matches them with online field officers who have the same GAV.

## How It Works

### 1. Survey Submission via Public URL
- When a survey is submitted via the public URL (`/public-survey-form`), it is stored with:
  - `user_id = 1` (system user)
  - `source = 'Divyang Self'`
  - GAV (village) information stored in `survey_json` as an answer to the village question

### 2. Field Officer GAV Storage
- Field officers select their territory (Taluka and Village/GAV) in the mobile app
- This GAV is stored in their survey submissions in `survey_json`
- The system extracts the GAV from the field officer's latest survey

### 3. Auto-Assignment Process
Every 5 minutes, a scheduled job:
1. Finds all unassigned surveys (`source = 'Divyang Self'` and `user_id = 1`)
2. Extracts GAV from each survey's `survey_json`
3. Gets all online field officers (those with location updates within last 5 minutes)
4. Extracts GAV from each online field officer's latest survey
5. Matches surveys to field officers with matching GAV
6. Assigns surveys by updating `user_id` to the matched field officer's ID

## API Endpoint

### POST `/api/admin/auto-assign-surveys`
Manually trigger the auto-assignment process (also called by scheduled job).

**Request:**
```bash
POST /api/admin/auto-assign-surveys
Authorization: Bearer <AUTO_ASSIGN_API_TOKEN>
```

**Response:**
```json
{
  "ok": true,
  "message": "Processed 5 surveys, assigned 3",
  "assigned": 3,
  "checked": 5,
  "details": [
    {
      "survey_id": 123,
      "officer_id": 15,
      "village": "Sample Village"
    }
  ]
}
```

## Configuration

### Environment Variables
Add to your `.env` file (optional):
```env
# Optional: API token for auto-assign endpoint security
AUTO_ASSIGN_API_TOKEN=your-secure-token-here

# Base URL for API calls (defaults to localhost:3000)
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000
```

### Scheduled Job
The job runs automatically every 5 minutes via `node-cron`. It's initialized in `instrumentation.ts` when the server starts.

## Matching Logic

### GAV Extraction
- The system finds the village question by searching for questions containing "गाव", "village", or "ग्राम"
- Extracts the answer from `survey_json.answers` array where `question_id` matches

### Matching Algorithm
Surveys are matched to field officers if:
- Exact match: Survey village === Officer village
- Contains match: Survey village contains Officer village OR Officer village contains Survey village

### Online Status
Field officers are considered "online" if:
- They have location tracking enabled
- Their last location update was within the last 5 minutes (as determined by `isOnline()` function)

## Database Schema

### Surveys Table
- `user_id`: Field officer ID (1 for unassigned, updated to officer ID when assigned)
- `source`: Survey source ('Divyang Self' for public submissions)
- `survey_json`: JSON containing all answers including village/GAV

### Questions Table
- Contains question with text like "गाव" or "village"
- Used to identify which question_id contains the GAV information

## Logging

All operations are logged with the following events:
- `AUTO_ASSIGN_SURVEYS_JOB_STARTED`: Job started
- `AUTO_ASSIGN_VILLAGE_QUESTION_FOUND`: Village question ID found
- `AUTO_ASSIGN_FOUND_UNASSIGNED`: Unassigned surveys found
- `AUTO_ASSIGN_ONLINE_OFFICERS`: Online officers identified
- `AUTO_ASSIGN_OFFICER_GAV`: Officer GAV extracted
- `AUTO_ASSIGN_SURVEY_ASSIGNED`: Survey successfully assigned
- `AUTO_ASSIGN_SURVEYS_JOB_SUCCESS`: Job completed successfully
- `AUTO_ASSIGN_SURVEYS_JOB_FAILED`: Job failed with error

## Testing

### Manual Test
You can manually trigger the assignment:
```bash
curl -X POST http://localhost:3000/api/admin/auto-assign-surveys \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-token>"
```

### Verify Assignment
Check the `surveys` table:
```sql
SELECT 
  s.id,
  s.user_id,
  s.source,
  u.name as officer_name,
  s.created_at
FROM surveys s
LEFT JOIN users u ON u.id = s.user_id
WHERE s.source = 'Divyang Self'
ORDER BY s.created_at DESC
LIMIT 10;
```

## Troubleshooting

### No Surveys Assigned
1. Check if there are unassigned surveys: `SELECT COUNT(*) FROM surveys WHERE user_id = 1 AND source = 'Divyang Self'`
2. Check if field officers are online (location tracking active)
3. Check if field officers have GAV in their surveys
4. Verify village question exists in questions table
5. Check logs for errors

### Surveys Not Matching
1. Verify GAV spelling matches exactly (case-insensitive)
2. Check if village names have extra spaces or special characters
3. Review logs for extraction errors

### Scheduled Job Not Running
1. Verify server is running (job initializes on server start)
2. Check `instrumentation.ts` is being called
3. Review server logs for initialization messages
4. Verify `node-cron` is installed

## Future Enhancements

Potential improvements:
1. Support for Taluka matching in addition to Village
2. Multiple villages per field officer
3. Admin dashboard to view assignment history
4. Notification to field officers when surveys are assigned
5. Retry mechanism for failed assignments
6. Assignment history/audit log

