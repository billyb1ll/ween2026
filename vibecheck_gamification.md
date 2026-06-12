# Project Plan: Vibe Check Gamification Engine

This document details the architectural layout, database migrations, and component specifications to implement the rule-based Game Engine for the Vibe Check card collection system.

---

## 1. Database Migrations (Supabase SQL)

We will create a new migration file `supabase/migrations/20260612_vibecheck_gamification.sql` to build:

### Tables
1. **`vibe_missions` table:**
   - `id` (BIGSERIAL PRIMARY KEY)
   - `sequence_order` (INTEGER UNIQUE NOT NULL)
   - `target_role` (VARCHAR NOT NULL) -- Matches user's `major` (staff position) or `role`
   - `required_count` (INTEGER NOT NULL)
   - `created_at` (TIMESTAMPTZ DEFAULT NOW())

2. **`user_vibe_status` table:**
   - `student_id` (VARCHAR PRIMARY KEY REFERENCES users(student_id) ON DELETE CASCADE)
   - `current_mission_id` (BIGINT REFERENCES vibe_missions(id) ON DELETE SET NULL)
   - `strike_count` (INTEGER DEFAULT 0)
   - `lock_count` (INTEGER DEFAULT 0) -- Tracks how many times they have been locked out to scale exponential cooldown
   - `locked_until` (TIMESTAMPTZ DEFAULT NULL)

3. **`collected_cards` table:**
   - `id` (BIGSERIAL PRIMARY KEY)
   - `student_id` (VARCHAR REFERENCES users(student_id) ON DELETE CASCADE)
   - `staff_id` (VARCHAR REFERENCES users(student_id) ON DELETE CASCADE)
   - `collected_at` (TIMESTAMPTZ DEFAULT NOW())
   - `CONSTRAINT unique_student_staff UNIQUE (student_id, staff_id)`

### System Configurations
Add game settings in `system_config` table:
- `max_allowed_strikes` (default `5`)
- `base_cooldown_minutes` (default `1`)
- `max_cooldown_minutes` (default `30`)

### Security DEFINER Function (RPC)
Create `swipe_card_secure(p_student_id VARCHAR, p_staff_id VARCHAR, p_direction VARCHAR, p_pin_hash VARCHAR)`:
1. **Authentication:** Selects `role` from `users` matching `p_student_id` and `p_pin_hash`.
2. **Lock Check:** If `locked_until > NOW()`, return lock status with duration.
3. **Active Mission:** Retrieve user's active mission from `user_vibe_status`. If not set, initialize to the first mission in `sequence_order`.
4. **Evaluation:**
   - If swipe direction is `'right'` (Collect):
     - Check target's actual role (`major` or `role`). If it matches the target role:
       - Insert into `collected_cards`.
       - Check if total collected cards of this role matches the mission target. If met, increment `current_mission_id` to next in `sequence_order`.
       - Return status: `'collected'` or `'mission_cleared'`.
     - If it does not match: increment `strike_count`.
   - If swipe direction is `'left'` (Skip):
     - If target matches the target role, it is a missed opportunity -> increment `strike_count`.
     - Else (correct skip), return status: `'skipped'`.
5. **Cooldown Enforcer:** If `strike_count >= max_allowed_strikes`:
   - Calculate cooldown time: `base_cooldown_minutes * (2 ^ lock_count)` minutes, capped at `max_cooldown_minutes`.
   - Update `locked_until = NOW() + (cooldown_minutes * INTERVAL '1 minute')`.
   - Increment `lock_count` by 1.
   - Reset `strike_count` to `0`.
   - Return status: `'locked'`.

---

## 2. Vibe Check: The Card Collection Overhaul (`VibeCheckPage.tsx`)

- **Profile Deck Query:**
  - Query random users where `role IN ('staff', 'media_admin', 'moderator')` and `student_id NOT IN (SELECT staff_id FROM collected_cards WHERE student_id = user.student_id)`.
  - **CRITICAL:** Do NOT query the target's `role` or `major` fields in the client payload. This prevents client-side inspection.
- **Active Mission Banner:**
  - Display a floating premium banner at the top showing the active mission description (e.g. *"Quest: Collect 3 recreation staff members"*).
- **Sticker Collection Album:**
  - Build a sliding bottom drawer labeled "My Collection Book".
  - Renders a CSS grid of all staff members whitelisted in the system.
  - Locked staff members render as a gray shadow-silhouette with their nickname.
  - Unlocked staff cards reveal full colors, avatar picture, and tapping them opens their details bottom-sheet.
- **Lockout Screen:**
  - If a user is locked out (`locked_until > NOW()`), display a gorgeous chocolate-tinted glassmorphic blur block over the card stack, ticking down the remaining minutes/seconds.

---

## 3. Moderator Command Center (`AdminDashboardPage.tsx`)

- **Manual Whitelist Editor:**
  - Add inline actions next to whitelist rows:
    - **Edit:** Modifies role, nickname, or faculty details.
    - **Remove:** Soft-deletes or completely evicts whitelisted records.
- **Mission Configurator:**
  - Build a sequential list editor showing all missions.
  - Display dynamic headcount (e.g., `โสต - 12 available`).
  - Create inputs to add/remove missions in the chain, adjust required counts, and modify penalty settings.
- **Realtime Audit Log Viewer:**
  - Append an administrative timeline panel showing chronological events logged to the database (e.g., *"Moderator whitelisted ID 6688219 as Staff"*).
- **Emergency Broadcast Alert:**
  - Input field to save `emergency_announcement` in `system_config`.
  - Add a globally floating flashing amber banner component at the top header of `Navbar.tsx` that binds to this real-time config value.

---

## 4. Premium Custom Toaster Polish (`src/components/ui/toaster.tsx`)

- Override standard toast alerts with a custom rendering layout.
- Styling:
  - Background: Glassmorphic translucent Warm Ivory (`rgba(252, 249, 248, 0.85)`)
  - Border: `1.5px solid var(--c-chocolate)`
  - Backdrop Blur: `12px`
  - Shadow: `var(--shadow-card)`
  - Icon color: Serene Lagoon Blue or Chocolate Accent.
  - Transition animations: Tactile slide-in/slide-out with custom keyframes.

---

## 5. Verification Plan

1. **Compilation Check:**
   - Execute `npm run typecheck` to confirm zero static typing errors in the refactored hooks and state variables.
2. **Build Test:**
   - Execute `npm run build` to verify the asset bundler compiles correctly.
3. **Game Mechanics Audit:**
   - Verify that client responses do NOT expose roles.
   - Verify incorrect swipes trigger strike counts and enforce the exponential lock timers.
