#!/bin/bash

# API Endpoint Testing Script
# Tests all major API endpoints with various scenarios

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Base URL - adjust as needed
BASE_URL="http://localhost:3000"
API_URL="${BASE_URL}/api"

# Test credentials
TEST_EMAIL="test@example.com"
TEST_PASSWORD="Test123!@#"
TEST_EMAIL_2="test2@example.com"
TEST_PASSWORD_2="Test456!@#"

# Function to print test results
print_result() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓ $2${NC}"
    else
        echo -e "${RED}✗ $2${NC}"
    fi
}

# Function to extract value from JSON
extract_json_value() {
    echo "$1" | grep -o "\"$2\":[^,}]*" | sed "s/\"$2\":\"//" | sed 's/"//' | sed 's/}//'
}

echo "🧪 API Endpoint Testing Suite"
echo "================================"
echo "Base URL: $BASE_URL"
echo ""

# 1. Health Check Endpoints
echo "1. Testing Health Check Endpoints..."
echo "-----------------------------------"

# Basic health check
echo "Testing GET /api/health..."
RESPONSE=$(curl -s -w "\n%{http_code}" "$API_URL/health")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')
print_result $([[ "$HTTP_CODE" == "200" ]] && echo 0 || echo 1) "Basic health check (HTTP $HTTP_CODE)"

# Liveness check
echo "Testing GET /api/health/liveness..."
RESPONSE=$(curl -s -w "\n%{http_code}" "$API_URL/health/liveness")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
print_result $([[ "$HTTP_CODE" == "200" ]] && echo 0 || echo 1) "Liveness check (HTTP $HTTP_CODE)"

# Readiness check
echo "Testing GET /api/health/readiness..."
RESPONSE=$(curl -s -w "\n%{http_code}" "$API_URL/health/readiness")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
print_result $([[ "$HTTP_CODE" == "200" ]] && echo 0 || echo 1) "Readiness check (HTTP $HTTP_CODE)"

echo ""

# 2. Authentication Endpoints
echo "2. Testing Authentication Endpoints..."
echo "-------------------------------------"

# Register new user
echo "Testing POST /api/auth/register..."
REGISTER_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/auth/register" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\",\"name\":\"Test User\"}")
HTTP_CODE=$(echo "$REGISTER_RESPONSE" | tail -n1)
BODY=$(echo "$REGISTER_RESPONSE" | sed '$d')
print_result $([[ "$HTTP_CODE" == "200" || "$HTTP_CODE" == "201" || "$HTTP_CODE" == "409" ]] && echo 0 || echo 1) "User registration (HTTP $HTTP_CODE)"

# Login
echo "Testing POST /api/auth/login..."
LOGIN_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}")
HTTP_CODE=$(echo "$LOGIN_RESPONSE" | tail -n1)
BODY=$(echo "$LOGIN_RESPONSE" | sed '$d')

if [[ "$HTTP_CODE" == "200" ]]; then
    TOKEN=$(extract_json_value "$BODY" "token")
    USER_ID=$(extract_json_value "$BODY" "userId")
    print_result 0 "User login successful"
    echo "  Token: ${TOKEN:0:20}..."
    echo "  User ID: $USER_ID"
else
    print_result 1 "User login failed (HTTP $HTTP_CODE)"
    TOKEN=""
fi

# Test invalid login
echo "Testing POST /api/auth/login (invalid credentials)..."
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"invalid@example.com","password":"wrongpassword"}')
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
print_result $([[ "$HTTP_CODE" == "401" ]] && echo 0 || echo 1) "Invalid login rejected (HTTP $HTTP_CODE)"

echo ""

# 3. Protected Endpoints (requires authentication)
if [ -n "$TOKEN" ]; then
    echo "3. Testing Protected Endpoints..."
    echo "---------------------------------"
    
    # Get user dashboard
    echo "Testing GET /api/optimized/user-dashboard..."
    RESPONSE=$(curl -s -w "\n%{http_code}" "$API_URL/optimized/user-dashboard" \
        -H "Authorization: Bearer $TOKEN")
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    print_result $([[ "$HTTP_CODE" == "200" ]] && echo 0 || echo 1) "User dashboard (HTTP $HTTP_CODE)"
    
    # Get goals
    echo "Testing GET /api/goals..."
    RESPONSE=$(curl -s -w "\n%{http_code}" "$API_URL/goals" \
        -H "Authorization: Bearer $TOKEN")
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    print_result $([[ "$HTTP_CODE" == "200" ]] && echo 0 || echo 1) "Get goals (HTTP $HTTP_CODE)"
    
    # Create a goal
    echo "Testing POST /api/goals..."
    RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/goals" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -d '{"name":"Test Goal","targetAmount":1000,"currentAmount":0,"targetDate":"2024-12-31","category":"SAVINGS"}')
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | sed '$d')
    if [[ "$HTTP_CODE" == "200" || "$HTTP_CODE" == "201" ]]; then
        GOAL_ID=$(extract_json_value "$BODY" "id")
        print_result 0 "Create goal (HTTP $HTTP_CODE)"
        echo "  Goal ID: $GOAL_ID"
    else
        print_result 1 "Create goal failed (HTTP $HTTP_CODE)"
    fi
    
    # Get budgets
    echo "Testing GET /api/budgets..."
    RESPONSE=$(curl -s -w "\n%{http_code}" "$API_URL/budgets" \
        -H "Authorization: Bearer $TOKEN")
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    print_result $([[ "$HTTP_CODE" == "200" ]] && echo 0 || echo 1) "Get budgets (HTTP $HTTP_CODE)"
else
    echo "⚠️  Skipping protected endpoint tests (no auth token)"
fi

echo ""

# 4. Security Tests
echo "4. Testing Security..."
echo "----------------------"

# Test without authentication
echo "Testing GET /api/goals (no auth)..."
RESPONSE=$(curl -s -w "\n%{http_code}" "$API_URL/goals")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
print_result $([[ "$HTTP_CODE" == "401" || "$HTTP_CODE" == "403" ]] && echo 0 || echo 1) "Unauthorized access blocked (HTTP $HTTP_CODE)"

# Test with invalid token
echo "Testing GET /api/goals (invalid token)..."
RESPONSE=$(curl -s -w "\n%{http_code}" "$API_URL/goals" \
    -H "Authorization: Bearer invalid-token-12345")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
print_result $([[ "$HTTP_CODE" == "401" || "$HTTP_CODE" == "403" ]] && echo 0 || echo 1) "Invalid token rejected (HTTP $HTTP_CODE)"

# Test SQL injection attempt
echo "Testing SQL injection protection..."
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com\" OR \"1\"=\"1","password":"anything"}')
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
print_result $([[ "$HTTP_CODE" != "200" ]] && echo 0 || echo 1) "SQL injection blocked (HTTP $HTTP_CODE)"

# Test XSS attempt
echo "Testing XSS protection..."
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/auth/register" \
    -H "Content-Type: application/json" \
    -d '{"email":"xss@test.com","password":"Test123!","name":"<script>alert(\"XSS\")</script>"}')
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')
# Check if script tags are escaped in response
if [[ "$BODY" == *"<script>"* ]]; then
    print_result 1 "XSS not properly handled"
else
    print_result 0 "XSS properly handled"
fi

echo ""

# 5. User Isolation Tests
echo "5. Testing User Isolation..."
echo "----------------------------"

if [ -n "$TOKEN" ]; then
    # Register second user
    echo "Creating second test user..."
    REGISTER2_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/auth/register" \
        -H "Content-Type: application/json" \
        -d "{\"email\":\"$TEST_EMAIL_2\",\"password\":\"$TEST_PASSWORD_2\",\"name\":\"Test User 2\"}")
    
    # Login as second user
    LOGIN2_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/auth/login" \
        -H "Content-Type: application/json" \
        -d "{\"email\":\"$TEST_EMAIL_2\",\"password\":\"$TEST_PASSWORD_2\"}")
    HTTP_CODE=$(echo "$LOGIN2_RESPONSE" | tail -n1)
    BODY=$(echo "$LOGIN2_RESPONSE" | sed '$d')
    
    if [[ "$HTTP_CODE" == "200" ]]; then
        TOKEN2=$(extract_json_value "$BODY" "token")
        USER_ID2=$(extract_json_value "$BODY" "userId")
        
        # Try to access first user's goal with second user's token
        if [ -n "$GOAL_ID" ]; then
            echo "Testing cross-user data access..."
            RESPONSE=$(curl -s -w "\n%{http_code}" "$API_URL/goals/$GOAL_ID" \
                -H "Authorization: Bearer $TOKEN2")
            HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
            print_result $([[ "$HTTP_CODE" == "404" || "$HTTP_CODE" == "403" ]] && echo 0 || echo 1) "Cross-user access blocked (HTTP $HTTP_CODE)"
        fi
        
        # Verify each user sees only their own data
        echo "Testing data isolation..."
        GOALS1=$(curl -s "$API_URL/goals" -H "Authorization: Bearer $TOKEN")
        GOALS2=$(curl -s "$API_URL/goals" -H "Authorization: Bearer $TOKEN2")
        
        # Simple check - the responses should be different
        if [[ "$GOALS1" != "$GOALS2" ]]; then
            print_result 0 "User data properly isolated"
        else
            print_result 1 "User data not properly isolated"
        fi
    fi
fi

echo ""

# 6. Rate Limiting Tests
echo "6. Testing Rate Limiting..."
echo "---------------------------"

echo "Sending multiple rapid requests..."
RATE_LIMITED=false
for i in {1..20}; do
    RESPONSE=$(curl -s -w "\n%{http_code}" "$API_URL/health")
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    if [[ "$HTTP_CODE" == "429" ]]; then
        RATE_LIMITED=true
        break
    fi
done

if $RATE_LIMITED; then
    print_result 0 "Rate limiting is active (triggered after $i requests)"
else
    print_result 1 "Rate limiting not triggered (sent 20 requests)"
fi

echo ""

# 7. Error Handling Tests
echo "7. Testing Error Handling..."
echo "----------------------------"

# Invalid JSON
echo "Testing invalid JSON handling..."
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d '{invalid json}')
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
print_result $([[ "$HTTP_CODE" == "400" ]] && echo 0 || echo 1) "Invalid JSON rejected (HTTP $HTTP_CODE)"

# Missing required fields
echo "Testing missing required fields..."
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com"}')
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
print_result $([[ "$HTTP_CODE" == "400" ]] && echo 0 || echo 1) "Missing fields rejected (HTTP $HTTP_CODE)"

# Invalid method
echo "Testing invalid HTTP method..."
RESPONSE=$(curl -s -w "\n%{http_code}" -X DELETE "$API_URL/auth/login")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
print_result $([[ "$HTTP_CODE" == "405" ]] && echo 0 || echo 1) "Invalid method rejected (HTTP $HTTP_CODE)"

# Non-existent endpoint
echo "Testing 404 handling..."
RESPONSE=$(curl -s -w "\n%{http_code}" "$API_URL/non-existent-endpoint")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
print_result $([[ "$HTTP_CODE" == "404" ]] && echo 0 || echo 1) "404 properly handled (HTTP $HTTP_CODE)"

echo ""
echo "================================"
echo "✅ API Endpoint Testing Complete"
echo "================================"

# Create detailed curl examples
cat > api-test-examples.md << 'EOF'
# API Testing Examples

## Authentication

### Register User
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"SecurePass123!","name":"Test User"}'
```

### Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"SecurePass123!"}'
```

### Forgot Password
```bash
curl -X POST http://localhost:3000/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com"}'
```

## Protected Endpoints

### Get User Dashboard
```bash
curl -X GET http://localhost:3000/api/optimized/user-dashboard \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Get Goals
```bash
curl -X GET http://localhost:3000/api/goals \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Create Goal
```bash
curl -X POST http://localhost:3000/api/goals \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Save for Holiday","targetAmount":5000,"currentAmount":0,"targetDate":"2024-12-31","category":"SAVINGS"}'
```

### Update Goal
```bash
curl -X PUT http://localhost:3000/api/goals/GOAL_ID \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"currentAmount":1000}'
```

### Delete Goal
```bash
curl -X DELETE http://localhost:3000/api/goals/GOAL_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Budgets

### Get Budgets
```bash
curl -X GET http://localhost:3000/api/budgets \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Create Budget
```bash
curl -X POST http://localhost:3000/api/budgets \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"categoryId":"groceries","amount":500,"period":"MONTHLY","startDate":"2024-01-01"}'
```

## Transactions

### Get Transactions
```bash
curl -X GET http://localhost:3000/api/transactions \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Sync BASIQ Transactions
```bash
curl -X POST http://localhost:3000/api/basiq/transactions \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## AI Services

### Get AI Insights
```bash
curl -X POST http://localhost:3000/api/ai/insights \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type":"spending_analysis"}'
```

### Process Receipt
```bash
curl -X POST http://localhost:3000/api/ai/process-receipt \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "receipt=@/path/to/receipt.jpg"
```

## Compliance

### Get GST Report
```bash
curl -X GET http://localhost:3000/api/compliance/gst/bas-report \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Calculate GST
```bash
curl -X POST http://localhost:3000/api/compliance/gst/calculate \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"amount":110,"isInclusive":true}'
```

## Admin Endpoints

### Get Performance Metrics (Admin only)
```bash
curl -X GET http://localhost:3000/api/monitoring/performance \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

### Get Query Metrics (Admin only)
```bash
curl -X GET http://localhost:3000/api/admin/query-metrics?type=dashboard \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

## Health Checks

### Basic Health
```bash
curl -X GET http://localhost:3000/api/health
```

### Liveness Check
```bash
curl -X GET http://localhost:3000/api/health/liveness
```

### Readiness Check
```bash
curl -X GET http://localhost:3000/api/health/readiness
```

### External Services Status
```bash
curl -X GET http://localhost:3000/api/health/external-services
```
EOF

echo ""
echo "📝 Detailed curl examples saved to api-test-examples.md"