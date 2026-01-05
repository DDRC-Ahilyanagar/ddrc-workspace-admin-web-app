#!/usr/bin/env python3
"""
Generate TTS audio files from TXT files using Microsoft Edge TTS.
Deletes all existing MP3 files and generates new ones in parallel (3 at a time).
"""

import asyncio
import sys
from pathlib import Path
import shutil
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

async def get_marathi_voice():
    """Get the best Marathi voice from Edge TTS."""
    voices = await edge_tts.list_voices()
    
    # Look for Marathi (mr-IN) voices - exact match
    marathi_voices = [v for v in voices if v.get('Locale', '').lower() == 'mr-in']
    
    if marathi_voices:
        # Prefer male voice if available
        male_voice = [v for v in marathi_voices if v.get('Gender', '').lower() == 'male']
        if male_voice:
            return male_voice[0]['ShortName']
        # Otherwise use first available
        return marathi_voices[0]['ShortName']
    
    # Fallback to Hindi if Marathi not available
    hindi_voices = [v for v in voices if v.get('Locale', '').lower() == 'hi-in']
    if hindi_voices:
        # Prefer male voice
        male_voice = [v for v in hindi_voices if v.get('Gender', '').lower() == 'male']
        if male_voice:
            return male_voice[0]['ShortName']
        return hindi_voices[0]['ShortName']
    
    # Default fallback - use a known working voice
    return "hi-IN-MadhurNeural"

async def generate_audio_file(text, output_path, voice=None, retries=3):
    """Generate audio file using Edge TTS with retry logic."""
    if voice is None:
        voice = await get_marathi_voice()
    
    # Clean text - remove any problematic characters
    text = text.strip()
    if not text:
        return False, "Empty text"
    
    for attempt in range(retries):
        try:
            # Generate audio
            communicate = edge_tts.Communicate(text, voice)
            await communicate.save(str(output_path))
            
            # Wait a moment for file to be written
            await asyncio.sleep(0.5)
            
            # Verify file was created and has content
            if not output_path.exists():
                if attempt < retries - 1:
                    await asyncio.sleep(1)
                    continue
                return False, "File was not created"
            
            file_size = output_path.stat().st_size
            if file_size == 0:
                if attempt < retries - 1:
                    output_path.unlink()
                    await asyncio.sleep(1)
                    continue
                output_path.unlink()
                return False, "Generated file is empty (0 bytes)"
            
            if file_size < 1000:
                if attempt < retries - 1:
                    output_path.unlink()
                    await asyncio.sleep(1)
                    continue
                output_path.unlink()
                return False, f"Generated file is too small ({file_size} bytes)"
            
            return True, f"Success - {file_size:,} bytes"
            
        except Exception as e:
            error_msg = str(e)
            if output_path.exists():
                try:
                    if output_path.stat().st_size == 0:
                        output_path.unlink()
                except:
                    pass
            
            if attempt < retries - 1:
                await asyncio.sleep(2 ** attempt)  # Exponential backoff
                continue
            
            return False, f"Error: {error_msg}"
    
    return False, "Failed after retries"

async def generate_single_file(txt_file, output_file, voice=None):
    """Generate audio for a single text file."""
    try:
        # Read text file
        with open(txt_file, 'r', encoding='utf-8') as f:
            text_content = f.read().strip()
        
        if not text_content:
            return False, "No text found"
        
        # Generate audio
        success, message = await generate_audio_file(text_content, output_file, voice)
        
        return success, message
        
    except Exception as e:
        return False, f"Error: {str(e)}"

def delete_all_mp3_files(directory):
    """Delete all MP3 files in the directory."""
    mp3_files = list(Path(directory).glob('*.mp3'))
    deleted_count = 0
    
    for mp3_file in mp3_files:
        try:
            mp3_file.unlink()
            deleted_count += 1
        except Exception as e:
            print(f"  [WARN] Could not delete {mp3_file.name}: {e}")
    
    return deleted_count

async def generate_all_files(explanations_dir='.', max_concurrent=3):
    """Generate audio files for all text files in parallel."""
    explanations_path = Path(explanations_dir)
    
    # Delete all existing MP3 files
    print("=" * 60)
    print("Deleting all existing MP3 files...")
    deleted = delete_all_mp3_files(explanations_path)
    print(f"Deleted {deleted} MP3 files")
    print("=" * 60)
    print()
    
    # Get all text files (excluding requirements-tts.txt)
    txt_files = sorted([
        f for f in explanations_path.glob('*.txt') 
        if f.name != 'requirements-tts.txt'
    ])
    
    if not txt_files:
        print("No text files found!")
        return
    
    print(f"Found {len(txt_files)} text files")
    print("Getting Marathi voice...")
    
    # Get voice once
    voice = await get_marathi_voice()
    print(f"Using voice: {voice}")
    print("=" * 60)
    print()
    
    # Process files with concurrency control (3 at a time)
    semaphore = asyncio.Semaphore(max_concurrent)
    
    async def process_with_semaphore(txt_file, output_file, index, total):
        async with semaphore:
            print(f"[{index}/{total}] Processing {txt_file.name}...")
            try:
                success, message = await generate_single_file(txt_file, output_file, voice)
                if success:
                    file_size = output_file.stat().st_size
                    print(f"[{index}/{total}] ✓ {txt_file.name}: {file_size:,} bytes")
                    return True
                else:
                    print(f"[{index}/{total}] ✗ {txt_file.name}: {message}")
                    return False
            except Exception as e:
                print(f"[{index}/{total}] ✗ {txt_file.name}: Exception - {str(e)}")
                import traceback
                traceback.print_exc()
                return False
    
    # Create tasks
    tasks = []
    for i, txt_file in enumerate(txt_files, 1):
        output_file = txt_file.parent / f"{txt_file.stem}.mp3"
        tasks.append(process_with_semaphore(txt_file, output_file, i, len(txt_files)))
    
    # Execute all tasks
    print(f"Generating {len(tasks)} audio files (3 at a time)...")
    print()
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    # Count successes
    success_count = sum(1 for r in results if r is True)
    failed_count = len(results) - success_count
    
    # Print summary
    print()
    print("=" * 60)
    print(f"COMPLETED!")
    print(f"Successfully generated: {success_count}/{len(txt_files)} files")
    if failed_count > 0:
        print(f"Failed: {failed_count} files")
    print("=" * 60)

def main():
    import argparse
    
    parser = argparse.ArgumentParser(
        description='Generate TTS audio files from TXT files using Edge TTS (parallel processing)',
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    
    parser.add_argument('--dir', default='.',
                       help='Directory containing text files (default: current directory)')
    parser.add_argument('--concurrent', type=int, default=3,
                       help='Number of concurrent generations (default: 3)')
    
    args = parser.parse_args()
    
    try:
        asyncio.run(generate_all_files(args.dir, args.concurrent))
    except KeyboardInterrupt:
        print("\n\nInterrupted by user. Partial progress saved.")
        sys.exit(1)

if __name__ == '__main__':
    main()

