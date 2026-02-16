# Local Development Setup Guide

This guide will help you run the DDRC Admin Web App locally and make it accessible from mobile devices on your network.

## Prerequisites

1. **Node.js** (v18 or higher)
2. **MySQL** database server running locally
3. **Database** `ddrc_surveys` created and populated
4. **Network access** - Your laptop and mobile device should be on the same network (WiFi)

## Step 1: Install Dependencies

```bash
cd /home/utkrranti/Project/ddrc-workspace-admin-web-app
npm install
```

## Step 2: Configure Environment Variables

1. Copy the example environment file:
```bash
cp .env.example .env.local
```

2. Edit `.env.local` and update the database credentials:
```env
DB_HOST=127.0.0.1
DB_USER=root
DB_PASS=your_mysql_password
DB_NAME=ddrc_surveys
```

3. Update other configuration as needed (SMS, processing keys, etc.)

## Step 3: Find Your Laptop's IP Address

### On Linux:
```bash
# Method 1: Using ip command
ip addr show | grep "inet " | grep -v 127.0.0.1

# Method 2: Using hostname
hostname -I

# Method 3: Using ifconfig
ifconfig | grep "inet " | grep -v 127.0.0.1
```

### On macOS:
```bash
ifconfig | grep "inet " | grep -v 127.0.0.1
```

### On Windows:
```cmd
ipconfig
```
Look for "IPv4 Address" under your active network adapter (usually WiFi or Ethernet).

**Example IP:** `192.168.1.100` or `10.0.0.5`

## Step 4: Start the Development Server with Network Access

### Option 1: Using the network script (Recommended)
```bash
npm run dev:network
```

### Option 2: Using environment variable
```bash
HOSTNAME=0.0.0.0 npm run dev
```

### Option 3: Direct command
```bash
next dev -H 0.0.0.0
```

The server will start and you'll see:
```
  ▲ Next.js 14.2.33
  - Local:        http://localhost:3000
  - Network:      http://192.168.1.100:3000
```

**Note the Network URL** - this is what you'll use from your mobile device.

## Step 5: Configure Firewall (if needed)

### On Linux (UFW):
```bash
sudo ufw allow 3000/tcp
```

### On Linux (firewalld):
```bash
sudo firewall-cmd --permanent --add-port=3000/tcp
sudo firewall-cmd --reload
```

### On macOS:
1. System Preferences → Security & Privacy → Firewall
2. Click "Firewall Options"
3. Add Node.js or allow incoming connections on port 3000

### On Windows:
1. Windows Defender Firewall → Advanced Settings
2. Inbound Rules → New Rule
3. Port → TCP → 3000 → Allow connection

## Step 6: Access from Mobile Device

1. **Ensure mobile device is on the same WiFi network** as your laptop

2. **Open browser or mobile app** and use:
   - **Web Browser:** `http://YOUR_LAPTOP_IP:3000`
   - **API Endpoint:** `http://YOUR_LAPTOP_IP:3000/api/...`
   
   Example: `http://192.168.1.100:3000`

3. **For Mobile Apps:**
   - Update the API base URL in your mobile app configuration
   - Change from `https://surveys.bitnix.store` to `http://YOUR_LAPTOP_IP:3000`
   - Example: `http://192.168.1.100:3000`

## Step 7: Test API Endpoints

Test from mobile device or another computer:

```bash
# Health check
curl http://YOUR_LAPTOP_IP:3000/api/health

# Get questions
curl http://YOUR_LAPTOP_IP:3000/api/get-questions
```

## Troubleshooting

### Issue: Cannot connect from mobile device

1. **Check IP address:** Make sure you're using the correct IP (not localhost)
2. **Check firewall:** Ensure port 3000 is open
3. **Check network:** Ensure both devices are on the same WiFi network
4. **Check server:** Verify server is running with `-H 0.0.0.0` flag

### Issue: Database connection errors

1. **Check MySQL is running:**
   ```bash
   sudo systemctl status mysql
   # or
   sudo service mysql status
   ```

2. **Check database exists:**
   ```bash
   mysql -u root -p -e "SHOW DATABASES;"
   ```

3. **Verify credentials in `.env.local`**

### Issue: Port already in use

If port 3000 is already in use:
```bash
# Find process using port 3000
lsof -i :3000
# or
netstat -tulpn | grep 3000

# Kill the process or use a different port
PORT=3001 npm run dev:network
```

### Issue: CORS errors

If you encounter CORS errors, the API routes should handle this automatically. If not, check the middleware configuration.

## Production Build with Network Access

For production builds accessible on network:

```bash
# Build
npm run build

# Start with network access
npm run start:network
# or
next start -H 0.0.0.0
```

## Security Notes

⚠️ **Important:** Running with `-H 0.0.0.0` makes your server accessible to anyone on your local network. Only use this for development.

For production:
- Use proper authentication
- Use HTTPS
- Configure proper firewall rules
- Use environment-specific configurations

## Quick Reference

```bash
# Start dev server (localhost only)
npm run dev

# Start dev server (network accessible)
npm run dev:network

# Build for production
npm run build

# Start production server (network accessible)
npm run start:network

# Check your IP address
hostname -I  # Linux
ifconfig     # macOS/Linux
ipconfig     # Windows
```

## Mobile App Configuration

Update your mobile app's API base URL to point to your laptop:

**Before:**
```
https://surveys.bitnix.store
```

**After (for local development):**
```
http://192.168.1.100:3000
```

Replace `192.168.1.100` with your actual laptop IP address.

