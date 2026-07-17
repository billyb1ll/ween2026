# Immich Vercel and Admin Update Plan

## Overview
Update the Immich server URL configuration and remove the hardcoded stats in the Admin AV tab by dynamically fetching data from Immich. Also, address the unauthorized error from `admin_update_system_config`.

## Project Type
WEB

## Success Criteria
- `VITE_IMMICH_SERVER_URL` is updated to `https://immich.b1lly.tech` on Vercel and locally.
- Admin AV tab displays real stats fetched from Immich instead of hardcoded numbers.
- Provide a solution for the `admin_update_system_config` unauthorized error.

## Tech Stack
- Vercel CLI (for env variables)
- Vercel Serverless Functions (for proxying Immich API)
- React (for UI updates)

## File Structure
- `api/immich/stats.js` (NEW) - Proxy endpoint for Immich stats
- `src/pages/AdminDashboardPage.tsx` - Update to fetch real stats

## Task Breakdown

### 1. Update Server URL
- **Agent:** devops-engineer
- **Skills:** server-management
- **Priority:** P0
- **INPUT:** `https://immich.b1lly.tech`
- **OUTPUT:** Updated `VITE_IMMICH_SERVER_URL` in Vercel production and local `.env` files.
- **VERIFY:** `vercel env ls` shows new URL.

### 2. Create Stats Proxy Endpoint
- **Agent:** backend-specialist
- **Skills:** api-patterns
- **Priority:** P0
- **INPUT:** Immich `/api/server/statistics` and `/api/server/ping`
- **OUTPUT:** `api/immich/stats.js` that returns combined stats securely.
- **VERIFY:** Endpoint returns `ping`, `totalImages`, and `diskUsed`.

### 3. Update Admin AV Tab UI
- **Agent:** frontend-specialist
- **Skills:** frontend-design, impeccable
- **Priority:** P0
- **INPUT:** `api/immich/stats.js` endpoint
- **OUTPUT:** `AdminDashboardPage.tsx` modified to fetch and display real data, with a polished loading state following Impeccable guidelines.
- **VERIFY:** Admin dashboard shows real stats without hardcoded values.

### 4. Diagnose RPC Error
- **Agent:** security-auditor
- **Skills:** database-design
- **Priority:** P1
- **INPUT:** `admin_update_system_config` RPC failure log
- **OUTPUT:** Analysis and fix or instructions for the `Unauthorized: Insufficient role` error.
- **VERIFY:** User is able to save system configs successfully.

## Phase X: Verification
- [ ] Ensure Vercel deployment succeeds with the new function.
- [ ] Check `AdminDashboardPage.tsx` renders correctly with stats.
- [ ] `admin_update_system_config` works properly.
