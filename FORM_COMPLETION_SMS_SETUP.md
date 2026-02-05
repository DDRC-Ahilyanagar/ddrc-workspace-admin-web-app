# Form Completion SMS Setup

## Overview
When a divyang (person with disability) submits a form, an SMS is automatically sent to their mobile number:
- **Public Form** (`/public`): Partial submission - informs that form is submitted and field officer will contact
- **Field Officer Form**: Full completion - informs that form is fully completed and field officer will contact

## Implementation Details

### How It Works
1. After successful form submission:
   - **Public Form**: From `/public` route (source: "Divyang Self", user_id: 1)
   - **Field Officer Form**: From field officer app (authenticated field officer submission)
2. The system extracts the divyang's phone number from the survey answers
3. An appropriate SMS is sent asynchronously (doesn't block the response):
   - Public form: "सादर करण्यात आला" (has been submitted)
   - Field officer form: "पूर्णपणे पूर्ण झाला" (fully completed)
4. SMS sending is logged for monitoring

### Phone Number Extraction
The system looks for:
- Question ID 100 (typically "मोबाईल नं" - Mobile Number)
- Any 10-digit number starting with 6-9 (valid Indian mobile format)
- Excludes parent's mobile number (Question ID 157)

### SMS Message Configuration

The SMS messages can be configured via environment variables:

#### Public Form Message (Partial Submission)
```bash
SMS_FORM_COMPLETION_TEMPLATE="Your custom message for public forms"
```

**Default Message (Marathi) - Public Form:**
```
आपला सर्वेक्षण फॉर्म पूर्णपणे नोंदवण्यात आला आहे. पुढील प्रक्रिया संबंधित विभागा मार्फत लवकरच राबवली जाईल. काही शंका असल्यास कृपया संपर्क करा: 0241 277 7772. धन्यवाद.– VIKHE PATIL FOUNDATION
```

**English Translation:**
```
Your form has been successfully submitted. Our survey officers will contact you soon for further process. For any queries, please contact: 0241 277 7772. Thank you. - VIKHE PATIL FOUNDATION
```

#### Field Officer Form Message (Fully Completed)
```bash
SMS_FIELD_OFFICER_COMPLETION_TEMPLATE="Your custom message for fully completed forms"
```

**Default Message (Marathi) - Field Officer Form:**
```
आपला सर्वेक्षण फॉर्म पूर्णपणे नोंदवण्यात आला आहे. पुढील प्रक्रिया संबंधित विभागा मार्फत लवकरच राबवली जाईल. काही शंका असल्यास कृपया संपर्क करा: 0241 277 7772. धन्यवाद.– VIKHE PATIL FOUNDATION
```

**English Translation:**
```
Your form has been fully completed. Our survey officers will contact you soon for further process. For any queries, please contact: 0241 277 7772. Thank you. - VIKHE PATIL FOUNDATION
```

### Environment Variables

Add to your `.env` file:

```bash
# SMS Form Completion Message for Public Forms (optional - uses default if not set)
SMS_FORM_COMPLETION_TEMPLATE="आपला सर्वेक्षण फॉर्म पूर्णपणे नोंदवण्यात आला आहे. पुढील प्रक्रिया संबंधित विभागा मार्फत लवकरच राबवली जाईल. काही शंका असल्यास कृपया संपर्क करा: 0241 277 7772. धन्यवाद.– VIKHE PATIL FOUNDATION"

# SMS Form Completion Message for Field Officer Forms (optional - uses default if not set)
SMS_FIELD_OFFICER_COMPLETION_TEMPLATE="आपला सर्वेक्षण फॉर्म पूर्णपणे नोंदवण्यात आला आहे. पुढील प्रक्रिया संबंधित विभागा मार्फत लवकरच राबवली जाईल. काही शंका असल्यास कृपया संपर्क करा: 0241 277 7772. धन्यवाद.– VIKHE PATIL FOUNDATION"
```

### DLT Template Registration

**Important:** If you're using a custom message, you need to:
1. Register the message template with DLT (Distributed Ledger Technology) provider
2. Get template approval from TRAI
3. Update the template in your SMS provider dashboard

For now, the default message is a placeholder that can be updated once you have the final content.

### Logging

SMS sending is logged with the following events:
- `FORM_COMPLETION_SMS_SENT` - SMS sent successfully
- `FORM_COMPLETION_SMS_FAILED` - SMS sending failed (with error details)
- `FORM_COMPLETION_SMS_ERROR` - Exception during SMS sending
- `FORM_COMPLETION_SMS_SKIPPED_NO_DATA` - No phone number found in survey data

Check logs to monitor SMS delivery status.

### Testing

To test the SMS functionality:
1. Submit a form from `/public` with a valid mobile number (10 digits starting with 6-9)
2. Check the application logs for SMS sending status
3. Verify the SMS is received on the divyang's phone

### Notes

- SMS is sent asynchronously (fire-and-forget) to avoid delaying the form submission response
- If SMS fails, the form submission still succeeds (non-blocking)
- Phone number is extracted from the survey answers automatically
- **Public Form SMS**: Sent for public submissions (source: "Divyang Self", user_id: 1)
- **Field Officer SMS**: Sent for authenticated field officer submissions (fully completed forms)
- Different messages are used to distinguish between partial (public) and complete (field officer) submissions
