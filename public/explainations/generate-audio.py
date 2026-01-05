#!/usr/bin/env python3
"""
Generate TTS audio files from Marathi markdown files using Microsoft Edge TTS.
This is a free, reliable alternative to Google TTS with better rate limits.
"""

import asyncio
import re
import sys
from pathlib import Path
import shutil

try:
    import edge_tts
except ImportError:
    print("ERROR: edge-tts not installed. Run: pip install edge-tts")
    sys.exit(1)

def clean_markdown_text(text):
    """Remove markdown formatting and convert to TTS-friendly text."""
    # Remove markdown headers
    text = re.sub(r'^#+\s+', '', text, flags=re.MULTILINE)
    
    # Remove bold/italic markers
    text = re.sub(r'\*\*([^\*]+)\*\*', r'\1', text)
    text = re.sub(r'\*([^\*]+)\*', r'\1', text)
    
    # Convert numbered lists to natural speech
    text = re.sub(r'^1\.\s+', 'प्रथम, ', text, flags=re.MULTILINE)
    text = re.sub(r'^2\.\s+', 'दुसरे, ', text, flags=re.MULTILINE)
    text = re.sub(r'^3\.\s+', 'तिसरे, ', text, flags=re.MULTILINE)
    text = re.sub(r'^4\.\s+', 'चौथे, ', text, flags=re.MULTILINE)
    text = re.sub(r'^5\.\s+', 'पाचवे, ', text, flags=re.MULTILINE)
    text = re.sub(r'^6\.\s+', 'सहावे, ', text, flags=re.MULTILINE)
    text = re.sub(r'^7\.\s+', 'सातवे, ', text, flags=re.MULTILINE)
    text = re.sub(r'^8\.\s+', 'आठवे, ', text, flags=re.MULTILINE)
    text = re.sub(r'^9\.\s+', 'नववे, ', text, flags=re.MULTILINE)
    text = re.sub(r'^10\.\s+', 'दहावे, ', text, flags=re.MULTILINE)
    
    # Clean up whitespace
    text = re.sub(r'\n{3,}', '\n\n', text)
    text = re.sub(r' +', ' ', text)
    return text.strip()

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

async def generate_single_file(txt_file, output_file, public_file, voice=None):
    """Generate audio for a single text file."""
    try:
        # Read text file (already TTS-friendly, no cleaning needed)
        with open(txt_file, 'r', encoding='utf-8') as f:
            text_content = f.read().strip()
        
        if not text_content:
            return False, "No text found"
        
        # Delete 0-byte files if they exist
        if output_file.exists() and output_file.stat().st_size == 0:
            output_file.unlink()
        
        # Generate audio (txt files are already TTS-friendly)
        success, message = await generate_audio_file(text_content, output_file, voice)
        
        if success:
            # Copy to public folder
            public_file.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(output_file, public_file)
        
        return success, message
        
    except Exception as e:
        return False, f"Error: {str(e)}"

async def generate_all_files(explanations_dir='explanations', format='mp3', max_concurrent=5):
    """Generate audio files for all text files."""
    explanations_path = Path(explanations_dir)
    public_dir = Path('public/explanations')
    public_dir.mkdir(parents=True, exist_ok=True)
    
    # Get all text files (TTS-friendly format)
    txt_files = sorted(list(explanations_path.glob('*.txt')))
    
    if not txt_files:
        print("No text files found in explanations/")
        return
    
    print(f"Found {len(txt_files)} text files")
    print("Getting Marathi voice...")
    
    # Get voice once
    voice = await get_marathi_voice()
    print(f"Using voice: {voice}")
    print("=" * 60)
    print()
    
    # Filter files that need generation
    files_to_process = []
    success_count = 0
    
    for txt_file in txt_files:
        output_file = txt_file.parent / f"{txt_file.stem}.{format}"
        public_file = public_dir / output_file.name
        
        # Skip if file already exists and is valid
        if output_file.exists() and output_file.stat().st_size > 1000:
            print(f"  [SKIP] {txt_file.name}: Already exists ({output_file.stat().st_size:,} bytes)")
            success_count += 1
            if not public_file.exists() or public_file.stat().st_size == 0:
                shutil.copy2(output_file, public_file)
            continue
        
        files_to_process.append((txt_file, output_file, public_file))
    
    if not files_to_process:
        print("All files already generated!")
        return
    
    print(f"Processing {len(files_to_process)} files...")
    print()
    
    # Process files with concurrency control and delay
    semaphore = asyncio.Semaphore(max_concurrent)
    
    async def process_with_semaphore(txt_file, output_file, public_file, delay=0):
        if delay > 0:
            await asyncio.sleep(delay)
        
        async with semaphore:
            success, message = await generate_single_file(txt_file, output_file, public_file, voice)
            if success:
                file_size = output_file.stat().st_size
                print(f"  [OK] {txt_file.name}: {file_size:,} bytes")
                return True
            else:
                print(f"  [FAILED] {txt_file.name}: {message}")
                return False
    
    # Create tasks with staggered delays to avoid overwhelming the API
    tasks = []
    for i, (txt_file, output_file, public_file) in enumerate(files_to_process):
        delay = (i % max_concurrent) * 0.5  # Stagger requests
        tasks.append(process_with_semaphore(txt_file, output_file, public_file, delay))
    
    # Execute all tasks
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    # Count successes
    for result in results:
        if result is True:
            success_count += 1
    
    # Print summary
    print()
    print("=" * 60)
    print(f"COMPLETED!")
    print(f"Successfully generated: {success_count}/{len(txt_files)} files")
    print(f"Failed: {len(files_to_process) - sum(1 for r in results if r is True)} files")
    print("=" * 60)

def main():
    import argparse
    
    parser = argparse.ArgumentParser(
        description='Generate TTS audio files from Marathi markdown files using Edge TTS',
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    
    parser.add_argument('--dir', default='explanations',
                       help='Directory containing text files (default: explanations)')
    parser.add_argument('-f', '--format', choices=['mp3', 'webm'], default='mp3',
                       help='Output audio format (default: mp3)')
    parser.add_argument('--concurrent', type=int, default=5,
                       help='Number of concurrent generations (default: 5)')
    
    args = parser.parse_args()
    
    try:
        asyncio.run(generate_all_files(args.dir, args.format, args.concurrent))
    except KeyboardInterrupt:
        print("\n\nInterrupted by user. Partial progress saved.")
        sys.exit(1)

if __name__ == '__main__':
    main()

