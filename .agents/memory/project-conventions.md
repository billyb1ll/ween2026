---
type: project
created: 2026-05-25
updated: 2026-06-12
---

# Project Conventions

## Git Workflow

- Always create a new dedicated branch for major code changes.
- Branch name format should follow: `feature/[task-slug]` or `fix/[bug-slug]`.

## UI Performance & Interactivity

- **List Item Memoization:** Wrap list item card components (like `HypeCard` and `MemoryCard` in `BoardPage.tsx`) in `React.memo()` to prevent parent updates from triggering card re-renders. Ensure callback props are stabilized using `useCallback`.
- **Database Query Bounding:** Apply pagination or limit constraints (e.g., `.limit(50)`) on Supabase feed queries to keep initial network payloads lightweight.
- **Chrome Framer Motion Dragging:** To prevent default Chrome text selection or image dragging from hijacking Framer Motion gestures, configure:
  - `draggable={false}` on inner `<Image />` tags.
  - `userSelect: "none"` and `WebkitUserSelect: "none"` on the `<motion.div>` drag container.
  - `pointerEvents="none"` on child card elements (overlays, text wraps, tags) to avoid gesture capture.

## Design Conventions

- **Role-based Styling:** Staff roles (e.g. "P'") use pink styling, while student roles use navy blue in Live Chat and the Memory Board.

## Business Logic Conventions

- **Profile Onboarding Flow:** After accepting the Terms of Use, users must remain on the profile completion step (`/setup`). The system must not redirect them elsewhere until their profile configuration is fully saved.
