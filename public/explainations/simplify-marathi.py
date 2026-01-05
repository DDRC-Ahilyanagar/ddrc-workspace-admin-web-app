#!/usr/bin/env python3
"""
Simplify Marathi text in markdown and txt files to use more conversational language.
Replaces formal/pure Marathi words with simpler, commonly used ones.
"""

import re
from pathlib import Path

# Replacement dictionary: formal -> simple/conversational
replacements = {
    # Verbs and phrases
    r'प्रदान करते': 'देते',
    r'प्रदान करा': 'द्या',
    r'दर्शविले जाते': 'दाखवते',
    r'दर्शविला जातो': 'दाखवतो',
    r'दर्शविली जाते': 'दाखवते',
    r'व्यवस्थापित करते': 'काळजी घेते',
    r'व्यवस्थापित करा': 'काळजी घ्या',
    r'निरीक्षण करण्यास': 'बघण्यास',
    r'निरीक्षण करा': 'बघा',
    r'समेट करा': 'जुळवा',
    r'हस्तांतरित करा': 'हलवा',
    r'ट्रॅक करा': 'बघा',
    r'ट्रॅक आणि व्यवस्थापित करा': 'बघा आणि काळजी घ्या',
    
    # Adverbs
    r'स्वयंचलितपणे': 'आपोआप',
    r'व्यक्तिचलितपणे': 'हाताने',
    r'तपशीलवार': 'तपशील',
    
    # Nouns and adjectives
    r'सर्वसमावेशक': 'सगळे',
    r'प्रलंबित': 'बाकी',
    r'प्रलंबित पेमेंट': 'बाकी पेमेंट',
    r'प्रलंबित इन्व्हॉइस': 'बाकी बिल',
    r'प्रलंबित शिल्लक': 'बाकी रक्कम',
    r'प्रलंबित विक्री': 'बाकी विक्री',
    r'प्रलंबित खरेदी': 'बाकी खरेदी',
    r'समर्थन': 'सपोर्ट',
    
    # Phrases
    r'यासह': 'सोबत',
    r'यासाठी': 'साठी',
    r'यानुसार': 'नुसार',
    r'याचा': 'याचा',
    r'याचे': 'याचे',
    
    # More conversational replacements
    r'कामगिरीचे': 'कामाचे',
    r'कामगिरी करणाऱ्या': 'चांगले विकणाऱ्या',
    r'सर्वोत्तम कामगिरी': 'सर्वात जास्त विक्री',
    r'सर्वोत्तम चांगले विकणाऱ्या': 'सर्वात जास्त विकणाऱ्या',
    r'द्रुत प्रवेश': 'जलद प्रवेश',
    r'द्रुत ओव्हरव्ह्यू': 'जलद बघणे',
    r'त्वरित माहितीपूर्ण': 'लवकर',
    r'त्वरित शोधा': 'लवकर शोधा',
    r'प्रभावीपणे': 'चांगल्या पद्धतीने',
    r'प्रभावीपणे व्यवस्थापित': 'काळजी घेण्यास',
    r'मजबूत ग्राहक संबंध': 'चांगले ग्राहक संबंध',
    r'वैयक्तिकृत सेवा': 'वैयक्तिक सेवा',
    r'अचूक इन्व्हेंटरी रेकॉर्ड': 'बरोबर स्टॉक रेकॉर्ड',
    r'लक्ष देण्याची आवश्यकता': 'लक्ष द्यावे लागेल',
    r'ओळखण्यास': 'ओळखण्यासाठी',
    r'दिला जातो': 'दिला जातो',
    r'राखण्यास': 'ठेवण्यास',
}

def simplify_text(text):
    """Simplify Marathi text by replacing formal words with conversational ones."""
    # Apply all replacements
    for pattern, replacement in replacements.items():
        text = re.sub(pattern, replacement, text, flags=re.IGNORECASE)
    
    # Additional simplifications
    # Remove overly formal sentence endings
    text = re.sub(r' केले जाते\.', ' होते.', text)
    text = re.sub(r' केली जाते\.', ' होते.', text)
    text = re.sub(r' केला जातो\.', ' होतो.', text)
    
    # Fix redundant phrases
    text = re.sub(r'लवकर माहिती निर्णय', 'लवकर निर्णय', text)
    text = re.sub(r'चांगल्या पद्धतीने व्यवस्थापित करण्यास', 'काळजी घेण्यास', text)
    
    # Simplify remaining formal constructions
    text = re.sub(r'व्यवस्थापनासाठी', 'व्यवस्थेसाठी', text)
    text = re.sub(r'व्यवस्थापनासह', 'व्यवस्थेसह', text)
    
    return text

def process_file(file_path):
    """Process a single file."""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Simplify the content
        simplified = simplify_text(content)
        
        # Only write if changed
        if simplified != content:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(simplified)
            return True
        return False
    except Exception as e:
        print(f"Error processing {file_path}: {e}")
        return False

def main():
    explanations_dir = Path('explanations')
    
    # Process all .md files
    md_files = list(explanations_dir.glob('*.md'))
    txt_files = list(explanations_dir.glob('*.txt'))
    
    all_files = md_files + txt_files
    
    if not all_files:
        print("No files found in explanations/")
        return
    
    print(f"Found {len(all_files)} files to process")
    print("=" * 60)
    
    updated_count = 0
    for file_path in sorted(all_files):
        if process_file(file_path):
            print(f"Updated: {file_path.name}")
            updated_count += 1
        else:
            print(f"No changes: {file_path.name}")
    
    print("=" * 60)
    print(f"Completed: {updated_count}/{len(all_files)} files updated")

if __name__ == '__main__':
    main()

