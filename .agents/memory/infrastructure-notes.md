---
type: reference
created: 2026-06-11
updated: 2026-06-11
---

# Infrastructure Notes

## Cloud Deployments
- Vercel Production URL: https://baan7-orientation-portal.vercel.app
- Connected GitHub Repository: https://github.com/billyb1ll/ween2026.git
- Vercel Project Name: `baan7-orientation-portal`

## Supabase Database Settings
- Supabase Project URL: https://gyabqyvdxdtoaqayfjho.supabase.co
- Provisioned Region: `ap-southeast-1` (Singapore)
- Project ID: `gyabqyvdxdtoaqayfjho`

## Immich Deployment (DigitalOcean)
- **Target Audience:** 200 users (150 students, 50 staff), ~1000 photos.
- **Hardware Profile:** 8GB RAM / 4 vCPUs Droplet.
- **Key Docker Resource Tuning:**
  - PostgreSQL container needs `shared_buffers=1GB` and `max_wal_size=2GB`.
  - Machine Learning container concurrency restricted to `MACHINE_LEARNING_WORKERS=2` (conserving 2 CPUs for DB/Web processes).
  - Minimum 4GB Linux Swap partition required to prevent Out-Of-Memory ML crashes.
