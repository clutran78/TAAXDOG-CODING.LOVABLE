#!/bin/bash

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
fi

# Check if .env file exists, if not, create from example
if [ ! -f ".env" ]; then
    echo ".env file not found. Creating from .env.example..."
    cp .env.example .env
    echo "Please update the .env file with your actual API keys and credentials."
fi

# Run the Flask application
echo "Starting Flask server with hot-reloading enabled..."
export FLASK_APP=backend/app.py
export FLASK_ENV=development
export FLASK_DEBUG=1

# Using port 8080 instead of 5000 to avoid conflicts with AirPlay Receiver on macOS
# --no-reload=False ensures auto-reloading is enabled
flask run --host=0.0.0.0 --port=8080 --debug 