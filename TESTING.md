# TAAXDOG Web App Testing Guide

This guide provides instructions on how to visualize and test the TAAXDOG web application.

## Prerequisites

Before you begin, ensure you have the following installed:
- Python 3.8 or higher
- Node.js and npm
- Git (for version control)

## Setting Up the Environment

1. Clone the repository (if you haven't already):
   ```
   git clone <repository-url>
   cd TAAXDOG-CODING
   ```

2. Set up environment variables:
   - Copy the `.env.example` file to `.env`
   - Update the `.env` file with your actual API keys and credentials

## Running the Application

### Option 1: Using the run script (Recommended)

We've created a convenient script to set up and run the application:

1. Make the script executable:
   ```
   chmod +x run_app.sh
   ```

2. Run the script:
   ```
   ./run_app.sh
   ```

This script will:
- Activate or create a virtual environment
- Install required dependencies
- Set up environment variables
- Start the Flask server on port 8080

### Option 2: Manual Setup

If you prefer to set up manually:

1. Set up a Python virtual environment:
   ```
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

2. Install Python dependencies:
   ```
   pip install -r requirements.txt
   ```

3. Start the Flask server:
   ```
   export FLASK_APP=backend/app.py
   export FLASK_ENV=development
   flask run --host=0.0.0.0 --port=8080
   ```

## Accessing the Web App

Once the server is running, you can access the web app in your browser:

- Main application: http://localhost:8080
- Login page: http://localhost:8080/login
- Registration page: http://localhost:8080/register

## Testing Features

### 1. User Authentication

1. Navigate to the registration page
2. Create a new account with your email and password
3. Log in with your credentials
4. Verify that you can access the dashboard after logging in

### 2. Dashboard Functionality

1. After logging in, explore the dashboard interface
2. Check if financial data is displayed correctly (if connected to Basiq)
3. Test navigation between different sections

### 3. API Testing

#### Using the API Testing Script

We've created a Python script to help test the API endpoints:

1. Make the script executable:
   ```
   chmod +x test_api.py
   ```

2. Run the script to test if the server is running:
   ```
   ./test_api.py --server http://localhost:8080
   ```

3. Test authentication and user profile endpoints:
   ```
   ./test_api.py --server http://localhost:8080 --email your@email.com --password yourpassword
   ```

4. You can also set environment variables for testing:
   ```
   export TEST_EMAIL=your@email.com
   export TEST_PASSWORD=yourpassword
   ./test_api.py --server http://localhost:8080
   ```

#### Manual API Testing

You can also test the API endpoints using tools like Postman or curl:

- Verify token: 
  ```
  POST http://localhost:8080/api/auth/verify-token
  Headers: { "Authorization": "Bearer YOUR_ID_TOKEN" }
  ```

- Get user profile:
  ```
  GET http://localhost:8080/api/users/profile
  Headers: { "Authorization": "Bearer YOUR_ID_TOKEN" }
  ```

- Update user profile:
  ```
  PUT http://localhost:8080/api/users/profile
  Headers: { "Authorization": "Bearer YOUR_ID_TOKEN" }
  Body: { "displayName": "New Name", "phoneNumber": "+1234567890" }
  ```

## Visualizing the Web App

### Browser Testing

The primary way to visualize and test the TAAXDOG web app is through a web browser:

1. Start the Flask server using one of the methods above
2. Open your browser and navigate to http://localhost:8080
3. Use the browser's developer tools (F12 or right-click > Inspect) to:
   - View the console for JavaScript errors
   - Inspect network requests
   - Test responsiveness using the device emulation mode

### Screenshots for Documentation

To capture screenshots for documentation or bug reports:

1. Use your operating system's screenshot tool:
   - macOS: Command + Shift + 4
   - Windows: Windows key + Shift + S
   - Linux: PrtScn or use a tool like Flameshot

2. Alternatively, use browser developer tools to capture full-page screenshots:
   - In Chrome: Open DevTools > Command Menu (Ctrl+Shift+P) > "Capture full size screenshot"

## Troubleshooting

### Common Issues

1. **Server won't start**:
   - Check if port 8080 is already in use
   - Verify that all dependencies are installed
   - Check for errors in the console output

2. **Authentication issues**:
   - Ensure Firebase configuration is correct in `.env`
   - Check browser console for any JavaScript errors

3. **API connection issues**:
   - Verify that all API keys in `.env` are valid
   - Check network requests in browser developer tools

### Developer Tools

For debugging and testing:

1. **Browser Developer Tools**:
   - Press F12 or right-click and select "Inspect" in your browser
   - Use the Console tab to check for JavaScript errors
   - Use the Network tab to monitor API requests

2. **Flask Debug Mode**:
   - The application runs in development mode by default
   - Check the terminal for Python errors and logs

## Next Steps in Development

As per the PLAN.md, the next phases to implement and test are:

- Banking Integration with Basiq (Phase 3)
- Receipt Scanning with Gemini 2.0 Flash API (Phase 4)
- Data Dashboard with DevExpress (Phase 5)
- Financial Analysis with Claude 3.7 (Phase 6)

Each phase should be tested thoroughly before moving to the next. 