#!/usr/bin/env python3
"""
Utility script to encode Firebase service account JSON to base64.
This helps prepare the service account for secure storage as an environment variable.
"""

import json
import base64
import sys
import os

def encode_service_account(file_path: str) -> str:
    """
    Read a Firebase service account JSON file and encode it to base64.
    
    Args:
        file_path: Path to the service account JSON file
        
    Returns:
        Base64 encoded string
    """
    try:
        with open(file_path, 'r') as f:
            service_account = json.load(f)
        
        # Convert to JSON string with no extra whitespace
        json_str = json.dumps(service_account, separators=(',', ':'))
        
        # Encode to base64
        encoded = base64.b64encode(json_str.encode('utf-8')).decode('utf-8')
        
        return encoded
    
    except FileNotFoundError:
        print(f"Error: File not found: {file_path}")
        sys.exit(1)
    except json.JSONDecodeError:
        print(f"Error: Invalid JSON in file: {file_path}")
        sys.exit(1)
    except Exception as e:
        print(f"Error: {str(e)}")
        sys.exit(1)

def main():
    if len(sys.argv) != 2:
        print("Usage: python encode-firebase-key.py <path-to-service-account.json>")
        print("\nExample:")
        print("  python encode-firebase-key.py backend/firebase-adminsdk.json")
        sys.exit(1)
    
    file_path = sys.argv[1]
    
    if not os.path.exists(file_path):
        print(f"Error: File does not exist: {file_path}")
        sys.exit(1)
    
    encoded = encode_service_account(file_path)
    
    print("Base64 encoded service account:")
    print("-" * 80)
    print(encoded)
    print("-" * 80)
    print("\nTo use this in your environment:")
    print("1. Copy the encoded string above")
    print("2. Set it as an environment variable:")
    print("   export FIREBASE_SERVICE_ACCOUNT='<encoded-string>'")
    print("3. Or add to your .env file:")
    print("   FIREBASE_SERVICE_ACCOUNT=<encoded-string>")

if __name__ == "__main__":
    main()