#!/usr/bin/env python3

"""
TAAXDOG App Launcher

This script sets up the proper Python paths and runs the Flask application.
It ensures that all modules can be imported correctly.
"""

import os
import sys

# Add the project root to the Python path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

# Now import and run the app
from backend.app import app

if __name__ == '__main__':
    # Run the Flask application
    app.run(host='0.0.0.0', port=8080, debug=True) 