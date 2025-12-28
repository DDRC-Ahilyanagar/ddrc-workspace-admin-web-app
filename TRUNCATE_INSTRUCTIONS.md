# Instructions to Truncate Survey Tables

## ⚠️ WARNING
**This will DELETE ALL survey data!** Make sure you have a backup before proceeding.

## Dashboard Counts
✅ **Good News**: After the recent fixes, the dashboard will now correctly show:
- **Completed surveys count** - filtered by logged-in field officer's `user_id`
- **Pending surveys count** - filtered by logged-in field officer's `user_id`
- **Recent surveys** - filtered by logged-in field officer's `user_id`

## Tables to Truncate

### ✅ Survey Data Tables (Truncate These)
1. **`surveys`** - Main survey data with answers
2. **`survey_files`** - Uploaded files (Aadhaar cards, certificates, etc.)
3. **`survey_aadhar`** - Aadhaar entries linked to surveys
4. **`otp_verifications`** - OTP logs (optional, can keep for audit)

### ❌ DO NOT Truncate (Master/Reference Data)
- **`tbl_all_grams`** - Gram panchayat lookup data
- **`tbl_all_phc`** - PHC lookup data  
- **`tbl_all_talathi`** - Talathi lookup data
- **`tbl_all_villages`** - Villages lookup data
- **`tbl_taluka`** - Taluka lookup data
- **`users`** - User accounts (field officers, admins, etc.)
- **`user_types`** - User role types
- **`questions`** - Survey questions
- **`sections`** - Survey sections

## How to Run

### Option 1: Using MySQL Command Line
```bash
mysql -u your_username -p your_database_name < truncate_survey_tables.sql
```

### Option 2: Using phpMyAdmin
1. Go to phpMyAdmin
2. Select your database
3. Click on "SQL" tab
4. Copy and paste the contents of `truncate_survey_tables.sql`
5. Click "Go"

### Option 3: Using MySQL Workbench
1. Open MySQL Workbench
2. Connect to your database
3. Open `truncate_survey_tables.sql`
4. Execute the script

## Verification

After truncation, run these queries to verify:

```sql
SELECT COUNT(*) as survey_count FROM surveys;
SELECT COUNT(*) as file_count FROM survey_files;
SELECT COUNT(*) as aadhaar_count FROM survey_aadhar;
```

All counts should be **0**.

## After Truncation

1. ✅ All survey data will be cleared
2. ✅ Dashboard will show 0 completed and 0 pending surveys
3. ✅ Field officers can start fresh with new surveys
4. ✅ All new surveys will be tracked with correct `user_id`
5. ✅ Dashboard counts will work correctly per field officer

## Backup Recommendation

Before truncating, create a backup:

```bash
mysqldump -u your_username -p your_database_name surveys survey_files survey_aadhar > survey_backup_$(date +%Y%m%d_%H%M%S).sql
```
