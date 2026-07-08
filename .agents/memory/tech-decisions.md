---
type: project
created: 2026-07-06
updated: 2026-07-06
---

# Tech Decisions & Scalability

## Supabase & Vercel Free Tier (200+ users)
- **Supabase Realtime:** Free tier is strictly limited to 200 concurrent connections. The `useBoardPosts` hook uses a 30s `refetchInterval` fallback to prevent freezing if connections are dropped.
- **Vercel Image Caching:** The `/api/immich` serverless functions use `s-maxage=86400` caching and `supportsResponseStreaming: true`. This successfully bypasses Vercel's 4.5MB payload limit and protects the backend Immich server by serving images from the Edge CDN.
- **VibeCheck Gamification:** All core logic (strikes, lockouts, mission progression, house_position matching) runs securely in the `swipe_card_secure_v2` PostgreSQL RPC, fully preventing client-side cheating.
- **DOM Virtualization:** `react-virtuoso` is strictly required and implemented on `GalleryPage` and `FaceClaimPage` to handle thousands of image thumbnails smoothly without crashing mobile browsers.
- **Database Schema Migrations**: Always execute a retroactive data-backfill migration (`execute_sql`) for legacy users when adding progressive queue schemas (e.g., `mission_queue = COALESCE(..., '{}')`) to prevent `NULL` references in PL/pgSQL array indexing.
