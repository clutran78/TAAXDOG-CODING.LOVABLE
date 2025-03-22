#!/usr/bin/env python3

"""
Simple HTTP Server for TAAXDOG
This script provides a reliable way to start the web server
"""

import os
import sys
import subprocess
import time
import signal
import socket

def setup_python_path():
    """Set up the Python path to include all necessary directories"""
    current_dir = os.path.abspath(os.getcwd())
    backend_dir = os.path.join(current_dir, 'backend')
    
    # Add current directory, backend, and other potential module locations
    paths = [
        current_dir,
        backend_dir,
        os.path.join(current_dir, 'ai'),
        os.path.join(current_dir, 'database')
    ]
    
    # Set PYTHONPATH
    python_path = os.pathsep.join(paths)
    os.environ['PYTHONPATH'] = python_path + os.pathsep + os.environ.get('PYTHONPATH', '')
    print(f"PYTHONPATH set to: {os.environ['PYTHONPATH']}")

def find_available_port(start_port=8080, max_attempts=20):
    """Find an available port starting from start_port"""
    for attempt in range(max_attempts):
        port = start_port + attempt
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        result = sock.connect_ex(('127.0.0.1', port))
        sock.close()
        if result != 0:  # Port is available
            return port
    
    return None  # No ports available

def ensure_firebase_config():
    """Ensure firebase-config.js exists in the frontend directory"""
    frontend_dir = os.path.join(os.getcwd(), 'frontend')
    firebase_config_path = os.path.join(frontend_dir, 'firebase-config.js')
    
    if not os.path.exists(firebase_config_path):
        print("Creating a minimal firebase-config.js file...")
        with open(firebase_config_path, 'w') as f:
            f.write("""// Firebase configuration for development
const firebaseConfig = {
    apiKey: "demo-key-for-development",
    authDomain: "taaxdog-demo.firebaseapp.com",
    projectId: "taaxdog-demo",
    storageBucket: "taaxdog-demo.appspot.com",
    messagingSenderId: "123456789012",
    appId: "1:123456789012:web:abcdef1234567890"
};

// Make it available globally
if (typeof module !== 'undefined') {
    module.exports = { firebaseConfig };
}
""")
        print("Created firebase-config.js")
    else:
        print("firebase-config.js already exists")
        
    return firebase_config_path

def handle_sigint(sig, frame):
    """Handle Ctrl+C gracefully"""
    print("\nShutting down server...")
    sys.exit(0)

def run_flask_app():
    """Run the Flask app directly"""
    # Find an available port
    port = find_available_port(8080)
    if port is None:
        print("ERROR: No available ports found. Close some applications and try again.")
        return False
    
    # Make sure the firebase-config.js file exists
    ensure_firebase_config()
    
    # Flask environment setup
    os.environ['FLASK_ENV'] = 'development'
    os.environ['FLASK_APP'] = 'backend/app.py'
    os.environ['FLASK_DEBUG'] = '1'
    os.environ['FLASK_RUN_PORT'] = str(port)
    os.environ['FLASK_RUN_HOST'] = '127.0.0.1'
    
    # Make sure the backend app exists
    backend_app = os.path.join('backend', 'app.py')
    if not os.path.exists(backend_app):
        print(f"ERROR: {backend_app} not found!")
        return False
        
    # Print connection information
    print(f"\n{'='*50}")
    print(f"TAAXDOG server starting at http://127.0.0.1:{port}")
    print(f"{'='*50}\n")
    
    # Try running the app
    try:
        # Register SIGINT handler for graceful shutdown
        signal.signal(signal.SIGINT, handle_sigint)
        
        # Start the server
        print(f"Server running at: http://127.0.0.1:{port}")
        print("Press Ctrl+C to stop the server")
        
        # Run Flask directly with python
        cmd = [sys.executable, backend_app]
        process = subprocess.Popen(cmd, env=os.environ)
        process.wait()
        return True
    except Exception as e:
        print(f"Error starting server: {e}")
        return False

if __name__ == "__main__":
    # Kill any existing server processes
    try:
        subprocess.run(["pkill", "-f", "python backend/app.py"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        print("Stopped any running servers")
        time.sleep(1)  # Give processes time to terminate
    except:
        pass
    
    # Setup environment
    setup_python_path()
    
    # Run app
    success = run_flask_app()
    
    if not success:
        print("\nTroubleshooting tips:")
        print("1. Check if backend/app.py exists and has no syntax errors")
        print("2. Make sure all required packages are installed: pip install -r requirements.txt")
        print("3. Check if .env file exists with necessary configuration")
        print("4. Try running 'python backend/app.py' directly to see error messages")
        print("5. On macOS, disable AirPlay Receiver in System Preferences -> Sharing to free up port 5000")
        sys.exit(1) 