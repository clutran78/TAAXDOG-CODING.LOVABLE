#!/bin/bash

# TAAXDOG Production Web Server Launcher
# This script sets up a production-like environment using gunicorn
# for improved stability and performance

# Activate virtual environment if it exists
if [ -d "venv" ]; then
    echo "Activating virtual environment..."
    source venv/bin/activate
else
    echo "Virtual environment not found. Creating one..."
    python -m venv venv
    source venv/bin/activate
    echo "Installing dependencies..."
    pip install -r requirements.txt
    # Install gunicorn if not in requirements
    pip install gunicorn
fi

# Check if .env file exists, if not, create from example
if [ ! -f ".env" ]; then
    echo ".env file not found. Creating from .env.example..."
    cp .env.example .env
    echo "Please update the .env file with your actual API keys and credentials."
fi

# Stop any existing server processes
echo "Checking for existing server processes..."
pkill -f "gunicorn" 2>/dev/null || echo "No existing gunicorn server running"

# Set up the Python path to include the project root
# This fixes the module import issues
export PYTHONPATH=$(pwd):$PYTHONPATH

# Set environment variables
export FLASK_ENV=production
export FLASK_APP=backend/app.py

# Set host and port
HOST=0.0.0.0
PORT=8080

echo "Starting TAAXDOG production server..."
echo "Server will be available at http://localhost:$PORT"
echo "Press Ctrl+C to stop the server"

# Use gunicorn for a more stable production server
# Workers: 2x number of CPU cores + 1 is a good starting point
# Timeout: 120 seconds to allow for slow API calls
gunicorn --bind $HOST:$PORT \
         --workers 3 \
         --timeout 120 \
         --access-logfile logs/access.log \
         --error-logfile logs/error.log \
         --capture-output \
         "backend.app:app"

# Alternative direct method if gunicorn doesn't work:
# python backend/app.py 