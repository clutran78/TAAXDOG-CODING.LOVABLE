#!/bin/bash

# TAAXDOG Web App Server Launcher
# This script sets up the Python environment and starts the Flask server
# with proper module paths and configuration for stability

# Function to handle errors
handle_error() {
    echo "ERROR: $1"
    echo "Falling back to HTTP mode..."
    use_https=false
}

# Function to check if port is in use
is_port_in_use() {
    lsof -i:"$1" >/dev/null 2>&1
    return $?
}

# Default settings
use_https=true
PORT=8080
HOST="127.0.0.1"  # Changed from 0.0.0.0 to ensure better compatibility

# Check if port is in use, try alternatives if needed
if is_port_in_use $PORT; then
    echo "Port $PORT is already in use. Trying alternative port..."
    for alt_port in 5000 3000 8000 8888; do
        if ! is_port_in_use $alt_port; then
            PORT=$alt_port
            echo "Selected alternative port: $PORT"
            break
        fi
    done
    
    if is_port_in_use $PORT; then
        echo "All standard ports are in use. Please close some applications and try again."
        exit 1
    fi
fi

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
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo "Please update the .env file with your actual API keys and credentials."
    else
        echo "WARNING: .env.example not found. Creating empty .env file."
        touch .env
    fi
fi

# Stop any existing Flask server
echo "Checking for existing server processes..."
pkill -f "python backend/app.py" 2>/dev/null || echo "No existing server running"
pkill -f "flask run" 2>/dev/null || echo "No Flask processes running"

# Set up the Python path to include the project root
# This fixes the module import issues
export PYTHONPATH=$(pwd):$PYTHONPATH

# Set Flask to run in development mode with hot reload
export FLASK_ENV=development
export FLASK_APP=backend/app.py
export FLASK_DEBUG=1

# Set host and port
export FLASK_RUN_HOST=$HOST
export FLASK_RUN_PORT=$PORT

# Check if openssl is installed
if ! command -v openssl &> /dev/null; then
    handle_error "OpenSSL not found. Cannot create certificates."
fi

if $use_https; then
    # Install pyopenssl
    echo "Installing pyopenssl..."
    pip install pyopenssl || handle_error "Failed to install pyopenssl"
    
    # Create SSL certificates directory if it doesn't exist
    if [ ! -d "certs" ]; then
        echo "Creating certificates directory..."
        mkdir certs || handle_error "Failed to create certs directory"
    fi

    # Check if SSL certificates exist, if not create self-signed certificates
    if [ ! -f "certs/cert.pem" ] || [ ! -f "certs/key.pem" ]; then
        echo "Generating self-signed SSL certificates for HTTPS..."
        openssl req -x509 -newkey rsa:4096 -nodes -out certs/cert.pem -keyout certs/key.pem -days 365 -subj "/CN=localhost" || handle_error "Failed to generate certificates"
        echo "Self-signed certificates created successfully"
    fi
fi

# Try HTTP mode first (simpler and more reliable)
use_https=false
echo "Starting TAAXDOG server with HTTP..."
echo "Server will be available at http://$HOST:$PORT"
echo "Press Ctrl+C to stop the server"

# Verify the app.py file exists
if [ ! -f "backend/app.py" ]; then
    echo "ERROR: backend/app.py file not found! Check your directory structure."
    exit 1
fi

# Start the server in HTTP mode (more reliable)
python -m flask run --host=$FLASK_RUN_HOST --port=$FLASK_RUN_PORT --threaded

# If we get here, the Flask run command failed
echo "Flask run command failed. Trying alternative method..."
echo "Running the app directly with python..."
python backend/app.py

# If that also failed, give detailed troubleshooting information
echo "ERROR: Server failed to start. Please try the following troubleshooting steps:"
echo "1. Check if port $PORT is in use by another application"
echo "2. Verify your Python installation with: python --version"
echo "3. Check for errors in backend/app.py"
echo "4. Try running 'python backend/app.py' directly"
echo "5. Make sure you have all required packages installed"
exit 1 