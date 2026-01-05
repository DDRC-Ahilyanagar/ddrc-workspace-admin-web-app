# Fixing Audio Files for Chromium Compatibility

## 🔍 Problem

Chromium (Chrome/Edge) cannot decode your MP3 files, showing error:
```
error.code: 4
message: "PipelineStatus::DEMUXER_ERROR_COULD_NOT_OPEN: FFmpegDemuxer: open context failed"
```

This means the audio files are **not valid MP3 format** for Chromium, even if they play in other players.

## ✅ Solution

### Step 1: Install ffmpeg

**Windows (Chocolatey):**
```powershell
choco install ffmpeg
```

**Windows (Manual):**
1. Download from: https://ffmpeg.org/download.html
2. Extract and add to PATH

**Or use winget:**
```powershell
winget install ffmpeg
```

### Step 2: Check Audio Format

Check if your audio file is valid:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/check-audio-format.ps1 -AudioFile "demo-recording/01-intro.mp3"
```

This will tell you:
- If the file is actually MP3 or WebM/Opus renamed
- If the codec is compatible
- If there are format issues

### Step 3: Fix All Audio Files

Convert all audio files to Chromium-safe MP3:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/fix-audio-format.ps1
```

This script will:
1. ✅ Backup all original files
2. ✅ Convert to clean MP3 (libmp3lame, 44.1kHz, 192kbps, stereo)
3. ✅ Remove problematic metadata
4. ✅ Copy to public folder
5. ✅ Create backups in `demo-recording/backup_YYYYMMDD_HHMMSS/`

### Step 4: Verify

After conversion, test in Chrome DevTools:

```javascript
const a = new Audio('/demo-recording/01-intro.mp3')
a.play()
```

If this works → your demo will work!

## 📋 What the Fix Script Does

The `fix-audio-format.ps1` script converts files using:

```bash
ffmpeg -y -i input.mp3 \
  -map_metadata -1 \    # Remove metadata
  -vn \                 # No video
  -acodec libmp3lame \  # Force MP3 codec
  -ac 2 \              # Stereo
  -ar 44100 \          # 44.1kHz
  -ab 192k \           # 192kbps
  output.mp3
```

This produces **Chromium-safe MP3 files**.

## 🚫 What We Removed

All workarounds have been removed from `demo-runner.ts`:
- ❌ Blob URL loading
- ❌ WebM fallbacks
- ❌ Fetch workarounds
- ❌ Multiple Audio() instances

**Now it's simple:**
- One `HTMLAudioElement`
- One clean MP3 file
- User click → `.play()`

## ✅ After Fixing

Once audio files are converted:
1. Run `npm run demo`
2. Audio should play without errors
3. Demo will work correctly

---

**The code is now correct. Fix the audio files and everything will work.**

