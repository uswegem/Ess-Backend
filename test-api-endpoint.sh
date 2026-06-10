#!/bin/bash

# Test script to verify the employee loans API endpoint is working
# This simulates the React frontend making a request to the backend

echo "🧪 Testing Employee Loans API Endpoint..."

# First, try to login to get a token
echo "1️⃣ Attempting to login..."
TOKEN_RESPONSE=$(curl -s -X POST http://135.181.33.13:3002/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "superadmin", "password": "SuperAdmin123!"}')

echo "Login response: $TOKEN_RESPONSE"

# Extract token from response (if successful)
TOKEN=$(echo $TOKEN_RESPONSE | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -n "$TOKEN" ]; then
  echo "✅ Login successful, token obtained"
  
  # Test the employee loans endpoint with authentication
  echo "2️⃣ Testing employee loans endpoint with authentication..."
  curl -s -H "Authorization: Bearer $TOKEN" \
       -H "Content-Type: application/json" \
       http://135.181.33.13:3002/api/v1/loan/list-employee-loan
       
  echo -e "\n✅ Employee loans endpoint test completed"
else
  echo "❌ Login failed, testing without authentication..."
  
  # Test the endpoint without authentication (should return 401)
  echo "2️⃣ Testing employee loans endpoint without authentication..."
  RESPONSE=$(curl -s -w "%{http_code}" -o /tmp/response.txt http://135.181.33.13:3002/api/v1/loan/list-employee-loan)
  
  echo "HTTP Status: $RESPONSE"
  echo "Response body:"
  cat /tmp/response.txt
  
  if [ "$RESPONSE" = "401" ]; then
    echo -e "\n✅ Endpoint correctly returns 401 for unauthenticated requests"
  else
    echo -e "\n❌ Unexpected response code: $RESPONSE"
  fi
fi

echo "🎯 Test completed!"