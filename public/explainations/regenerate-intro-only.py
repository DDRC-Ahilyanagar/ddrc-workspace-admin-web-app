#!/usr/bin/env python3
"""Regenerate only intro.mp3 from intro.txt"""

import asyncio
import sys
from pathlib import Path
import io

# Fix Windows console encoding for Unicode
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

try:
    import edge_tts
except ImportError:
    print("ERROR: edge-tts not installed. Run: pip install edge-tts")
    sys.exit(1)

async def regenerate_intro():
    """Regenerate intro.mp3 from intro.txt"""
    txt_file = Path('intro.txt')
    mp3_file = Path('intro.mp3')
    
    if not txt_file.exists():
        print(f"ERROR: {txt_file} not found!")
        sys.exit(1)
    
    # Read text
    with open(txt_file, 'r', encoding='utf-8') as f:
        text = f.read().strip()
    
    if not text:
        print("ERROR: intro.txt is empty!")
        sys.exit(1)
    
    print(f"Text to generate: {text[:50]}...")
    print("Getting Marathi voice...")
    
    # Get Marathi voice
    voices = await edge_tts.list_voices()
    marathi_voices = [v for v in voices if v.get('Locale', '').lower() == 'mr-in']
    
    if marathi_voices:
        male_voice = [v for v in marathi_voices if v.get('Gender', '').lower() == 'male']
        voice = male_voice[0]['ShortName'] if male_voice else marathi_voices[0]['ShortName']
    else:
        voice = "hi-IN-MadhurNeural"  # Fallback
    
    print(f"Using voice: {voice}")
    print("Generating audio...")
    
    # Delete old file if exists
    if mp3_file.exists():
        mp3_file.unlink()
        print("Deleted old intro.mp3")
    
    # Generate audio
    communicate = edge_tts.Communicate(text, voice)
    await communicate.save(str(mp3_file))
    
    # Verify file
    if mp3_file.exists():
        file_size = mp3_file.stat().st_size
        print(f"✓ Successfully generated intro.mp3: {file_size:,} bytes")
    else:
        print("✗ Failed to generate intro.mp3")
        sys.exit(1)

if __name__ == '__main__':
    try:
        asyncio.run(regenerate_intro())
    except KeyboardInterrupt:
        print("\n\nInterrupted by user.")
        sys.exit(1)
