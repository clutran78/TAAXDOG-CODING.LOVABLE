#!/usr/bin/env python3

"""
TAAXDOG Import Fixer

This script identifies and resolves import issues by:
1. Checking for missing modules
2. Scanning the project for module locations
3. Creating a PYTHONPATH export command
"""

import os
import sys
import importlib.util
import subprocess

def check_module_exists(module_name):
    """Check if a module can be imported"""
    try:
        importlib.import_module(module_name)
        return True
    except ImportError:
        return False

def find_module_path(module_name, base_dir='.'):
    """Find a Python module file in the project directory"""
    module_file = f"{module_name}.py"
    
    for root, dirs, files in os.walk(base_dir):
        if module_file in files:
            return os.path.abspath(root)
    
    return None

def generate_pythonpath():
    """Generate a PYTHONPATH environment variable setup"""
    # List of modules known to be needed
    modules_to_check = ['firebase_config', 'basiq_api', 'tabscanner_api', 'ai']
    
    # Current directory
    cwd = os.path.abspath(os.getcwd())
    
    # Start with base paths
    paths = [cwd]
    
    # Add backend directory
    backend_path = os.path.join(cwd, 'backend')
    if os.path.isdir(backend_path):
        paths.append(backend_path)
    
    # Check for each module and add its path if found
    for module in modules_to_check:
        if not check_module_exists(module):
            path = find_module_path(module, cwd)
            if path and path not in paths:
                paths.append(path)
    
    # Return PYTHONPATH command
    return f"export PYTHONPATH={':'.join(paths)}:$PYTHONPATH"

def main():
    """Run the import fixer and display results"""
    pythonpath_cmd = generate_pythonpath()
    
    print("TAAXDOG Import Fixer")
    print("====================")
    print("\nAdd this to your shell script to fix imports:")
    print("\n" + pythonpath_cmd)
    print("\nOr run this command in your terminal before starting the server:")
    print("\neval \"$(python fix_imports.py --for-shell)\"")
    
    if len(sys.argv) > 1 and sys.argv[1] == "--for-shell":
        # Just print the command for shell eval
        print(pythonpath_cmd)

if __name__ == "__main__":
    main() 