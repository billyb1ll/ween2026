# Architecture Upgrade Plan - Realtime Boards & Onboarding

## Overview
This plan outlines the architecture upgrade of the Baan 7 Orientation Portal into a production-grade system. We will eliminate all mock data, adopt a strict mobile-first design, secure database operations using Supabase RLS and RPC triggers, and add CSV onboarding, staff moderation, and profile management systems.

- **Project Type**: WEB (React + TypeScript + Vite + Chakra UI v3 + Supabase)

---

## User Review Required
> [!IMPORTANT]
> **RLS & Custom Auth Warning:** Since the application uses a custom PIN-based authentication system querying Supabase directly via the `anon` key (instead of standard Supabase Auth), enabling Row Level Security (RLS) without specialized mechanisms would block client-side updates/deletions. To remediate this securely, we will implement custom database RPC functions running as `SECURITY DEFINER`. These functions will verify the user's `student_id` and `pin_hash` context directly in PostgreSQL before performing modifications, ensuring strict server-side validation.

---

## Success Criteria
1. **Zero Mock Data:** All boards, comments, and profile setups fetch live state asynchronously from Supabase.
2. **Strict Mobile-First UX:** Minimum 44px touch targets for all buttons, inputs, and interactive components.
3. **Advanced Profile System:** Functional color picking, file upload to Supabase Storage, and `/profile-edit` redirects.
4. **Secure Whitelisting & Moderation:** Papaparse CSV validation, duplicate cross-checks, and direct delete capabilities for comments and posts.
5. **Staff Access Bypass:** Staff bypass master toggles to view the Memory Board even when it is closed.

---

## Tech Stack
- **Frontend:** React 19, TypeScript, Chakra UI v3, Vite
- **Database:** Supabase PostgreSQL (Tables: `users`, `posts`, `post_comments`, `system_config`)
- **Storage:** Supabase Storage (Bucket: `profiles` for avatars and photo pools)
- **CSV Parsing:** `papaparse` (parsed on client-side)

---

## Proposed Database Schema (Supabase SQL)
```sql
-- 1. Alter posts.tags to be a text array (preserving data)
ALTER TABLE posts ALTER COLUMN tags TYPE text[] USING 
  CASE 
    WHEN tags IS NULL OR tags = '' THEN '{}'::text[] 
    ELSE ARRAY[tags]::text[] 
  END;
ALTER TABLE posts ALTER COLUMN tags SET DEFAULT '{}'::text[];

-- 2. Create post_comments table
CREATE TABLE IF NOT EXISTS post_comments (
    id BIGSERIAL PRIMARY KEY,
    post_id BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    student_id VARCHAR NOT NULL REFERENCES users(student_id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Update users table columns
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_pic_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_pool TEXT[] DEFAULT '{}'::text[];

-- Migrate existing images to photo_pool if empty
UPDATE users SET photo_pool = images WHERE photo_pool = '{}'::text[] OR photo_pool IS NULL;

-- 4. Enable RLS on tables
ALTER TABLE post_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies
-- Allow public select on all tables
CREATE POLICY "Allow all select" ON users FOR SELECT USING (true);
CREATE POLICY "Allow all select" ON posts FOR SELECT USING (true);
CREATE POLICY "Allow all select" ON post_comments FOR SELECT USING (true);
CREATE POLICY "Allow all select" ON system_config FOR SELECT USING (true);

-- Allow public insert/update (since using custom auth client)
CREATE POLICY "Allow insert/update users" ON users FOR ALL USING (true);
CREATE POLICY "Allow insert posts" ON posts FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow insert comments" ON post_comments FOR INSERT WITH CHECK (true);

-- 6. Secure Deletion Triggers (SECURITY DEFINER RPC functions)
CREATE OR REPLACE FUNCTION delete_post_secure(p_post_id bigint, p_student_id varchar, p_pin_hash varchar)
RETURNS boolean AS $$
DECLARE
    v_role varchar;
    v_post_author varchar;
BEGIN
    SELECT role INTO v_role FROM users WHERE student_id = p_student_id AND pin_hash = p_pin_hash;
    IF v_role IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Invalid student ID or PIN';
    END IF;
    SELECT student_id INTO v_post_author FROM posts WHERE id = p_post_id;
    IF v_post_author = p_student_id OR v_role IN ('superadmin', 'media_admin', 'staff') THEN
        DELETE FROM posts WHERE id = p_post_id;
        RETURN true;
    ELSE
        RAISE EXCEPTION 'Unauthorized to delete this post';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION delete_comment_secure(p_comment_id bigint, p_student_id varchar, p_pin_hash varchar)
RETURNS boolean AS $$
DECLARE
    v_role varchar;
    v_comment_author varchar;
BEGIN
    SELECT role INTO v_role FROM users WHERE student_id = p_student_id AND pin_hash = p_pin_hash;
    IF v_role IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Invalid student ID or PIN';
    END IF;
    SELECT student_id INTO v_comment_author FROM post_comments WHERE id = p_comment_id;
    IF v_comment_author = p_student_id OR v_role IN ('superadmin', 'media_admin', 'staff') THEN
        DELETE FROM post_comments WHERE id = p_comment_id;
        RETURN true;
    ELSE
        RAISE EXCEPTION 'Unauthorized to delete this comment';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Setup storage bucket for profiles
INSERT INTO storage.buckets (id, name, public) 
VALUES ('profiles', 'profiles', true) 
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Allow public read profiles bucket" ON storage.objects FOR SELECT USING (bucket_id = 'profiles');
CREATE POLICY "Allow public upload profiles bucket" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'profiles');
```

---

## File Structure & Directory Layout
```plaintext
src/
├── App.tsx                     # Add routing for /profile-edit and /staff
├── components/
│   └── Navbar.tsx              # Add /profile-edit and /staff navigation
├── context/
│   └── UserContext.tsx         # Update User interface and updateProfile args
├── hooks/
│   └── useBoardRealtime.ts     # Update posts.tags array mapping and authors.role fetching
├── pages/
│   ├── AdminDashboardPage.tsx  # Superadmin CSV onboarding modal workflow with papaparse
│   ├── StaffDashboardPage.tsx  # [NEW] Staff Moderation Command Suite + VibeCheck profile card
│   └── ProfileEditPage.tsx     # [NEW] Dynamic profile edit path, circular colors, image upload
```

---

## Task Breakdown

### Phase 1: Database & Foundation
#### Task 1.1: Run Database Schema Migrations
- **Agent**: `database-architect`
- **Skill**: `database-design`
- **Priority**: High
- **Dependencies**: None
- **INPUT**: Proposed SQL script
- **OUTPUT**: Supabase tables `post_comments` created, `posts`/`users` columns modified, RPC functions defined, storage bucket and RLS policies active
- **VERIFY**: Query database schema using `execute_sql` to confirm tags column type is `text[]`, tables exist, and RLS policies are active.

#### Task 1.2: Install Frontend Dependencies
- **Agent**: `frontend-specialist`
- **Skill**: `clean-code`
- **Priority**: High
- **Dependencies**: None
- **INPUT**: `package.json`
- **OUTPUT**: `papaparse` and `@types/papaparse` installed as dependencies
- **VERIFY**: Run `npm run build` or check `package.json` to verify dependencies.

#### Task 1.3: Update User Context and real-time board hooks
- **Agent**: `backend-specialist`
- **Skill**: `api-patterns`
- **Priority**: High
- **Dependencies**: Task 1.1
- **INPUT**: `src/context/UserContext.tsx`, `src/hooks/useBoardRealtime.ts`
- **OUTPUT**: Modified codebase supporting `bio`, `profile_pic_url`, `photo_pool`, and `posts.tags` as string array
- **VERIFY**: Types compiled successfully with `npm run typecheck`.

---

### Phase 2: Board Integrations (Hype & Memory)
#### Task 2.1: Implement Post Composer tag requirement in BoardPage
- **Agent**: `frontend-specialist`
- **Skill**: `frontend-design`
- **Priority**: Medium
- **Dependencies**: Task 1.3
- **INPUT**: `src/pages/BoardPage.tsx`
- **OUTPUT**: Composer requiring tag pills selected from predefined list before enabling Post button
- **VERIFY**: Run development server, check component rendering.

#### Task 2.2: Add Comments and staff prefixing to BoardPage
- **Agent**: `frontend-specialist`
- **Skill**: `frontend-design`
- **Priority**: High
- **Dependencies**: Task 1.3
- **INPUT**: `src/pages/BoardPage.tsx`
- **OUTPUT**: Comments rendering in each post card with delete buttons, staff prefixes prepended, Active Baans removed
- **VERIFY**: Inspect post cards on desktop and mobile viewports.

---

### Phase 3: Profile Management
#### Task 3.1: Build Profile Edit Page with storage upload
- **Agent**: `frontend-specialist`
- **Skill**: `frontend-design`
- **Priority**: High
- **Dependencies**: Task 1.3
- **INPUT**: `src/pages/ProfileEditPage.tsx` [NEW]
- **OUTPUT**: Form with circular color pickers, file/URL upload, redirection checks, and navbar edits
- **VERIFY**: Load `/profile-edit` route, verify inputs and upload operations.

---

### Phase 4: Onboarding & Moderation Dashboards
#### Task 4.1: Superadmin CSV Onboarding
- **Agent**: `frontend-specialist`
- **Skill**: `frontend-design`
- **Priority**: Medium
- **Dependencies**: Task 1.2
- **INPUT**: `src/pages/AdminDashboardPage.tsx`
- **OUTPUT**: Upload CSV modal workflow parsing with duplicate checks and batch upsert
- **VERIFY**: Upload sample whitelisted data and verify live previews.

#### Task 4.2: Staff Moderation Panel & Vibecheck Setups
- **Agent**: `frontend-specialist`
- **Skill**: `frontend-design`
- **Priority**: High
- **Dependencies**: Task 1.1, Task 1.3
- **INPUT**: `src/pages/StaffDashboardPage.tsx` [NEW]
- **OUTPUT**: Live Moderation table with post/comment deletion, Vibecheck profile setup limits to exactly 3 photos
- **VERIFY**: Deleting comments/posts performs Supabase RPC actions.

---

## Phase X: Verification & Compliance

### Automated Tests & Quality Scripts
We will execute the AG Kit validation suite to ensure full compliance:
```bash
# P0: Lint & Type check
npm run lint && npm run typecheck

# P0: Security Scan
python .agents/skills/vulnerability-scanner/scripts/security_scan.py .

# P1: UX Audit
python .agents/skills/frontend-design/scripts/ux_audit.py .

# Build verification
npm run build
```

### Manual Checks
- [ ] No purple/violet color hex codes.
- [ ] Touch targets are at least 44px on mobile viewports.
- [ ] Direct database context queries (no mock data).
