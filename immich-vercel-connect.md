# Immich Vercel Connection Plan

## Overview
Connect the production Immich server to the Vercel project by configuring the correct environment variables for the frontend to access the gallery API.

## Project Type
WEB

## Success Criteria
- Vercel production environment contains the `VITE_IMMICH_SERVER_URL` variable.
- Vercel production environment contains the `IMMICH_API_KEY` variable.

## Tech Stack
- Vercel CLI (for environment variable management)

## File Structure
- No new files needed. Modifying Vercel project settings via CLI.

## Task Breakdown

### 1. Configure Server URL
- **Agent:** devops-engineer
- **Skills:** server-management
- **Priority:** P0
- **Dependencies:** None
- **INPUT:** `https://immich.b1lly.tech/photos`
- **OUTPUT:** `VITE_IMMICH_SERVER_URL` env variable set in Vercel for production.
- **VERIFY:** `vercel env ls` shows `VITE_IMMICH_SERVER_URL`

### 2. Configure API Key
- **Agent:** security-auditor
- **Skills:** server-management
- **Priority:** P0
- **Dependencies:** None
- **INPUT:** `o7dmxs9NhihnLN5D4tXcW7P19UQeWJleDd9VYkJu0`
- **OUTPUT:** `IMMICH_API_KEY` env variable set in Vercel for production.
- **VERIFY:** `vercel env ls` shows `IMMICH_API_KEY`

### 3. Configure Viewer API Key
- **Agent:** security-auditor
- **Skills:** server-management
- **Priority:** P1
- **Dependencies:** None
- **INPUT:** `o7dmxs9NhihnLN5D4tXcW7P19UQeWJleDd9VYkJu0` (assuming same key for both, can ask for clarification)
- **OUTPUT:** `IMMICH_VIEWER_API_KEY` env variable set in Vercel for production.
- **VERIFY:** `vercel env ls` shows `IMMICH_VIEWER_API_KEY`

## Phase X: Verification
- [ ] Run `vercel env ls` to confirm variables are set.
- [ ] Deploy a new build to Vercel so the environment variables take effect.
