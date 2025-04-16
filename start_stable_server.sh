#!/bin/bash

# Kill any existing Python servers
echo "Stopping any existing Python servers..."
pkill -f "python -m http.server" || true
pkill -f "python -m flask" || true

# Clear port if in use (mainly for macOS, which uses port 5000 for AirPlay)
echo "Setting up Flask server on port 5005..."

# Start Flask server in development mode
echo "Starting stable server..."
export FLASK_ENV=development
python -m flask --app backend/app.py run --port=5005 --no-debugger --no-reload

echo "Server stopped." 