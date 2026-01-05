#!/usr/bin/env python3
"""
Script to generate TTS-friendly .txt files from all .md files in explanations folder.
Converts markdown to plain text with natural speech formatting.
"""

import re
from pathlib import Path

def convert_md_to_txt(md_content):
    """Convert markdown content to TTS-friendly text format."""
    # Remove markdown headers
    text = re.sub(r'^#+\s+', '', md_content, flags=re.MULTILINE)
    
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
    
    # Process line by line to add proper spacing
    lines = text.split('\n')
    formatted_lines = []
    
    for i, line in enumerate(lines):
        line = line.strip()
        if not line:
            # Keep single blank lines
            if formatted_lines and formatted_lines[-1] != '':
                formatted_lines.append('')
            continue
        
        # Check if line starts with numbered item (प्रथम, दुसरे, etc.)
        if re.match(r'^(प्रथम|दुसरे|तिसरे|चौथे|पाचवे|सहावे|सातवे|आठवे|नववे|दहावे)', line):
            # Add blank line before numbered items (except if already blank line before)
            if formatted_lines and formatted_lines[-1] != '':
                formatted_lines.append('')
            formatted_lines.append(line)
            # Add blank line after numbered items
            formatted_lines.append('')
        else:
            formatted_lines.append(line)
    
    # Clean up excessive blank lines at the end
    while formatted_lines and formatted_lines[-1] == '':
        formatted_lines.pop()
    
    # Join and ensure final format
    result = '\n'.join(formatted_lines)
    
    # Clean up extra whitespace within lines
    result = re.sub(r' +', ' ', result)
    
    return result.strip() + '\n\n'

def generate_txt_for_all_md_files(explanations_dir='explanations'):
    """Generate .txt files for all .md files in explanations directory."""
    explanations_path = Path(explanations_dir)
    
    if not explanations_path.exists():
        print(f"Error: Directory not found: {explanations_dir}")
        return
    
    md_files = [f for f in explanations_path.glob('*.md') if f.name != 'README.md']
    
    if not md_files:
        print(f"No markdown files found in {explanations_dir}")
        return
    
    print(f"Found {len(md_files)} markdown files")
    print("=" * 50)
    
    success_count = 0
    for md_file in md_files:
        try:
            # Read markdown file
            with open(md_file, 'r', encoding='utf-8') as f:
                md_content = f.read()
            
            # Convert to txt format
            txt_content = convert_md_to_txt(md_content)
            
            # Write txt file
            txt_file = md_file.parent / f"{md_file.stem}.txt"
            with open(txt_file, 'w', encoding='utf-8') as f:
                f.write(txt_content)
            
            print(f"Generated: {txt_file.name}")
            success_count += 1
            
        except Exception as e:
            print(f"Error processing {md_file.name}: {str(e)}")
    
    print("=" * 50)
    print(f"Completed: {success_count}/{len(md_files)} .txt files generated successfully")

if __name__ == '__main__':
    generate_txt_for_all_md_files()

