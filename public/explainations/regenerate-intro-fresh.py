#!/usr/bin/env python3
"""Regenerate intro audio with explicit MP3 encoding"""
import asyncio
import edge_tts
from pathlib import Path
import shutil

async def regenerate():
    txt_file = Path('demo-recording/01_intro.txt')
    output_file = Path('demo-recording/01_intro.mp3')
    public_file = Path('public/demo-recording/01_intro.mp3')
    
    # Delete old files completely
    for f in [output_file, public_file]:
        if f.exists():
            f.unlink()
    
    # Read text
    text = txt_file.read_text(encoding='utf-8').strip()
    print(f'Text: {len(text)} chars')
    
    # Generate with explicit format
    print('Generating...')
    communicate = edge_tts.Communicate(text, 'mr-IN-ManoharNeural')
    
    # Save to temp first
    temp_file = Path('demo-recording/01_intro_temp')
    if temp_file.exists():
        temp_file.unlink()
    
    await communicate.save(str(temp_file))
    await asyncio.sleep(1)  # Wait for file to be fully written
    
    # Verify the file
    if not temp_file.exists():
        print('ERROR: File not created')
        return
    
    size = temp_file.stat().st_size
    print(f'Generated: {size} bytes')
    
    # Read and verify header
    with open(temp_file, 'rb') as f:
        header = f.read(10)
        print(f'Header: {" ".join(f"{b:02x}" for b in header)}')
        
        # Verify it's MP3
        if header[0] != 0xFF or (header[1] & 0xE0) != 0xE0:
            print('ERROR: Not a valid MP3 file!')
            temp_file.unlink()
            return
    
    # Move to final location
    temp_file.rename(output_file)
    print(f'Saved: {output_file}')
    
    # Copy to public
    public_file.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(output_file, public_file)
    print(f'Copied: {public_file}')
    
    # Final verification
    if output_file.exists() and public_file.exists():
        s1 = output_file.stat().st_size
        s2 = public_file.stat().st_size
        print(f'Verification: {s1} == {s2}: {s1 == s2}')
        print('SUCCESS!')

if __name__ == '__main__':
    asyncio.run(regenerate())

