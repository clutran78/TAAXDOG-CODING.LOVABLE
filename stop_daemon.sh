#!/bin/bash

# This script stops the TAAXDOG server running in daemon mode

# Define the PID file
PID_FILE="taaxdog_server.pid"

# Check if the server is running
if [ ! -f "$PID_FILE" ]; then
    echo "No server PID file found. Server is not running or was not started with start_daemon.sh."
    exit 0
fi

# Get the PID
PID=$(cat "$PID_FILE")

# Check if the process is running
if ps -p $PID > /dev/null; then
    echo "Stopping server with PID $PID..."
    kill $PID
    sleep 2
    
    # Check if it's still running and force kill if necessary
    if ps -p $PID > /dev/null; then
        echo "Server did not stop gracefully. Forcing termination..."
        kill -9 $PID
    fi
    
    echo "Server stopped."
else
    echo "No running process found with PID $PID."
fi

# Remove the PID file
rm -f "$PID_FILE"
echo "All server processes should now be stopped." 