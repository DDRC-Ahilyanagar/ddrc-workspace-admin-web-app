# DDRC Daily Reports Service

Python microservice optimized for generating and sending daily email reports with 46+ file attachments. Designed to handle billions of records efficiently.

## Features

- **Chunked Processing**: Processes surveys in configurable chunks (default: 50,000) to handle billions of records without memory issues
- **Parallel Report Generation**: Uses multiprocessing to generate multiple reports simultaneously
- **Efficient Database Queries**: Uses streaming cursors and connection pooling
- **Memory Optimized**: Processes data in chunks rather than loading everything into memory
- **Scalable**: Can handle billions of records gracefully

## Setup

1. **Install dependencies:**
```bash
pip install -r requirements.txt
```

2. **Configure environment:**
```bash
cp .env.example .env
# Edit .env with your database and email credentials
```

3. **Run the service:**
```bash
python daily_reports_service.py
```

## Configuration

Key environment variables:

- `CHUNK_SIZE`: Number of records to process per chunk (default: 50000)
- `MAX_WORKERS`: Number of parallel workers for report generation (default: 4)
- `DB_POOL_SIZE`: Database connection pool size (default: 10)
- `BATCH_SIZE`: Batch size for processing (default: 10000)

## How It Works

1. **Chunked Data Fetching**: Fetches surveys from database in chunks using streaming cursor
2. **In-Memory Grouping**: Groups surveys by filter types (source, taluka, district, etc.) as chunks are processed
3. **Parallel Report Generation**: Generates PDF and Excel reports in parallel using ThreadPoolExecutor
4. **Email Sending**: Sends emails to admins with all report attachments, and to field officers with their stats

## Performance

- **Memory Efficient**: Only loads one chunk at a time into memory
- **Scalable**: Can handle billions of records by processing in chunks
- **Fast**: Parallel report generation significantly reduces total time
- **Reliable**: Connection pooling and error handling ensure stability

## Scheduling

This service can be scheduled to run daily using:
- Cron (Linux/Mac)
- Task Scheduler (Windows)
- Systemd service
- Or call from your Next.js scheduled job

Example cron job (runs daily at 8 PM):
```
0 20 * * * cd /path/to/python-reports-service && python daily_reports_service.py
```

## Integration with Next.js

You can call this Python service from your Next.js API:

```typescript
// In your scheduled job
const response = await fetch('http://localhost:8000/generate-reports', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.DAILY_STATS_API_TOKEN}`
  }
});
```

Or replace the existing `/api/admin/send-daily-stats` endpoint to call this Python service instead.

