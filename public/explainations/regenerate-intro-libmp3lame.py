#!/usr/bin/env python3
"""Regenerate 01-intro.mp3 using libmp3lame codec for Chromium compatibility"""
import asyncio
import edge_tts
from pathlib import Path
import subprocess
import sys

async def regenerate_intro():
    voice = 'mr-IN-ManoharNeural'
    text_file = Path('demo-recording/01_intro.txt')
    temp_webm = Path('demo-recording/01_intro_temp.webm')
    output_file = Path('demo-recording/01-intro.mp3')
    
    # Delete existing intro file
    if output_file.exists():
        output_file.unlink()
        print(f'Deleted existing {output_file}')
    
    # Delete backup if exists
    backup_file = Path('demo-recording/01-intro.mp3.backup')
    if backup_file.exists():
        backup_file.unlink()
        print(f'Deleted backup {backup_file}')
    
    # Read text
    if not text_file.exists():
        print(f'ERROR: {text_file} not found')
        sys.exit(1)
    
    text = text_file.read_text(encoding='utf-8').strip()
    print(f'Reading text from {text_file} ({len(text)} chars)')
    
    # Generate audio as WebM first (edge_tts default format)
    print(f'Generating audio with voice {voice}...')
    communicate = edge_tts.Communicate(text, voice)
    await communicate.save(str(temp_webm))
    await asyncio.sleep(0.5)  # Wait for file to be written
    
    if not temp_webm.exists() or temp_webm.stat().st_size == 0:
        print('ERROR: Failed to generate audio file')
        sys.exit(1)
    
    print(f'Generated WebM: {temp_webm} ({temp_webm.stat().st_size:,} bytes)')
    
    # Convert WebM to MP3 using ffmpeg with libmp3lame
    print('Converting to MP3 using libmp3lame...')
    try:
        result = subprocess.run([
            'ffmpeg', '-y',  # Overwrite output
            '-i', str(temp_webm),
            '-map_metadata', '-1',  # Remove metadata
            '-vn',  # No video
            '-acodec', 'libmp3lame',  # Use libmp3lame codec
            '-ac', '2',  # Stereo
            '-ar', '44100',  # Sample rate 44.1kHz
            '-ab', '192k',  # Bitrate 192kbps
            '-f', 'mp3',
            str(output_file)
        ], capture_output=True, text=True, timeout=60)
        
        if result.returncode == 0 and output_file.exists():
            temp_webm.unlink()  # Delete temp file
            size = output_file.stat().st_size
            print(f'OK Successfully converted to MP3: {output_file} ({size:,} bytes)')
            
            # Also copy to public folder if it exists
            public_file = Path('public/demo-recording/01-intro.mp3')
            if public_file.parent.exists():
                public_file.parent.mkdir(parents=True, exist_ok=True)
                import shutil
                shutil.copy2(output_file, public_file)
                print(f'OK Copied to: {public_file}')
        else:
            print(f'ERROR: ffmpeg conversion failed!')
            print(f'Exit code: {result.returncode}')
            print(f'stderr: {result.stderr}')
            if temp_webm.exists():
                temp_webm.unlink()
            sys.exit(1)
            
    except FileNotFoundError:
        print('ERROR: ffmpeg is not installed or not in PATH')
        print('Please install ffmpeg to use libmp3lame conversion')
        if temp_webm.exists():
            temp_webm.unlink()
        sys.exit(1)
    except subprocess.TimeoutExpired:
        print('ERROR: ffmpeg conversion timed out')
        if temp_webm.exists():
            temp_webm.unlink()
        sys.exit(1)
    except Exception as e:
        print(f'ERROR during conversion: {e}')
        if temp_webm.exists():
            temp_webm.unlink()
        sys.exit(1)

if __name__ == '__main__':
    asyncio.run(regenerate_intro())

