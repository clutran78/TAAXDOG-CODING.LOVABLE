#!/bin/bash

echo "🧪 Testing TAAXDOG Authentication System"
echo "========================================"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Base URL
BASE_URL="http://localhost:3000"

# Generate unique test data
TIMESTAMP=$(date +%s)
TEST_EMAIL="test${TIMESTAMP}@example.com"
TEST_PASSWORD="TestPassword123!"
TEST_NAME="Test User ${TIMESTAMP}"

echo -e "\n📝 Test Configuration:"
echo "   Email: ${TEST_EMAIL}"
echo "   Password: ${TEST_PASSWORD}"
echo "   Name: ${TEST_NAME}"

# Test 1: Health Check
echo -e "\n\n1️⃣  Testing Server Health..."
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" ${BASE_URL})
if [ "$HTTP_STATUS" = "200" ]; then
    echo -e "   ${GREEN}✓ Server is running${NC}"
else
    echo -e "   ${RED}✗ Server is not responding (HTTP ${HTTP_STATUS})${NC}"
    exit 1
fi

# Test 2: Registration
echo -e "\n2️⃣  Testing Registration..."
REGISTER_RESPONSE=$(curl -s -X POST ${BASE_URL}/api/auth/simple-register \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"${TEST_EMAIL}\",
    \"password\": \"${TEST_PASSWORD}\",
    \"name\": \"${TEST_NAME}\"
  }")

if echo "$REGISTER_RESPONSE" | grep -q "Account created successfully"; then
    echo -e "   ${GREEN}✓ Registration successful${NC}"
    echo "   Response: $(echo $REGISTER_RESPONSE | jq -c .)"
else
    echo -e "   ${RED}✗ Registration failed${NC}"
    echo "   Response: $REGISTER_RESPONSE"
fi

# Test 3: Duplicate Registration (should fail)
echo -e "\n3️⃣  Testing Duplicate Registration..."
DUP_RESPONSE=$(curl -s -X POST ${BASE_URL}/api/auth/simple-register \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"${TEST_EMAIL}\",
    \"password\": \"${TEST_PASSWORD}\",
    \"name\": \"${TEST_NAME}\"
  }")

if echo "$DUP_RESPONSE" | grep -q "already registered"; then
    echo -e "   ${GREEN}✓ Duplicate prevention working${NC}"
else
    echo -e "   ${YELLOW}⚠ Unexpected response for duplicate${NC}"
    echo "   Response: $DUP_RESPONSE"
fi

# Test 4: Login (should require verification)
echo -e "\n4️⃣  Testing Login..."
LOGIN_RESPONSE=$(curl -s -X POST ${BASE_URL}/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"${TEST_EMAIL}\",
    \"password\": \"${TEST_PASSWORD}\"
  }")

if echo "$LOGIN_RESPONSE" | grep -q "Email not verified"; then
    echo -e "   ${GREEN}✓ Email verification requirement working${NC}"
else
    echo -e "   ${YELLOW}⚠ Unexpected login response${NC}"
    echo "   Response: $LOGIN_RESPONSE"
fi

# Test 5: Invalid Login
echo -e "\n5️⃣  Testing Invalid Login..."
INVALID_RESPONSE=$(curl -s -X POST ${BASE_URL}/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"${TEST_EMAIL}\",
    \"password\": \"wrongpassword\"
  }")

if echo "$INVALID_RESPONSE" | grep -q "Invalid email or password"; then
    echo -e "   ${GREEN}✓ Invalid login prevention working${NC}"
else
    echo -e "   ${YELLOW}⚠ Unexpected response for invalid login${NC}"
    echo "   Response: $INVALID_RESPONSE"
fi

# Test 6: Password Reset Request
echo -e "\n6️⃣  Testing Password Reset Request..."
RESET_RESPONSE=$(curl -s -X POST ${BASE_URL}/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"${TEST_EMAIL}\"
  }")

if echo "$RESET_RESPONSE" | grep -q "If an account exists"; then
    echo -e "   ${GREEN}✓ Password reset request working${NC}"
else
    echo -e "   ${YELLOW}⚠ Unexpected password reset response${NC}"
    echo "   Response: $RESET_RESPONSE"
fi

# Test 7: Rate Limiting
echo -e "\n7️⃣  Testing Rate Limiting..."
echo "   Making 6 rapid requests..."
for i in {1..6}; do
    RATE_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X POST ${BASE_URL}/api/auth/login \
      -H "Content-Type: application/json" \
      -d "{
        \"email\": \"ratelimit${i}@example.com\",
        \"password\": \"password\"
      }")
    
    if [ $i -le 5 ]; then
        if [ "$RATE_RESPONSE" = "401" ]; then
            echo -e "   Request $i: ${GREEN}✓${NC} (401 - Normal)"
        else
            echo -e "   Request $i: ${YELLOW}⚠${NC} (${RATE_RESPONSE})"
        fi
    else
        if [ "$RATE_RESPONSE" = "429" ]; then
            echo -e "   Request $i: ${GREEN}✓ Rate limit triggered${NC} (429)"
        else
            echo -e "   Request $i: ${RED}✗ Rate limit not working${NC} (${RATE_RESPONSE})"
        fi
    fi
done

echo -e "\n\n✅ ${GREEN}Authentication System Test Complete!${NC}"
echo "========================================"