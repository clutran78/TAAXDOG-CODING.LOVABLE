#!/bin/bash

# Find any process using port 3025
PID=$(lsof -ti:3025)

# If a process is found, kill it
if [ ! -z "$PID" ]; then
  echo "Killing process $PID that is using port 3025"
  kill $PID
  # Give it a moment to release the port
  sleep 1
fi

# Start the browser tools server
echo "Starting browser tools server..."
npx @agentdeskai/browser-tools-server 