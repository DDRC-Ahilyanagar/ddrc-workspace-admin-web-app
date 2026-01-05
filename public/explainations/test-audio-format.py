#!/usr/bin/env python3
"""Test what format edge_tts actually generates"""
import asyncio
import edge_tts
from pathlib import Path

async def test_format():
    text = "Test audio"
    output = Path('demo-recording/test_audio_temp')
    
    # Generate audio
    communicate = edge_tts.Communicate(text, 'mr-IN-ManoharNeural')
    await communicate.save(str(output))
    
    if output.exists():
        with open(output, 'rb') as f:
            header = f.read(12)
            print(f'Header bytes: {" ".join(f"{b:02x}" for b in header)}')
            
            # Check format
            if header[:4] == bytes([0xFF, 0xFB]) or header[:4] == bytes([0xFF, 0xF3]):
                print('Format: MP3')
            elif header[:4] == bytes([0x1a, 0x45, 0xdf, 0xa3]):
                print('Format: WebM/Matroska')
            elif header[:4] == b'RIFF':
                print('Format: WAV/RIFF')
            elif header[:4] == b'fLaC':
                print('Format: FLAC')
            else:
                print(f'Format: Unknown (starts with {header[:4]})')
            
            # Check file extension edge_tts used
            actual_files = list(Path('demo-recording').glob('test_audio_temp*'))
            if actual_files:
                print(f'Actual file created: {actual_files[0].name}')
        
        output.unlink()
    else:
        print('File not created')

if __name__ == '__main__':
    asyncio.run(test_format())

