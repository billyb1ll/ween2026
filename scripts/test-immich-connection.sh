#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────
# Immich Local Server — Connection Test Script
# Usage:
#   bash scripts/test-immich-connection.sh [base_url] [api_key]
#
# Defaults:
#   base_url = http://192.168.137.1:2284
#   api_key  = $VITE_IMMICH_API_KEY (from environment)
# ──────────────────────────────────────────────────────────────

set -euo pipefail

BASE_URL="${1:-http://192.168.137.1:2284}"
API_KEY="${2:-${VITE_IMMICH_API_KEY:-}}"

# Strip trailing slash
BASE_URL="${BASE_URL%/}"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

PASS=0
FAIL=0

print_header() {
  echo ""
  echo -e "${BOLD}${CYAN}═══════════════════════════════════════════════${RESET}"
  echo -e "${BOLD}${CYAN}  Immich Connection Test${RESET}"
  echo -e "${BOLD}${CYAN}  Target: ${BASE_URL}${RESET}"
  echo -e "${BOLD}${CYAN}═══════════════════════════════════════════════${RESET}"
  echo ""
}

test_endpoint() {
  local label="$1"
  local url="$2"
  local auth="${3:-false}"
  local method="${4:-GET}"

  echo -ne "  ${BOLD}[$label]${RESET} ${method} ${url} ... "

  local curl_args=(-s -o /dev/stdout -w "\n%{http_code}" --connect-timeout 5 --max-time 10)

  if [ "$auth" = "true" ] && [ -n "$API_KEY" ]; then
    curl_args+=(-H "x-api-key: ${API_KEY}")
  fi

  local response
  response=$(curl "${curl_args[@]}" "${url}" 2>/dev/null) || {
    echo -e "${RED}FAIL${RESET} (connection refused / timeout)"
    FAIL=$((FAIL + 1))
    return 1
  }

  local body
  local status_code
  body=$(echo "$response" | sed '$d')
  status_code=$(echo "$response" | tail -1)

  if [ "$status_code" -ge 200 ] && [ "$status_code" -lt 300 ]; then
    echo -e "${GREEN}PASS${RESET} (HTTP ${status_code})"
    echo -e "    ${body}" | head -5
    PASS=$((PASS + 1))
  elif [ "$status_code" -eq 401 ] || [ "$status_code" -eq 403 ]; then
    if [ "$auth" = "true" ] && [ -z "$API_KEY" ]; then
      echo -e "${YELLOW}SKIP${RESET} (HTTP ${status_code} — no API key provided)"
    else
      echo -e "${RED}FAIL${RESET} (HTTP ${status_code} — invalid API key?)"
      FAIL=$((FAIL + 1))
    fi
  else
    echo -e "${RED}FAIL${RESET} (HTTP ${status_code})"
    echo -e "    ${body}" | head -3
    FAIL=$((FAIL + 1))
  fi

  return 0
}

print_header

# ── Test 1: Basic Connectivity (no auth) ──
test_endpoint "Ping" "${BASE_URL}/api/server/ping" "false"

# ── Test 2: Server Version (no auth) ──
test_endpoint "Version" "${BASE_URL}/api/server/version" "false"

# ── Test 3: Server About (authenticated) ──
test_endpoint "About" "${BASE_URL}/api/server/about" "true"

# ── Test 4: List Albums (authenticated) ──
test_endpoint "Albums" "${BASE_URL}/api/albums" "true"

# ── Summary ──
echo ""
echo -e "${BOLD}───────────────────────────────────────────────${RESET}"
echo -e "  ${GREEN}Passed: ${PASS}${RESET}  |  ${RED}Failed: ${FAIL}${RESET}"
echo -e "${BOLD}───────────────────────────────────────────────${RESET}"
echo ""

if [ "$FAIL" -gt 0 ]; then
  echo -e "${YELLOW}Tips:${RESET}"
  echo "  • Ensure the Immich server is running at ${BASE_URL}"
  echo "  • Generate an API key: Immich Web UI → User Settings → API Keys"
  echo "  • Re-run with: bash scripts/test-immich-connection.sh ${BASE_URL} YOUR_API_KEY"
  exit 1
fi

exit 0
