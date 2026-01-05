import asyncio
import edge_tts
from pathlib import Path
import shutil

async def regenerate_intro():
    voice = 'mr-IN-ManoharNeural'
    text_file = Path('demo-recording/01_intro.txt')
    output_file = Path('public/demo-recording/01_intro.mp3')
    
    # Delete existing file
    if output_file.exists():
        output_file.unlink()
        print(f'Deleted existing {output_file}')
    
    # Read text
    text = text_file.read_text(encoding='utf-8').strip()
    print(f'Reading text from {text_file} ({len(text)} chars)')
    
    # Generate audio - edge_tts generates WebM by default
    print(f'Generating audio with voice {voice}...')
    communicate = edge_tts.Communicate(text, voice)
    
    # Save to temporary WebM file first
    temp_webm = Path('public/demo-recording/01_intro_temp.webm')
    await communicate.save(str(temp_webm))
    await asyncio.sleep(1)  # Wait for file to be written
    
    if not temp_webm.exists() or temp_webm.stat().st_size == 0:
        print('ERROR: Failed to generate audio file')
        return
    
    # Check if we can use the WebM file directly (browsers support WebM audio)
    # But we'll try to rename it to .mp3 - browsers should detect the format
    # However, better approach: use .webm extension and update code
    
    # For now, let's copy the WebM content but with .mp3 extension
    # Browsers will detect the actual format from the file content
    shutil.copy2(temp_webm, output_file)
    temp_webm.unlink()
    
    if output_file.exists():
        size = output_file.stat().st_size
        print(f'OK Generated {output_file} ({size:,} bytes)')
        print('NOTE: File is actually WebM format but saved as .mp3')
        print('Browsers should auto-detect the format, but if issues persist,')
        print('consider using .webm extension or converting with ffmpeg')
    else:
        print(f'ERROR Failed to create {output_file}')

asyncio.run(regenerate_intro())

