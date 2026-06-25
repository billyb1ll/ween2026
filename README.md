# Baan 7 Orientation Portal

A modern, high-performance orientation portal built for Baan 7. This repository serves as the primary hub for freshmen onboarding, live hypes, and the gallery.

## 🏗 Architecture & Stack
This project operates on a split architecture optimized for the **Vercel Hobby Plan** and the **Supabase Free Tier**:

- **Frontend:** React + Vite, styled with custom Flexbox-driven layouts. The frontend communicates directly with Supabase via `@supabase/supabase-js` for real-time live chats, user authentication, and profile updates.
- **Backend (Database):** Supabase PostgreSQL. (The legacy SQLite `dev.db` has been permanently purged due to Vercel's read-only serverless filesystem constraints).
- **Backend (API / Serverless):** Vercel Serverless Functions (`/api/*`). These endpoints act as secure proxies for the self-hosted Immich server, bypassing CORS limitations and securely injecting the `IMMICH_API_KEY`.
- **Media Optimization:** Immich asset streams (both original size and thumbnails) are piped directly through `node-fetch` raw web streams to bypass Vercel's 4.5MB serverless payload limit. We utilized `react-photo-album` for responsive masonry grids to render thousands of dynamic photos smoothly.

## 🚀 Environment Prerequisites

To run this project locally or deploy it, you must configure your environment variables. Copy `.env.example` to `.env.local` and `.env`:

```bash
cp .env.example .env.local
cp .env.example .env
```

**Required Variables:**
- **Supabase Authentication:**
  - `VITE_SUPABASE_URL`: Your Supabase project URL (`https://[PROJECT-REF].supabase.co`).
  - `VITE_SUPABASE_ANON_KEY`: Your Supabase anonymous public API key.

- **Supabase Database (Prisma):**
  > **⚠️ CRITICAL: IPv4 Pooler Required**  
  > Due to Supabase migrating their native direct connections to IPv6, Vercel/Node environments will fail with a `P1001` timeout if you use the standard direct string. You **must** retrieve the IPv4 Pooler URL from your dashboard (`aws-0-[REGION].pooler.supabase.com`).
  - `DATABASE_URL`: Set to the Transaction Pooler (Port `6543`) with `?pgbouncer=true`.
  - `DIRECT_URL`: Set to the Session Pooler (Port `5432`) used strictly for migrations.

- **Immich Gallery Integration:**
  - `VITE_IMMICH_SERVER_URL`: Public-facing Immich endpoint (e.g., `https://gallery.baan7.university.edu`).
  - `VITE_IMMICH_API_KEY` & `IMMICH_API_KEY`: API keys for authenticating serverless proxy requests.
  - `VITE_IMMICH_ALBUM_ID`: The UUID of the primary orientation album.

## 💻 Local Development Workflow

Run the application stack locally to test features and UI changes. The local workflow spins up both the Vite frontend server and a local Express API server (`server/index.js`) to perfectly simulate Vercel's serverless endpoints.

1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Start the Local Stack:**
   ```bash
   npm run dev:all
   ```
   *This command leverages `concurrently` to launch the Vite dev server on port `5173` and the Express proxy on port `5001`.*

## 🚢 Production Deployment Workflow

Before pushing code to Vercel, always ensure your Prisma Client is correctly synchronized with your active Supabase database schema.

1. **Sync Database Schema (If modified externally):**
   ```bash
   npx prisma db pull
   ```
   *This will introspect your live Supabase database and update `prisma/schema.prisma` without dropping existing data.*

2. **Generate Prisma Client Types:**
   ```bash
   npx prisma generate
   ```

3. **Verify Build & Types:**
   ```bash
   npm run typecheck
   npm run build
   ```

4. **Deploy to Vercel:**
   Push to your `main` branch or use the Vercel CLI:
   ```bash
   vercel --prod
   ```

## 🧹 Housekeeping
- Do **not** commit `.env` or `.env*.local` to version control.
- Any new backend proxies should be duplicated in both `server/index.js` (for local development) and `api/` (for Vercel serverless execution).
