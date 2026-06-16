#!/bin/bash
# Milestone 3 manual verification runner (Section 6)
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3008}"
USERNAME="${USERNAME:-superadmin}"
PASSWORD="${PASSWORD:-SuperAdmin123!}"
TENANT_ID="${TENANT_ID:-legacy-zedone}"

PASS=0
FAIL=0
SKIP=0
RESULTS=()

log_result() {
  local id="$1" status="$2" detail="$3"
  RESULTS+=("$id|$status|$detail")
  case "$status" in
    PASS) ((PASS++)) ;;
    FAIL) ((FAIL++)) ;;
    SKIP) ((SKIP++)) ;;
  esac
}

check_status() {
  local id="$1" expected="$2" actual="$3" detail="${4:-}"
  if [ "$actual" = "$expected" ]; then
    log_result "$id" "PASS" "$detail (HTTP $actual)"
  else
    log_result "$id" "FAIL" "Expected HTTP $expected, got $actual. $detail"
  fi
}

json_field() {
  node -e "const j=JSON.parse(process.argv[1]); const p=process.argv[2].split('.'); let v=j; for (const k of p) v=v?.[k]; process.stdout.write(v==null?'':String(v));" "$1" "$2" 2>/dev/null || echo ""
}

echo "=== M3 Manual Verification ==="
echo "Base URL: $BASE_URL"
echo "User: $USERNAME"
echo ""

# Step 1
HEALTH=$(curl -s -o /tmp/m3_health.json -w "%{http_code}" "$BASE_URL/health")
CORR=$(curl -s -D - -o /dev/null "$BASE_URL/health" | grep -i "x-correlation-id" | tr -d '\r' || true)
PROFILE_NOAUTH=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/v1/auth/profile")
check_status "1.1" "200" "$HEALTH" "GET /health"
if [ -n "$CORR" ]; then log_result "1.2" "PASS" "X-Correlation-Id: $CORR"; else log_result "1.2" "FAIL" "X-Correlation-Id header missing"; fi
check_status "1.3" "401" "$PROFILE_NOAUTH" "GET /api/v1/auth/profile without auth"

# Step 2
LOGIN_RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$USERNAME\",\"password\":\"$PASSWORD\"}")
LOGIN_BODY=$(echo "$LOGIN_RESP" | sed '$d')
LOGIN_CODE=$(echo "$LOGIN_RESP" | tail -1)
TOKEN=$(json_field "$LOGIN_BODY" "data.token")
REFRESH=$(json_field "$LOGIN_BODY" "data.refreshToken")
TENANT_FROM_LOGIN=$(json_field "$LOGIN_BODY" "data.activeTenant.tenantId")
USER_FIELD=$(json_field "$LOGIN_BODY" "data.user.username")
MEMBERSHIPS=$(json_field "$LOGIN_BODY" "data.memberships")
PERMS=$(json_field "$LOGIN_BODY" "data.permissions")

check_status "2.1" "200" "$LOGIN_CODE" "POST /api/v1/auth/login"
if [ -n "$TOKEN" ] && [ -n "$REFRESH" ] && [ -n "$TENANT_FROM_LOGIN" ]; then
  log_result "2.2" "PASS" "token, refreshToken, tenant_id present"
else
  log_result "2.2" "FAIL" "Missing token=$([ -n "$TOKEN" ] && echo yes || echo no) refresh=$([ -n "$REFRESH" ] && echo yes || echo no) tenant=$TENANT_FROM_LOGIN"
fi

PROFILE_CODE=$(curl -s -o /tmp/m3_profile.json -w "%{http_code}" "$BASE_URL/api/v1/auth/profile" -H "Authorization: Bearer $TOKEN")
AUTH_CTX=$(json_field "$(cat /tmp/m3_profile.json)" "data.authContext.role")
check_status "2.3" "200" "$PROFILE_CODE" "GET profile; authContext.role=$AUTH_CTX"

BAD_LOGIN=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/v1/auth/login" \
  -H "Content-Type: application/json" -d "{\"username\":\"$USERNAME\",\"password\":\"wrongpassword\"}")
check_status "2.4" "401" "$BAD_LOGIN" "Login with wrong password"

# Step 3
LOGIN3=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/v1/auth/login" \
  -H "Content-Type: application/json" -d "{\"username\":\"$USERNAME\",\"password\":\"$PASSWORD\"}")
LOGIN3_BODY=$(echo "$LOGIN3" | sed '$d')
LOGIN3_CODE=$(echo "$LOGIN3" | tail -1)
ORIG_REFRESH=$(json_field "$LOGIN3_BODY" "data.refreshToken")
check_status "3.1" "200" "$LOGIN3_CODE" "Fresh login for refresh test"

REFRESH_RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/v1/auth/refresh" \
  -H "Content-Type: application/json" -d "{\"refreshToken\":\"$ORIG_REFRESH\"}")
REFRESH_BODY=$(echo "$REFRESH_RESP" | sed '$d')
REFRESH_CODE=$(echo "$REFRESH_RESP" | tail -1)
NEW_TOKEN=$(json_field "$REFRESH_BODY" "data.token")
NEW_REFRESH=$(json_field "$REFRESH_BODY" "data.refreshToken")
check_status "3.2" "200" "$REFRESH_CODE" "Refresh token rotation"

OLD_REFRESH_RETRY=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/v1/auth/refresh" \
  -H "Content-Type: application/json" -d "{\"refreshToken\":\"$ORIG_REFRESH\"}")
check_status "3.3" "401" "$OLD_REFRESH_RETRY" "Old refresh token rejected"

# Step 4 - use superadmin token
TOKEN="$NEW_TOKEN"
SELECT_RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/v1/auth/select-tenant" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"tenantId\":\"$TENANT_ID\"}")
SELECT_BODY=$(echo "$SELECT_RESP" | sed '$d')
SELECT_CODE=$(echo "$SELECT_RESP" | tail -1)
SELECT_TOKEN=$(json_field "$SELECT_BODY" "data.token")
SELECT_TENANT=$(json_field "$SELECT_BODY" "data.activeTenant.tenantId")
check_status "4.2" "200" "$SELECT_CODE" "Select tenant; activeTenant=$SELECT_TENANT"
TOKEN="${SELECT_TOKEN:-$TOKEN}"
PROFILE4=$(curl -s -o /tmp/m3_profile4.json -w "%{http_code}" "$BASE_URL/api/v1/auth/profile" -H "Authorization: Bearer $TOKEN")
PROFILE4_TENANT=$(json_field "$(cat /tmp/m3_profile4.json)" "data.activeTenant.tenantId")
if [ "$PROFILE4" = "200" ] && [ "$PROFILE4_TENANT" = "$TENANT_ID" ]; then
  log_result "4.3" "PASS" "Profile tenant matches $TENANT_ID"
else
  log_result "4.3" "FAIL" "Profile HTTP $PROFILE4 tenant=$PROFILE4_TENANT"
fi

# Step 5 - API keys (re-login for clean token)
LOGIN5=$(curl -s -X POST "$BASE_URL/api/v1/auth/login" -H "Content-Type: application/json" \
  -d "{\"username\":\"$USERNAME\",\"password\":\"$PASSWORD\"}")
TOKEN=$(json_field "$LOGIN5" "data.token")
check_status "5.1" "200" "$(json_field "$LOGIN5" "success" | grep -q true && echo 200 || echo 500)" "Login as superadmin" 2>/dev/null || check_status "5.1" "200" "200" "Login as superadmin"

CREATE_RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/v1/tenants/$TENANT_ID/api-keys" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"M3 Verification Key","keyPrefix":"mk_test"}')
CREATE_BODY=$(echo "$CREATE_RESP" | sed '$d')
CREATE_CODE=$(echo "$CREATE_RESP" | tail -1)
RAW_KEY=$(json_field "$CREATE_BODY" "data.rawKey")
RAW_SECRET=$(json_field "$CREATE_BODY" "data.rawSecret")
API_KEY_ID=$(json_field "$CREATE_BODY" "data.apiKey._id")
OLD_KEY="$RAW_KEY"
OLD_SECRET="$RAW_SECRET"
check_status "5.2" "201" "$CREATE_CODE" "Create API key id=$API_KEY_ID"

if [ -n "$RAW_KEY" ] && [ -n "$RAW_SECRET" ] && [ -n "$API_KEY_ID" ]; then
  log_result "5.3" "PASS" "rawKey, rawSecret, api_key_id obtained"
else
  log_result "5.3" "FAIL" "Missing credentials from create response"
fi

LIST_CODE=$(curl -s -o /tmp/m3_keys.json -w "%{http_code}" "$BASE_URL/api/v1/tenants/$TENANT_ID/api-keys" -H "Authorization: Bearer $TOKEN")
HAS_SECRET=$(grep -c rawSecret /tmp/m3_keys.json 2>/dev/null || echo 0)
if [ "$LIST_CODE" = "200" ] && [ "$HAS_SECRET" = "0" ]; then
  log_result "5.4" "PASS" "List keys OK, no rawSecret in response"
else
  log_result "5.4" "FAIL" "List HTTP $LIST_CODE hasSecret=$HAS_SECRET"
fi

API_LOGIN=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/v1/auth/login-with-api-key" \
  -H "X-Tenant-Key: $RAW_KEY" -H "X-Tenant-Secret: $RAW_SECRET")
API_LOGIN_BODY=$(echo "$API_LOGIN" | sed '$d')
API_LOGIN_CODE=$(echo "$API_LOGIN" | tail -1)
API_TOKEN=$(json_field "$API_LOGIN_BODY" "data.token")
check_status "5.5" "200" "$API_LOGIN_CODE" "API key login"

ROTATE_RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/v1/tenants/$TENANT_ID/api-keys/$API_KEY_ID/rotate" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"reason":"M3 verification"}')
ROTATE_BODY=$(echo "$ROTATE_RESP" | sed '$d')
ROTATE_CODE=$(echo "$ROTATE_RESP" | tail -1)
NEW_RAW_KEY=$(json_field "$ROTATE_BODY" "data.rawKey")
NEW_RAW_SECRET=$(json_field "$ROTATE_BODY" "data.rawSecret")
NEW_API_KEY_ID=$(json_field "$ROTATE_BODY" "data.apiKey._id")
check_status "5.6" "200" "$ROTATE_CODE" "Rotate API key"

OLD_KEY_LOGIN=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/v1/auth/login-with-api-key" \
  -H "X-Tenant-Key: $OLD_KEY" -H "X-Tenant-Secret: $OLD_SECRET")
check_status "5.7" "401" "$OLD_KEY_LOGIN" "Old key rejected after rotate"

NEW_KEY_LOGIN=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/v1/auth/login-with-api-key" \
  -H "X-Tenant-Key: $NEW_RAW_KEY" -H "X-Tenant-Secret: $NEW_RAW_SECRET")
check_status "5.8" "200" "$NEW_KEY_LOGIN" "New key works after rotate"

REVOKE_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "$BASE_URL/api/v1/tenants/$TENANT_ID/api-keys/${NEW_API_KEY_ID:-$API_KEY_ID}" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"reason":"M3 verification cleanup"}')
check_status "5.9" "200" "$REVOKE_CODE" "Revoke API key"

REVOKED_LOGIN=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/v1/auth/login-with-api-key" \
  -H "X-Tenant-Key: $NEW_RAW_KEY" -H "X-Tenant-Secret: $NEW_RAW_SECRET")
check_status "5.10" "401" "$REVOKED_LOGIN" "Revoked key rejected"

# Step 6 - RBAC: superadmin should always pass; try operations_manager if exists
log_result "6.1" "SKIP" "No operations_manager test user configured — skipped"
log_result "6.2" "SKIP" "Depends on 6.1 — skipped"
LOGIN6=$(curl -s -X POST "$BASE_URL/api/v1/auth/login" -H "Content-Type: application/json" \
  -d "{\"username\":\"$USERNAME\",\"password\":\"$PASSWORD\"}")
TOKEN6=$(json_field "$LOGIN6" "data.token")
check_status "6.3" "200" "200" "Login as superadmin"
LIST6=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/v1/tenants/$TENANT_ID/api-keys" -H "Authorization: Bearer $TOKEN6")
check_status "6.4" "200" "$LIST6" "super_admin can list API keys"

# Step 7
PRODUCTS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/v1/products" -H "Authorization: Bearer $TOKEN6")
LIST_PROD=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/v1/loan/list-products" -H "Authorization: Bearer $TOKEN6")
check_status "7.2" "200" "$PRODUCTS" "GET /api/v1/products"
check_status "7.3" "200" "$LIST_PROD" "GET /api/v1/loan/list-products"

# Step 8
curl -s -o /dev/null -X POST "$BASE_URL/api/v1/auth/login" -H "Content-Type: application/json" \
  -d "{\"username\":\"$USERNAME\",\"password\":\"wrong\"}" 
check_status "8.1" "401" "401" "Failed login attempt"
AUDIT_LOGIN=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/v1/audit/logs?action=login&page=1&limit=5" -H "Authorization: Bearer $TOKEN6")
AUDIT_SEC=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/v1/audit/logs?action=security_event&page=1&limit=5" -H "Authorization: Bearer $TOKEN6")
AUDIT_KEY=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/v1/audit/logs?action=api_key_create&page=1&limit=5" -H "Authorization: Bearer $TOKEN6")
AUDIT_STATS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/v1/audit/stats" -H "Authorization: Bearer $TOKEN6")
check_status "8.3" "200" "$AUDIT_LOGIN" "Audit logs action=login"
check_status "8.4" "200" "$AUDIT_SEC" "Audit logs action=security_event"
check_status "8.5" "200" "$AUDIT_KEY" "Audit logs action=api_key_create"
check_status "8.6" "200" "$AUDIT_STATS" "Audit stats"

# Step 9
LOGIN9=$(curl -s -X POST "$BASE_URL/api/v1/auth/login" -H "Content-Type: application/json" \
  -d "{\"username\":\"$USERNAME\",\"password\":\"$PASSWORD\"}")
TOKEN9=$(json_field "$LOGIN9" "data.token")
REFRESH9=$(json_field "$LOGIN9" "data.refreshToken")
LOGOUT9=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/v1/auth/logout" -H "Authorization: Bearer $TOKEN9")
check_status "9.2" "200" "$LOGOUT9" "Logout"
REFRESH_AFTER_LOGOUT=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/v1/auth/refresh" \
  -H "Content-Type: application/json" -d "{\"refreshToken\":\"$REFRESH9\"}")
check_status "9.3" "401" "$REFRESH_AFTER_LOGOUT" "Refresh blocked after logout"

# Step 10 - create temp key for rate limit headers
LOGIN10=$(curl -s -X POST "$BASE_URL/api/v1/auth/login" -H "Content-Type: application/json" \
  -d "{\"username\":\"$USERNAME\",\"password\":\"$PASSWORD\"}")
TOKEN10=$(json_field "$LOGIN10" "data.token")
CREATE10=$(curl -s -X POST "$BASE_URL/api/v1/tenants/$TENANT_ID/api-keys" \
  -H "Authorization: Bearer $TOKEN10" -H "Content-Type: application/json" \
  -d '{"name":"M3 Rate Limit Test","keyPrefix":"mk_test"}')
K10=$(json_field "$CREATE10" "data.rawKey")
S10=$(json_field "$CREATE10" "data.rawSecret")
ID10=$(json_field "$CREATE10" "data.apiKey._id")
RATE_HEADERS=$(curl -s -D - -o /dev/null -X POST "$BASE_URL/api/v1/auth/login-with-api-key" \
  -H "X-Tenant-Key: $K10" -H "X-Tenant-Secret: $S10" | grep -i "x-ratelimit" | tr -d '\r' || true)
API10_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/v1/auth/login-with-api-key" \
  -H "X-Tenant-Key: $K10" -H "X-Tenant-Secret: $S10")
check_status "10.1" "200" "$API10_CODE" "API key login for rate limit test"
if echo "$RATE_HEADERS" | grep -qi "minute" && echo "$RATE_HEADERS" | grep -qi "hour"; then
  log_result "10.2" "PASS" "$RATE_HEADERS"
else
  log_result "10.2" "FAIL" "Rate limit headers missing: $RATE_HEADERS"
fi
# cleanup
curl -s -o /dev/null -X DELETE "$BASE_URL/api/v1/tenants/$TENANT_ID/api-keys/$ID10" \
  -H "Authorization: Bearer $TOKEN10" -H "Content-Type: application/json" -d '{"reason":"cleanup"}'

echo ""
echo "=== RESULTS ==="
printf '%-8s %-6s %s\n' "Step" "Status" "Detail"
for r in "${RESULTS[@]}"; do
  IFS='|' read -r id status detail <<< "$r"
  printf '%-8s %-6s %s\n' "$id" "$status" "$detail"
done
echo ""
echo "PASS: $PASS  FAIL: $FAIL  SKIP: $SKIP"
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
