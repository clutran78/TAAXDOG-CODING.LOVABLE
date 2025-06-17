# TAAXDOG - Financial Management & Tax Reporting Platform

A comprehensive SAAS finance platform for tax reports and financial management. The app uses Firebase for user data, Basiq for banking transactions, Gemini 2.0 Flash API for receipt scanning, DevExpress Dashboard API for data visualization, and Claude 3.7 for financial insights.

## Project Structure

TAAXDOG-CODING/
├── frontend/ # Frontend web application
│ ├── index.html # Main HTML page
│ └── package.json # Frontend dependencies
├── backend/ # Flask backend server
│ └── app.py # Main Flask application
├── database/ # Database configuration and models
├── ai/ # AI integration with Claude 3.7 Sonnet
├── requirements.txt # Python dependencies
├── .env.example # Example environment variables
└── README.md # Project readme and setup

markdown
Copy
Edit

## Features (Planned)

- User authentication and account management
- Banking integration with Basiq API
- Receipt scanning and data extraction with Gemini 2.0 Flash API Key
- Data visualization with DevExpress Dashboard
- Financial insights with Claude 3.7 Sonnet or Claude 4 Sonnet
- Automatic expense categorization
- Tax report generation
- Subscription tracking
- Multi-bank account processing
- Multicurrency support
- Collaborative financial management

## Core Functions

### Net Income
- [ ] Floating tile showing current income streams and net available balance (some balance may be allocated to goals)
- [ ] Income section in menu: detailed transaction history and charts
- [ ] Option to add and rename income streams (e.g. Rental Property, Side Hustle, etc.)

### Total Expenses
- [ ] Floating tile displaying expenses by category with a chart
- [ ] Date/week/month filtering options
- [ ] Menu: full expense log with date, merchant, category, amount
- [ ] Receipts matched with expenses

### Net Balance
- [ ] Floating tile showing current net balance with chart/trend filters
- [ ] Historical views (day/week/month/year)
- [ ] Menu: detailed net balance overview

### Subscriptions
- [ ] Auto-detect recurring monthly subscriptions
- [ ] Manual entry option
- [ ] Option to stop subscriptions via app (if API allows)
- [ ] Connected to Dobbie AI with visual floating tile on request

### Goals
- [ ] Floating windows showing goals, progress bar, timeline, saved vs remaining
- [ ] Menu: create new goal with sub-account setup and auto-transfer (% or fixed)
- [ ] Goal name and custom color

### Notifications
- [ ] Overspending alerts by category
- [ ] Goal progress updates
- [ ] Notifications for income, spending, upcoming subscriptions
- [ ] Petrol price alert within 10km radius

### Bank Accounts
- [ ] Basiq API integration for securely linking bank accounts
- [ ] Sync transactions to Firebase in real time

### Light/Dark Mode
- [ ] Toggle using a 2030s-style sun/moon button
- [ ] Improve dark mode palette for cleaner look

### Snap Receipt
- [ ] Auto-capture when receipt edges are aligned
- [ ] Gemini 2.0 Flash API extracts: date, merchant, category, amount
- [ ] Updates Total Expenses and Net Income in real time

### Tax Profile
- [ ] Options for:
  - Individual taxpayer
  - Individual + ABN
  - Small business owner

### Tax Returns
- [ ] Generate printable/savable tax report
- [ ] Option to share report with tax agent via link
- [ ] Submit to ATO (with API integration after approval)

### Dobbie AI Assistant
- [ ] Chat overlay (half-screen), resizable
- [ ] Friendly and simple but professional tone
- [ ] Integrated with user data, tax rules, and spending insights

### Questions for Dobbie (Pre-set & Smart Suggestions)
- [ ] Can you break down how much I spent last month on food — separately for work, home, and business?
- [ ] How much did I spend on petrol, subscriptions, birthday presents, or Christmas gifts last month?
- [ ] Can you show me a graph of my spending trends by category, with a simple explanation of what it means?
- [ ] Where am I overspending, and how could I cut back without feeling restricted?
- [ ] Given my tax profile, which types of expenses should I focus on to get the best possible tax return?
- [ ] Based on my transaction history, what strategies or budgeting methods might work best for me?
> *(All responses must use categorized user transactions, tax profiles, and ATO tax rules.)*

## Requirements

- Python 3.8+
- Node.js 14+
- Firebase account
- Basiq API access
- DevExpress Dashboard license

## Installation

1. Clone this repository:
git clone <repository-url>
cd TAAXDOG-CODING

markdown
Copy
Edit

2. Install Python dependencies:
pip install -r requirements.txt

markdown
Copy
Edit

3. Install Node.js dependencies:
cd frontend
npm install

markdown
Copy
Edit

4. Create a `.env` file based on `.env.example` and add your API keys and credentials.

## Running the Application

1. Start the Flask backend:
python backend/app.py

sql
Copy
Edit

2. In a new terminal, start the frontend:
cd frontend
npm start

markdown
Copy
Edit

3. Open your browser at:
http://localhost:8080/

markdown
Copy
Edit

## Environment Setup

### Firebase Setup
- Create a Firebase project at [Firebase Console](https://console.firebase.google.com/)
- Enable Authentication and Firestore
- Add Firebase config to `.env`

### Basiq API Setup
- Register at [Basiq Developer Portal](https://dashboard.basiq.io/login)
- Get API key and add it to `.env`

### Receipt OCR (Gemini 2.0 Flash)
- Add Gemini API key to `.env`

### DevExpress Dashboard
- Obtain a license and add the key to `.env`

## Contributing

- Follow this README as your guide
- Keep components under 100 lines where possible
- Use consistent naming patterns
- Comment for clarity
- Never commit sensitive keys; use `.env` securely

## License

[Add your license information here]