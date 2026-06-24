# Gallery Overhaul & Face Management Plan

This plan outlines the architecture and execution steps for integrating high-scale gallery viewing, admin upload, and a face-claiming workflow using the local Immich server.

## 🔴 User Review Required

1. **Security Architecture for API Gate:** Currently, `/api/immich/...` proxy routes blindly inject the Immich API key. To properly enforce `isAdmin` or `isAuthenticated`, we must validate the Supabase JWT token inside the Vercel Serverless functions (e.g., `api/immich/people/[id]/index.js`) before forwarding the request to Immich. Is this the intended security approach?
2. **Face Claiming UX:** When an unclaimed face is claimed, should the user see an immediate "Success" modal, or just a toast while they are redirected back to the main gallery?

---

## 🛠 Task Breakdown & Agent Assignments

### Task 1: Performance & Viewing Overhaul
*Assigned to: `frontend-specialist`*
- Install `yet-another-react-lightbox`.
- Refactor `GalleryPage.tsx` to use `react-virtuoso` for rendering the `activeAssets` grid (to support 1000+ items without DOM lag).
- Replace Chakra UI Dialog with YARL Lightbox.
- Configure YARL plugins: Zoom, Fullscreen, Slideshow, Download (using `immich.assets.originalUrl(id)`).
- Ensure body overflow styles are cleaned up on unmount to fix the web freeze bug.

### Task 2: Album & Media Management
*Assigned to: `frontend-specialist`*
- Create `src/config/album-mapping.ts` to map UI keys (`day1`) to Immich album IDs/names.
- Create `src/components/admin/MediaUploader.tsx`.
- Implement drag-and-drop upload leveraging `immichService.assets.upload()` and `immichService.albums.addAssets()`.

### Task 3: Intelligent Face Claiming System
*Assigned to: `frontend-specialist` & `backend-specialist`*
- Create `src/pages/FaceClaimPage.tsx` for the dedicated `/face-claim` route.
- Implement multi-select logic for claiming multiple faces at once.
- Update `immichService` and proxy endpoints to support bulk people updates (if needed) or fire concurrent promises.
- Add "My Photos" tab in the User Profile leveraging `immichService.assets.searchMetadata({ personIds: [...] })`.
- Add "Unclaim" logic to reset the face name in Immich.
- Filter the main feed to hide faces that have already been mapped to known Supabase users.

### Task 4: UI/UX & Security
*Assigned to: `frontend-specialist` & `backend-specialist`*
- Add persistent Chakra UI `Alert` banner for Beta testing warning.
- Implement JWT Auth checking in Vercel Edge functions (`api/immich/people/[id]/index.js`, etc.) to secure write actions (`PUT`, `POST`).

---

## ✅ Verification Checklist

- [ ] Lightbox opens, zooms, and downloads original image correctly.
- [ ] Gallery grid scrolling is smooth with 1000+ items (Virtuoso active).
- [ ] Admin can upload an image and it appears in the specific Immich album.
- [ ] Unauthenticated users are rejected with `401 Unauthorized` when hitting the `PUT /api/immich/people/:id` proxy.
- [ ] Claiming a face updates Immich and the User Profile successfully.
- [ ] `npm run typecheck` passes with no errors.
