# Monitor Logs on Server

## Real-Time Log Monitoring

### Monitor All Logs (Real-Time)
```bash
tail -f /var/www/surveys.ddrcnagar.in/storage/logs/ddrc_api.log
```

### Monitor Last 100 Lines + Real-Time
```bash
tail -n 100 -f /var/www/surveys.ddrcnagar.in/storage/logs/ddrc_api.log
```

### Monitor with Color (if available)
```bash
tail -f /var/www/surveys.ddrcnagar.in/storage/logs/ddrc_api.log | grep --color=always -E "ERROR|WARN|INFO|$"
```

### Monitor Only Errors
```bash
tail -f /var/www/surveys.ddrcnagar.in/storage/logs/ddrc_api.log | grep -i "ERROR"
```

### Monitor Only OTP-Related Logs
```bash
tail -f /var/www/surveys.ddrcnagar.in/storage/logs/ddrc_api.log | grep -i "otp"
```

### Monitor Errors and Warnings
```bash
tail -f /var/www/surveys.ddrcnagar.in/storage/logs/ddrc_api.log | grep -E "ERROR|WARN"
```

### Monitor with Timestamps (Last 50 lines + follow)
```bash
tail -n 50 -f /var/www/surveys.ddrcnagar.in/storage/logs/ddrc_api.log
```

### Monitor Multiple Log Files
```bash
tail -f /var/www/surveys.ddrcnagar.in/storage/logs/*.log
```

### Monitor with Line Numbers
```bash
tail -f /var/www/surveys.ddrcnagar.in/storage/logs/ddrc_api.log | nl
```

### Monitor and Save to File
```bash
tail -f /var/www/surveys.ddrcnagar.in/storage/logs/ddrc_api.log | tee monitor.log
```

---

## Quick Commands (Copy-Paste Ready)

### Basic Real-Time Monitoring
```bash
ssh root@194.164.149.38 'tail -f /var/www/surveys.ddrcnagar.in/storage/logs/ddrc_api.log'
```

### Monitor Errors Only
```bash
ssh root@194.164.149.38 'tail -f /var/www/surveys.ddrcnagar.in/storage/logs/ddrc_api.log | grep -i ERROR'
```

### Monitor OTP Errors
```bash
ssh root@194.164.149.38 'tail -f /var/www/surveys.ddrcnagar.in/storage/logs/ddrc_api.log | grep -i "otp.*error\|error.*otp"'
```

### Monitor Last 100 Lines + Follow
```bash
ssh root@194.164.149.38 'tail -n 100 -f /var/www/surveys.ddrcnagar.in/storage/logs/ddrc_api.log'
```

---

## PM2 Logs (Application Logs)

### Monitor PM2 Application Logs
```bash
ssh root@194.164.149.38 'pm2 logs surveys-ddrc'
```

### Monitor PM2 Logs (Last 100 lines)
```bash
ssh root@194.164.149.38 'pm2 logs surveys-ddrc --lines 100'
```

### Monitor PM2 Logs (Errors Only)
```bash
ssh root@194.164.149.38 'pm2 logs surveys-ddrc --err'
```

### Monitor PM2 Logs (Output Only)
```bash
ssh root@194.164.149.38 'pm2 logs surveys-ddrc --out'
```

---

## Useful Tips

1. **Press `Ctrl+C`** to stop monitoring
2. **Press `Ctrl+Z`** to pause (then `fg` to resume)
3. Use `less +F` for scrollable monitoring:
   ```bash
   less +F /var/www/surveys.ddrcnagar.in/storage/logs/ddrc_api.log
   ```
   Press `Ctrl+C` to stop, then `F` to resume following

4. **Filter while monitoring:**
   ```bash
   tail -f /var/www/surveys.ddrcnagar.in/storage/logs/ddrc_api.log | grep --line-buffered "ERROR"
   ```

5. **Monitor and highlight:**
   ```bash
   tail -f /var/www/surveys.ddrcnagar.in/storage/logs/ddrc_api.log | grep --color=always -E "ERROR|WARN|CRASH"
   ```

---

## Most Useful Command (Recommended)

For general monitoring with last 50 lines:
```bash
ssh root@194.164.149.38 'tail -n 50 -f /var/www/surveys.ddrcnagar.in/storage/logs/ddrc_api.log'
```

For error monitoring:
```bash
ssh root@194.164.149.38 'tail -f /var/www/surveys.ddrcnagar.in/storage/logs/ddrc_api.log | grep -E "ERROR|WARN"'
```
