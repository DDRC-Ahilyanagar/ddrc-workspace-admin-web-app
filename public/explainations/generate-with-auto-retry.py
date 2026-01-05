#!/usr/bin/env python3
"""
Generate TTS audio files with automatic retry when rate limit resets.
This script will check rate limit status and retry automatically.
"""

import sys
import time
from pathlib import Path
import subprocess

def check_rate_limit():
    """Check if rate limit has been reset."""
    try:
        result = subprocess.run(
            [sys.executable, "scripts/check-rate-limit.py"],
            capture_output=True,
            text=True,
            timeout=30
        )
        return "SUCCESS" in result.stdout or "rate limit has been reset" in result.stdout
    except:
        return False

def wait_for_rate_limit_reset(check_interval=300, max_wait=3600):
    """
    Wait for rate limit to reset.
    
    Args:
        check_interval: Seconds between checks (default: 5 minutes)
        max_wait: Maximum seconds to wait (default: 1 hour)
    """
    print("=" * 60)
    print("WAITING FOR RATE LIMIT TO RESET")
    print("=" * 60)
    print(f"Checking every {check_interval // 60} minutes...")
    print(f"Maximum wait time: {max_wait // 60} minutes")
    print("Press Ctrl+C to cancel")
    print()
    
    start_time = time.time()
    check_count = 0
    
    while True:
        elapsed = time.time() - start_time
        
        if elapsed > max_wait:
            print(f"\nMaximum wait time ({max_wait // 60} minutes) exceeded.")
            print("Rate limit may take longer to reset. Try again later.")
            return False
        
        check_count += 1
        print(f"Check #{check_count} - Elapsed: {elapsed // 60:.0f} minutes...", end=" ")
        
        if check_rate_limit():
            print("SUCCESS! Rate limit has been reset.")
            return True
        else:
            print("Still rate limited. Waiting...")
            time.sleep(check_interval)

def main():
    import argparse
    
    parser = argparse.ArgumentParser(
        description='Generate TTS audio files with automatic retry on rate limit',
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    
    parser.add_argument('--workers', type=int, default=3,
                       help='Number of parallel workers (default: 3)')
    parser.add_argument('--delay', type=float, default=2.0,
                       help='Delay between batches in seconds (default: 2.0)')
    parser.add_argument('--check-interval', type=int, default=300,
                       help='Seconds between rate limit checks (default: 300 = 5 minutes)')
    parser.add_argument('--max-wait', type=int, default=3600,
                       help='Maximum seconds to wait for rate limit reset (default: 3600 = 1 hour)')
    parser.add_argument('--skip-wait', action='store_true',
                       help='Skip waiting and try immediately (will fail if rate limited)')
    
    args = parser.parse_args()
    
    # Check rate limit first
    print("Checking rate limit status...")
    if not check_rate_limit():
        if args.skip_wait:
            print("Rate limited, but --skip-wait specified. Attempting anyway...")
        else:
            print("Rate limited detected. Waiting for reset...")
            if not wait_for_rate_limit_reset(args.check_interval, args.max_wait):
                print("\nExiting. Run again later or use --skip-wait to try anyway.")
                sys.exit(1)
    else:
        print("Rate limit check passed. Proceeding with generation...")
    
    # Generate files
    print("\n" + "=" * 60)
    print("STARTING AUDIO GENERATION")
    print("=" * 60)
    print()
    
    try:
        result = subprocess.run(
            [
                sys.executable, 
                "scripts/generate-tts-parallel.py",
                "--workers", str(args.workers),
                "--delay", str(args.delay)
            ],
            check=False
        )
        
        if result.returncode == 0:
            print("\n" + "=" * 60)
            print("GENERATION COMPLETED SUCCESSFULLY!")
            print("=" * 60)
        else:
            print("\n" + "=" * 60)
            print("GENERATION COMPLETED WITH ERRORS")
            print("Check output above for details")
            print("=" * 60)
            sys.exit(result.returncode)
            
    except KeyboardInterrupt:
        print("\n\nInterrupted by user.")
        sys.exit(1)
    except Exception as e:
        print(f"\nError running generation script: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()

