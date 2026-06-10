#!/bin/bash

echo "🔍 Diagnosing React Frontend Authentication Issue..."
echo "React Frontend: http://5.75.185.137"
echo "Backend API: http://135.181.33.13:3002"
echo ""

# Test 1: Check if React app can reach backend directly
echo "1️⃣ Testing direct backend connection from React server..."
curl -s -o /dev/null -w "Backend Health Check: %{http_code}\n" http://135.181.33.13:3002/health

# Test 2: Check nginx proxy configuration
echo ""
echo "2️⃣ Testing nginx proxy on React server..."
curl -s -H "Host: 5.75.185.137" -I http://5.75.185.137/api/v1/health | grep -E "(HTTP|Server|Location)"

# Test 3: Test authentication flow through React proxy
echo ""
echo "3️⃣ Testing authentication through React proxy..."
LOGIN_RESPONSE=$(curl -s -X POST "http://5.75.185.137/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username": "superadmin", "password": "SuperAdmin123!"}')

echo "Login Response: $LOGIN_RESPONSE"

# Extract token
TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -n "$TOKEN" ]; then
  echo ""
  echo "4️⃣ Testing loans endpoint with extracted token..."
  curl -s -H "Authorization: Bearer $TOKEN" \
       -H "Content-Type: application/json" \
       "http://5.75.185.137/api/v1/loan/list-employee-loan" | \
       jq '.success, .data.loans | length' 2>/dev/null || \
       echo "Data returned but jq not available"
else
  echo "❌ Could not extract token from login response"
fi

echo ""
echo "5️⃣ Testing CORS and Options requests..."
curl -s -X OPTIONS "http://5.75.185.137/api/v1/loan/list-employee-loan" \
     -H "Origin: http://5.75.185.137" \
     -H "Access-Control-Request-Method: GET" \
     -H "Access-Control-Request-Headers: Authorization,Content-Type" \
     -I | grep -E "(HTTP|Access-Control)"

echo ""
echo "🎯 Diagnosis complete!"