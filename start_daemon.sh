#!/bin/bash

# TAAXDOG Daemon Server Launcher
# This script starts the server as a background process that will
# continue running even if the terminal is closed

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Using port 8080 to avoid conflicts with AirPlay on macOS
# Set up environment variables
export FLASK_APP=backend/app.py
export FLASK_ENV=development
export FLASK_DEBUG=1
export PORT=8080
export PYTHONPATH=$PYTHONPATH:$PWD:$PWD/backend

# Check if gunicorn is installed
if ! command -v gunicorn &> /dev/null; then
    echo "gunicorn is not installed. Please install it with: pip install gunicorn"
    exit 1
fi

# Create logs directory if it doesn't exist
mkdir -p logs

# Check if server is already running
if [ -f taaxdog_server.pid ]; then
    PID=$(cat taaxdog_server.pid)
    if ps -p $PID > /dev/null; then
        echo "Server is already running with PID $PID"
        echo "To stop the server, run: ./stop_daemon.sh"
        exit 0
    else
        rm taaxdog_server.pid
    fi
fi

echo "Starting TAAXDOG server in daemon mode..."
echo "Using gunicorn server"

# Start the server with gunicorn
gunicorn -w 3 --bind 0.0.0.0:$PORT backend.app:app --daemon --log-file=logs/server_startup.log --error-logfile=logs/error.log --pid taaxdog_server.pid

# Alternative approach using Flask directly
# nohup python -m flask run --host=0.0.0.0 --port=$PORT > logs/server.log 2>&1 &
# echo $! > taaxdog_server.pid

# Check if server started successfully
sleep 2
if [ -f taaxdog_server.pid ]; then
    PID=$(cat taaxdog_server.pid)
    if ps -p $PID > /dev/null; then
        echo "Server started with PID $PID"
        echo "Server is running at http://localhost:$PORT"
        echo "To stop the server, run: ./stop_daemon.sh"
        echo "Logs are available in the logs directory"
        exit 0
    fi
fi

echo "Failed to start server. Check logs for details."
exit 1 