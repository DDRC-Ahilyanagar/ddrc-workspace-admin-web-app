import asyncio
import edge_tts
from pathlib import Path
import subprocess
import sys

async def regenerate_intro():
    voice = 'mr-IN-ManoharNeural'
    text_file = Path('demo-recording/01_intro.txt')
    temp_webm = Path('public/demo-recording/01_intro_temp.webm')
    output_file = Path('public/demo-recording/01_intro.mp3')
    
    # Read text
    text = text_file.read_text(encoding='utf-8')
    print(f'Reading text from {text_file} ({len(text)} chars)')
    
    # Generate audio as WebM first (edge_tts default format)
    print(f'Generating audio with voice {voice}...')
    communicate = edge_tts.Communicate(text, voice)
    await communicate.save(str(temp_webm))
    
    # Convert WebM to MP3 using ffmpeg if available, otherwise just rename
    if temp_webm.exists():
        try:
            # Try to convert using ffmpeg
            result = subprocess.run([
                'ffmpeg', '-i', str(temp_webm), 
                '-acodec', 'libmp3lame', 
                '-q:a', '2',
                '-y',  # Overwrite output file
                str(output_file)
            ], capture_output=True, text=True, timeout=30)
            
            if result.returncode == 0 and output_file.exists():
                temp_webm.unlink()  # Delete temp file
                size = output_file.stat().st_size
                print(f'OK Converted to MP3: {output_file} ({size:,} bytes)')
            else:
                # ffmpeg failed, just rename webm to mp3 (browsers can play webm)
                print('Warning: ffmpeg not available, using WebM format (renamed to .mp3)')
                if output_file.exists():
                    output_file.unlink()
                temp_webm.rename(output_file)
                size = output_file.stat().st_size
                print(f'OK Saved as WebM (renamed): {output_file} ({size:,} bytes)')
        except (FileNotFoundError, subprocess.TimeoutExpired):
            # ffmpeg not available, just rename
            print('Warning: ffmpeg not available, using WebM format (renamed to .mp3)')
            if output_file.exists():
                output_file.unlink()
            temp_webm.rename(output_file)
            size = output_file.stat().st_size
            print(f'OK Saved as WebM (renamed): {output_file} ({size:,} bytes)')
    else:
        print(f'ERROR Failed to generate audio file')

asyncio.run(regenerate_intro())

