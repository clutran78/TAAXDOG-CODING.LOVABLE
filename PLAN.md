# TAAXDOG Web App Development Plan

This document outlines the step-by-step plan for building the TAAXDOG web app, a SAAS finance platform for tax reports and financial management. The app uses Firebase for user data, Basiq for banking transactions, Gemini 2.0 Flash API for receipt scanning, DevExpress Dashboard API for data visualization, and Claude 3.7/4 Sonnet for financial insights. Cursor will refer to this plan for every prompt, following each step sequentially to ensure systematic development.

---

### Phase 1: Setting Up the Environment
- **Step 1.1**: ✅ Set up the project structure with folders: `frontend`, `backend`, `database`, `ai`.
- **Step 1.2**: ✅ Install necessary tools and libraries:
  - ✅ Node.js (for frontend and backend servers)
  - ✅ Python (for Flask backend)
  - ✅ Flask (for backend framework)
  - ✅ Firebase CLI (for user database)
  - ✅ Other dependencies as needed (e.g., requests, axios)

---

### Phase 2: User Authentication and Database
- **Step 2.1**: ✅ Integrate Firebase for user authentication and database management.
- **Step 2.2**: ✅ Create user registration and login functionality in the frontend (`frontend/login.html`, `frontend/register.html`).
- **Step 2.3**: ✅ Implement backend routes in Flask (`backend/app.py`) to handle user authentication with Firebase.

---

### Phase 3: Banking Integration with Basiq
- **Step 3.1**: ✅ Integrate Basiq API for banking transactions (simulation implemented for development).
- **Step 3.2**: ✅ Implement functionality to connect multiple bank accounts per user with a form interface.
- **Step 3.3**: ✅ Create a secure method to store and manage bank connection tokens.
- **Step 3.4**: ✅ Add UI for refreshing and deleting bank connections.
- **Step 3.5**: ✅ Sync transactions to Firebase in real time
- **Step 3.6**: ✅ Implement multi-bank account processing
- **Step 3.7**: [ ] Add multicurrency support

---

### Phase 4: UI Development (Additional Phase)
- **Step 4.1**: ✅ Develop responsive dashboard layout with sidebar navigation.
- **Step 4.2**: ✅ Implement financial stats cards for key metrics (income, expenses, balance, subscriptions).
- **Step 4.3**: ✅ Create interactive tiles for goals, bank accounts, and notifications.
- **Step 4.4**: ✅ Add modal windows for detailed content views.
- **Step 4.5**: ✅ Implement mobile-responsive design for all components.
- **Step 4.6**: ✅ Add logout functionality.
- **Step 4.7**: ✅ Enable hot-reloading for development efficiency.
- **Step 4.8**: ✅ Implement Light/Dark Mode toggle using 2030s-style sun/moon button
- **Step 4.9**: ✅ Improve dark mode palette for cleaner look

---

### Phase 5: Core Financial Functions

#### Net Income Features
- **Step 5.1**: ✅ Create floating tile showing current income streams and net available balance
- **Step 5.2**: ✅ Implement income section in menu with detailed transaction history and charts
- **Step 5.3**: ✅ Add option to add and rename income streams (e.g. Rental Property, Side Hustle, etc.)

#### Total Expenses Features
- **Step 5.4**: ✅ Create floating tile displaying expenses by category with chart
- **Step 5.5**: ✅ Add date/week/month filtering options
- **Step 5.6**: ✅ Implement full expense log with date, merchant, category, amount
- **Step 5.7**: ✅ Match receipts with expenses automatically

#### Net Balance Features
- **Step 5.8**: ✅ Create floating tile showing current net balance with chart/trend filters
- **Step 5.9**: ✅ Add historical views (day/week/month/year)
- **Step 5.10**: ✅ Implement detailed net balance overview menu

#### Subscriptions Management
- **Step 5.11**: ✅ Auto-detect recurring monthly subscriptions
- **Step 5.12**: ✅ Add manual entry option for subscriptions
- **Step 5.13**: [ ] Implement option to stop subscriptions via app (if API allows)
- **Step 5.14**: [ ] Connect to Dobbie AI with visual floating tile on request

#### Goals Management
- **Step 5.15**: ✅ Create floating windows showing goals, progress bar, timeline, saved vs remaining
- **Step 5.16**: ✅ Implement create new goal with sub-account setup and auto-transfer (% or fixed)
- **Step 5.17**: ✅ Add goal name and custom color options

---

### Phase 6: Receipt Scanning and Data Extraction
- **Step 6.1**: ✅ Integrate FormX.ai OCR API for receipt scanning and data extraction.
- **Step 6.2**: [ ] Migrate to Gemini 2.0 Flash API for receipt processing
- **Step 6.3**: ✅ Implement auto-capture when receipt edges are aligned
- **Step 6.4**: ✅ Extract date, merchant, category, amount from receipts
- **Step 6.5**: ✅ Update Total Expenses and Net Income in real time
- **Step 6.6**: ✅ Implement receipt matching with banking transactions from Basiq

---

### Phase 7: Data Dashboard and Visualization
- **Step 7.1**: ✅ Integrate Chart.js for data visualization.
- **Step 7.2**: ✅ Create dashboards to display:
  - ✅ Financial insights
  - ✅ Expense tracking
  - ✅ Transaction history
  - ✅ Tax reports
- **Step 7.3**: ✅ Ensure the dashboard is user-friendly and responsive across devices.

---

### Phase 8: Notifications System
- **Step 8.1**: ✅ Implement overspending alerts by category
- **Step 8.2**: ✅ Add goal progress update notifications
- **Step 8.3**: ✅ Create notifications for income, spending, upcoming subscriptions
- **Step 8.4**: ✅ Add petrol price alert within 10km radius

---

### Phase 9: Tax Profile and Returns
- **Step 9.1**: ✅ Create tax profile options for:
  - ✅ Individual taxpayer
  - ✅ Individual + ABN
  - ✅ Small business owner
- **Step 9.2**: [ ] Generate printable/savable tax report
- **Step 9.3**: [ ] Add option to share report with tax agent via link
- **Step 9.4**: [ ] Implement submit to ATO (with API integration after approval)

---

### Phase 10: Dobbie AI Assistant Integration
- **Step 10.1**: ✅ Create chat overlay (half-screen), resizable
- **Step 10.2**: ✅ Implement friendly and professional tone
- **Step 10.3**: ✅ Integrate with user data, tax rules, and spending insights
- **Step 10.4**: ✅ Add pre-set questions and smart suggestions:
  - ✅ Monthly spending breakdown by category (work, home, business)
  - ✅ Spending analysis for petrol, subscriptions, gifts
  - ✅ Spending trends graphs with explanations
  - ✅ Overspending identification and cut-back suggestions
  - ✅ Tax deduction optimization based on profile
  - ✅ Personalized budgeting strategy recommendations

---

### Phase 11: Financial Analysis with Claude 3.7/4 Sonnet
- **Step 11.1**: ✅ Integrate Claude 3.7/4 for generating financial insights based on user data from Basiq
- **Step 11.2**: [ ] Implement dynamic financial goals that adjust based on income/expenses
- **Step 11.3**: [ ] Add AI-powered tax deductions by analyzing expenses
- **Step 11.4**: [ ] Enable real-time tax report updates throughout the year
- **Step 11.5**: [ ] Implement automatic expense categorization

---

### Phase 12: Advanced Features
- **Step 12.1**: [ ] Implement automatic monthly report generation and send notifications to users
- **Step 12.2**: [ ] Create on-demand financial reports for tax purposes
- **Step 12.3**: [ ] Add a feature for users to request tax-related financial reports
- **Step 12.4**: [ ] Implement a subscriptions analyzer to track recurring expenses
- **Step 12.5**: [ ] Add carbon footprint tracking for transactions with a show/hide option
- **Step 12.6**: [ ] Create an emergency fund tracker
- **Step 12.7**: [ ] Set up AI-powered notifications (e.g., "You are currently spending too much on groceries")
- **Step 12.8**: [ ] Implement offline mode to show transactions from the last connection
- **Step 12.9**: [ ] Add collaborative financial management features for businesses

---

### Phase 13: Testing and Deployment
- **Step 13.1**: [ ] Test all functionalities thoroughly, including user authentication, banking integration, receipt scanning, dashboard, and AI features
- **Step 13.2**: [ ] Debug any issues using browser developer tools
- **Step 13.3**: [ ] Deploy the web app to a hosting platform (e.g., Heroku, Vercel)
- **Step 13.4**: [ ] Ensure the GitHub repository remains private and updated
- **Step 13.5**: ✅ Set up CI/CD pipeline using GitHub Actions

---

### Current Progress (As of June 2025)
We have successfully completed Phases 1-7 and Phase 9-10, with partial completion of Phase 11, including:

1. ✅ **Complete Next.js Frontend** with responsive design and TypeScript
2. ✅ **Modular Backend Structure** with separate route files
3. ✅ **Banking Integration** with Basiq API and real-time transaction sync
4. ✅ **Firebase Authentication** and Firestore integration
5. ✅ **Receipt Scanning Infrastructure** with FormX.ai integration
6. ✅ **Data Visualization Dashboard** with Chart.js
7. ✅ **Core Financial Functions** (Net Income, Expenses, Balance, Goals, Subscriptions)
8. ✅ **Tax Profile Management** with different taxpayer types
9. ✅ **Dobbie AI Assistant** with Claude integration and smart suggestions
10. ✅ **Light/Dark Mode** implementation
11. ✅ **Development Infrastructure** with modern tooling and CI/CD

**Next Priority**: Focus on implementing remaining AI features (Phase 11) and Advanced Features (Phase 12).

---

### Development Requirements
- Python 3.8+
- Node.js 14+
- Firebase account
- Basiq API access
- Gemini 2.0 Flash API key
- DevExpress Dashboard license (optional)

---

### Guidelines for Development
- Keep components under 100 lines where possible
- Use consistent naming patterns (camelCase for variables)
- Comment for clarity
- Never commit sensitive keys; use `.env` securely
- Follow TypeScript best practices for frontend
- Use modular backend structure with separate route files

---

Cursor will follow this plan step by step, asking for confirmation after each step before proceeding to the next. 

# Run all tests
pytest tests/

# Run with coverage
pytest tests/ --cov=backend --cov-report=html

# Run specific test categories
pytest tests/unit/           # Unit tests only
pytest tests/performance/    # Performance tests only 