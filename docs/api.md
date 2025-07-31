# TaxReturnPro API Documentation

This document provides comprehensive documentation for the TaxReturnPro API endpoints.

## 🔐 Authentication

All API endpoints require authentication using NextAuth sessions. Include the session cookie in your requests.

### Authentication Headers
```
Cookie: next-auth.session-token=your-session-token
```

### Error Responses
```json
{
  "error": "Unauthorized",
  "message": "Authentication required"
}
```

## 📊 Dashboard Endpoints

### GET /api/dashboard

Get comprehensive dashboard data for the authenticated user.

**Response:**
```json
{
  "netIncome": {
    "currentMonth": 3000.00,
    "previousMonth": 2800.00,
    "change": 7.14
  },
  "totalExpenses": {
    "currentMonth": 1500.00,
    "previousMonth": 1400.00,
    "change": 7.14
  },
  "activeGoals": 3,
  "connectedAccounts": 2,
  "recentTransactions": [
    {
      "id": "transaction-1",
      "date": "2024-01-15T00:00:00.000Z",
      "description": "Salary Payment",
      "amount": 3000.00,
      "type": "income",
      "category": "Salary"
    }
  ],
  "expensesByCategory": [
    {
      "name": "Housing",
      "amount": 1200.00,
      "percentage": 80.0
    },
    {
      "name": "Food & Dining",
      "amount": 300.00,
      "percentage": 20.0
    }
  ],
  "monthlyIncome": [
    {"month": "Jan", "amount": 3000},
    {"month": "Feb", "amount": 3100},
    {"month": "Mar", "amount": 3000}
  ],
  "monthlyExpenses": [
    {"month": "Jan", "amount": 1500},
    {"month": "Feb", "amount": 1450},
    {"month": "Mar", "amount": 1500}
  ]
}
```

## 🎯 Goals Management

### GET /api/goals

Get all goals for the authenticated user.

**Response:**
```json
[
  {
    "id": "goal-1",
    "name": "Emergency Fund",
    "description": "Build emergency fund for unexpected expenses",
    "targetAmount": 10000.00,
    "currentAmount": 2500.00,
    "targetDate": "2024-12-31T00:00:00.000Z",
    "category": "Emergency Fund",
    "isCompleted": false,
    "progress": 25.0,
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
]
```

### POST /api/goals

Create a new goal.

**Request Body:**
```json
{
  "name": "Holiday Savings",
  "description": "Save for European vacation",
  "targetAmount": 5000.00,
  "currentAmount": 0.00,
  "targetDate": "2024-06-30",
  "category": "Travel"
}
```

**Response:**
```json
{
  "id": "goal-2",
  "name": "Holiday Savings",
  "description": "Save for European vacation",
  "targetAmount": 5000.00,
  "currentAmount": 0.00,
  "targetDate": "2024-06-30T00:00:00.000Z",
  "category": "Travel",
  "isCompleted": false,
  "createdAt": "2024-01-15T00:00:00.000Z"
}
```

### PUT /api/goals/[id]

Update an existing goal.

**Request Body:**
```json
{
  "currentAmount": 1200.00
}
```

**Response:**
```json
{
  "id": "goal-1",
  "name": "Emergency Fund",
  "description": "Build emergency fund for unexpected expenses",
  "targetAmount": 10000.00,
  "currentAmount": 1200.00,
  "targetDate": "2024-12-31T00:00:00.000Z",
  "category": "Emergency Fund",
  "isCompleted": false,
  "updatedAt": "2024-01-15T00:00:00.000Z"
}
```

### DELETE /api/goals/[id]

Delete a goal.

**Response:**
```json
{
  "message": "Goal deleted successfully"
}
```

## 🏦 Banking Integration

### GET /api/banking/accounts

Get all bank accounts for the authenticated user.

**Response:**
```json
[
  {
    "id": "account-1",
    "institutionName": "Commonwealth Bank",
    "accountName": "Everyday Account",
    "accountNumber": "123456789",
    "bsb": "062-001",
    "accountType": "SAVINGS",
    "balance": 5000.00,
    "isActive": true,
    "connectionStatus": "connected",
    "lastSynced": "2024-01-15T00:00:00.000Z"
  }
]
```

### POST /api/banking/accounts

Add a new bank account.

**Request Body:**
```json
{
  "institutionName": "ANZ Bank",
  "accountName": "Savings Account",
  "accountNumber": "987654321",
  "bsb": "013-006",
  "accountType": "SAVINGS"
}
```

### PUT /api/banking/accounts/[id]

Update bank account information.

**Request Body:**
```json
{
  "accountName": "Updated Account Name",
  "isActive": true
}
```

### DELETE /api/banking/accounts/[id]

Remove a bank account.

**Response:**
```json
{
  "message": "Bank account removed successfully"
}
```

## 💰 Financial Data

### GET /api/financial/net-income

Get net income data with period comparison.

**Query Parameters:**
- `period`: `current-month` | `last-month` | `last-3-months` | `year-to-date`

**Response:**
```json
{
  "currentMonth": 3000.00,
  "previousMonth": 2800.00,
  "yearToDate": 15000.00,
  "transactions": [
    {
      "id": "transaction-1",
      "date": "2024-01-15T00:00:00.000Z",
      "description": "Salary Payment",
      "amount": 3000.00,
      "category": "Salary",
      "source": "Commonwealth Bank"
    }
  ]
}
```

### GET /api/financial/total-expenses

Get total expenses data with category breakdown.

**Query Parameters:**
- `period`: `current-month` | `last-month` | `last-3-months` | `year-to-date`

**Response:**
```json
{
  "currentMonth": 1500.00,
  "previousMonth": 1400.00,
  "yearToDate": 7500.00,
  "categories": [
    {
      "name": "Housing",
      "amount": 1200.00,
      "percentage": 80.0
    },
    {
      "name": "Food & Dining",
      "amount": 300.00,
      "percentage": 20.0
    }
  ],
  "transactions": [
    {
      "id": "transaction-2",
      "date": "2024-01-01T00:00:00.000Z",
      "description": "Rent Payment",
      "amount": 1200.00,
      "category": "Housing",
      "merchant": "Property Manager"
    }
  ]
}
```

## 📋 Tax Profile

### GET /api/tax/profile

Get tax profile for the authenticated user.

**Response:**
```json
{
  "id": "profile-1",
  "tfn": "123456789",
  "abn": "12345678901",
  "businessName": "My Business",
  "isGstRegistered": true,
  "gstRegistrationDate": "2023-01-01",
  "taxResidencyStatus": "resident",
  "financialYearEnd": "30-06",
  "accountingMethod": "cash",
  "businessStructure": "sole_trader",
  "businessAddress": {
    "street": "123 Business Street",
    "suburb": "Sydney",
    "state": "NSW",
    "postcode": "2000"
  }
}
```

### PUT /api/tax/profile

Update tax profile.

**Request Body:**
```json
{
  "tfn": "123456789",
  "abn": "12345678901",
  "businessName": "Updated Business Name",
  "isGstRegistered": true,
  "gstRegistrationDate": "2023-01-01",
  "taxResidencyStatus": "resident",
  "financialYearEnd": "30-06",
  "accountingMethod": "cash",
  "businessStructure": "sole_trader",
  "businessAddress": {
    "street": "123 Business Street",
    "suburb": "Sydney",
    "state": "NSW",
    "postcode": "2000"
  }
}
```

## ⚙️ User Settings

### GET /api/user/settings

Get user settings and preferences.

**Response:**
```json
{
  "notifications": {
    "email": true,
    "push": true,
    "weeklyReports": true,
    "goalReminders": true,
    "transactionAlerts": true
  },
  "privacy": {
    "dataSharing": false,
    "analyticsTracking": true,
    "marketingEmails": false
  },
  "preferences": {
    "currency": "AUD",
    "dateFormat": "DD/MM/YYYY",
    "timeZone": "Australia/Sydney",
    "language": "en-AU"
  },
  "security": {
    "twoFactorEnabled": false,
    "sessionTimeout": 30
  }
}
```

### PUT /api/user/settings

Update user settings.

**Request Body:**
```json
{
  "notifications": {
    "email": true,
    "push": false,
    "weeklyReports": true,
    "goalReminders": true,
    "transactionAlerts": true
  },
  "privacy": {
    "dataSharing": false,
    "analyticsTracking": true,
    "marketingEmails": false
  },
  "preferences": {
    "currency": "AUD",
    "dateFormat": "DD/MM/YYYY",
    "timeZone": "Australia/Sydney",
    "language": "en-AU"
  },
  "security": {
    "twoFactorEnabled": false,
    "sessionTimeout": 30
  }
}
```

## 🔒 Authentication Endpoints

### POST /api/auth/register

Register a new user account.

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "securePassword123"
}
```

**Response:**
```json
{
  "message": "User registered successfully",
  "user": {
    "id": "user-1",
    "name": "John Doe",
    "email": "john@example.com"
  }
}
```

### POST /api/auth/login

Login with email and password.

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "securePassword123"
}
```

### POST /api/auth/forgot-password

Request password reset.

**Request Body:**
```json
{
  "email": "john@example.com"
}
```

**Response:**
```json
{
  "message": "Password reset email sent"
}
```

## 🚨 Standard Error Responses

All endpoints follow a consistent error response format:

```json
{
  "error": "Error Type",
  "message": "Detailed error message",
  "code": "ERROR_CODE"
}
```

### Common Error Codes

- `UNAUTHORIZED` - Authentication required
- `FORBIDDEN` - Insufficient permissions
- `NOT_FOUND` - Resource not found
- `VALIDATION_ERROR` - Invalid input data
- `RATE_LIMITED` - Too many requests
- `INTERNAL_ERROR` - Server error

### HTTP Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `429` - Too Many Requests
- `500` - Internal Server Error

## 📝 Rate Limiting

API endpoints are rate limited to prevent abuse:

- **General endpoints**: 100 requests per 15 minutes
- **Authentication endpoints**: 5 requests per 15 minutes
- **File upload endpoints**: 10 requests per 15 minutes

Rate limit headers are included in responses:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
```

## 🔒 Security

### Input Validation

All inputs are validated and sanitized to prevent:
- SQL injection
- XSS attacks
- CSRF attacks
- Path traversal

### Data Protection

- Sensitive data is encrypted at rest
- TFN and ABN are masked in responses
- Bank account numbers are partially masked
- Passwords are hashed with bcrypt

### Australian Compliance

- ABN validation using official algorithms
- TFN validation following ATO guidelines
- GST calculations comply with ATO standards
- Financial year calculations use Australian tax year (July-June)

## 🌐 CORS Policy

The API supports CORS for authorized domains:
- Production: `https://taxreturnpro.com.au`
- Development: `http://localhost:3000`

## 📞 Support

For API support and questions:

- **Email**: api-support@taxreturnpro.com.au
- **Documentation**: https://docs.taxreturnpro.com.au
- **Status Page**: https://status.taxreturnpro.com.au

## 📚 Additional Resources

- [Authentication Guide](/docs/authentication.md)
- [Banking Integration Guide](/docs/banking-integration.md)
- [Error Handling Guide](/docs/error-handling.md)
- [Webhook Documentation](/docs/webhooks.md)