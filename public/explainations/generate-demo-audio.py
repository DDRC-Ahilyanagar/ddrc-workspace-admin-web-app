import asyncio
import edge_tts
from pathlib import Path
import shutil

async def get_marathi_voice():
    voices = await edge_tts.list_voices()
    marathi_voices = [v for v in voices if v.get('Locale', '').lower() == 'mr-in']
    if marathi_voices:
        male_voice = [v for v in marathi_voices if v.get('Gender', '').lower() == 'male']
        if male_voice:
            return male_voice[0]['ShortName']
        return marathi_voices[0]['ShortName']
    return "mr-IN-ManoharNeural"

async def generate_audio_file(text, output_path, voice, retries=3):
    if voice is None:
        voice = await get_marathi_voice()
    
    text = text.strip()
    if not text:
        return False, "Empty text"
    
    for attempt in range(retries):
        try:
            communicate = edge_tts.Communicate(text, voice)
            await communicate.save(str(output_path))
            await asyncio.sleep(0.5)
            
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
                await asyncio.sleep(2 ** attempt)
                continue
            
            return False, f"Error: {error_msg}"
    
    return False, "Failed after retries"

async def process_file(txt_file, output_file, voice):
    try:
        with open(txt_file, 'r', encoding='utf-8') as f:
            text_content = f.read().strip()
        
        if not text_content:
            return False, "No text found"
        
        if output_file.exists() and output_file.stat().st_size > 1000:
            return True, f"Already exists ({output_file.stat().st_size:,} bytes)"
        
        if output_file.exists() and output_file.stat().st_size == 0:
            output_file.unlink()
        
        success, message = await generate_audio_file(text_content, output_file, voice)
        return success, message
        
    except Exception as e:
        return False, f"Error: {str(e)}"

async def main():
    demo_dir = Path('demo-recording')
    demo_dir.mkdir(exist_ok=True)
    
    txt_files = sorted(list(demo_dir.glob('*.txt')))
    
    if not txt_files:
        print("No text files found in demo-recording/")
        return
    
    print(f"Found {len(txt_files)} text files")
    print("Getting Marathi voice...")
    
    voice = await get_marathi_voice()
    print(f"Using voice: {voice}")
    print("=" * 60)
    print()
    
    for txt_file in txt_files:
        # Output to same folder as txt file (demo-recording/)
        output_file = txt_file.with_suffix('.mp3')
        success, message = await process_file(txt_file, output_file, voice)
        
        # Also copy to public/demo-recording/ for web server to serve
        if success and output_file.exists():
            public_demo_dir = Path('public/demo-recording')
            public_demo_dir.mkdir(parents=True, exist_ok=True)
            public_output = public_demo_dir / output_file.name
            import shutil
            shutil.copy2(output_file, public_output)
            print(f"  [COPIED] {output_file.name} -> public/demo-recording/")
        
        if success:
            file_size = output_file.stat().st_size if output_file.exists() else 0
            print(f"  [OK] {txt_file.name}: {message}")
        else:
            print(f"  [FAILED] {txt_file.name}: {message}")
    
    print()
    print("=" * 60)
    print("COMPLETED!")
    print("=" * 60)

if __name__ == '__main__':
    asyncio.run(main())

