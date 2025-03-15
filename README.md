# TAAXDOG - Financial Management & Tax Reporting Platform

A comprehensive SAAS finance platform for tax reports and financial management. The app uses Firebase for user data, Basiq for banking transactions, DocuClipper and Tabscanner for receipt scanning, DevExpress Dashboard API for data visualization, and Claude 3.7 for financial insights.

## Project Structure

```
TAAXDOG-CODING/
├── frontend/            # Frontend web application
│   ├── index.html       # Main HTML page
│   └── package.json     # Frontend dependencies
├── backend/             # Flask backend server
│   └── app.py           # Main Flask application
├── database/            # Database configuration and models
├── ai/                  # AI integration with Claude 3.7
├── requirements.txt     # Python dependencies
├── .env.example         # Example environment variables
└── PLAN.md              # Development plan
```

## Features (Planned)

- User authentication and account management
- Banking integration with Basiq API
- Receipt scanning and data extraction with DocuClipper and Tabscanner OCR
- Data visualization with DevExpress Dashboard
- Financial insights with Claude 3.7
- Automatic expense categorization
- Tax report generation
- Subscription tracking
- Multi-bank account processing
- Multicurrency support
- Collaborative financial management

## Requirements

- Python 3.8+
- Node.js 14+
- Firebase account
- Basiq API access
- DocuClipper API access
- Tabscanner OCR API access
- DevExpress Dashboard license

## Installation

1. Clone this repository:
   ```
   git clone <repository-url>
   cd TAAXDOG-CODING
   ```

2. Install Python dependencies:
   ```
   pip install -r requirements.txt
   ```

3. Install Node.js dependencies:
   ```
   cd frontend
   npm install
   ```

4. Create a `.env` file based on `.env.example` and fill in your API keys and configuration.

## Running the Application

1. Start the Flask backend server:
   ```
   python backend/app.py
   ```

2. In a separate terminal, start the frontend server:
   ```
   cd frontend
   npm start
   ```

3. Open your web browser and navigate to:
   ```
   http://localhost:8080/
   ```

## Development Plan

See [PLAN.md](PLAN.md) for the detailed development plan and progress tracking.

## Environment Setup

1. Firebase Setup:
   - Create a Firebase project at [Firebase Console](https://console.firebase.google.com/)
   - Enable Authentication and Firestore Database
   - Download your Firebase configuration and add it to the `.env` file

2. Basiq API Setup:
   - Register for a Basiq account at [Basiq Developer Portal](https://dashboard.basiq.io/login)
   - Create an application and get your API key
   - Add the API key to the `.env` file

3. Receipt OCR API Setup:
   - DocuClipper Setup:
     - Register for DocuClipper API access
     - Add your API key to the `.env` file
   - Tabscanner Setup:
     - Register for Tabscanner OCR API access at [Tabscanner](https://tabscanner.com/)
     - Add your API key to the `.env` file

4. DevExpress Dashboard Setup:
   - Obtain a DevExpress Dashboard license
   - Add your license key to the `.env` file

## Contributing

1. Follow the development plan in PLAN.md
2. Keep files small and focused (<100 lines)
3. Use consistent naming conventions
4. Add clear comments for readability
5. Securely manage sensitive data using environment variables

## License

[Add your license information here] 