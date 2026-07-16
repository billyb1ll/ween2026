# Baan 7 Orientation Portal

A modern, high-performance orientation portal built for Baan 7. This repository serves as the primary hub for freshmen onboarding, live hypes, and the gallery.

## 🏗 Architecture & Stack
This project operates on a split architecture optimized for the **Vercel Hobby Plan** and the **Supabase Free Tier**:

- **Frontend:** React + Vite, styled with custom Flexbox-driven layouts. The frontend communicates directly with Supabase via `@supabase/supabase-js` for real-time live chats, user authentication, and profile updates.
- **Backend (Database):** Supabase PostgreSQL. (The legacy SQLite `dev.db` has been permanently purged due to Vercel's read-only serverless filesystem constraints).
- **Backend (API / Serverless):** Vercel Serverless Functions (`/api/*`). These endpoints act as secure proxies for the self-hosted Immich server, bypassing CORS limitations and securely injecting the `IMMICH_API_KEY`.
- **Media Optimization:** Immich asset streams (both original size and thumbnails) are piped directly through `node-fetch` raw web streams to bypass Vercel's 4.5MB serverless payload limit. We utilized `react-photo-album` and GSAP for responsive masonry grids to render thousands of dynamic photos smoothly.

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

- **Supabase Database:**
  - `DATABASE_URL`: Your Supabase connection string.
  - `DIRECT_URL`: Set to the Session Pooler (Port `5432`) used strictly for migrations.

- **Immich Gallery Integration:**
  - `VITE_IMMICH_SERVER_URL`: Public-facing Immich endpoint (e.g., `https://gallery.baan7.university.edu`).
  - `VITE_IMMICH_API_KEY` & `IMMICH_API_KEY`: API keys for authenticating serverless proxy requests.
  - `VITE_IMMICH_ALBUM_ID`: The UUID of the primary orientation album.

## 💻 Local Development Workflow

Run the application stack locally to test features and UI changes.

1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Start the Local Stack:**
   ```bash
   npm run dev
   ```

## 🚢 Production Deployment Workflow

1. **Verify Build & Types:**
   ```bash
   npm run typecheck
   npm run build
   ```

2. **Deploy to Vercel:**
   Push to your `main` branch or use the Vercel CLI:
   ```bash
   vercel --prod
   ```

## 🧹 Housekeeping
- Do **not** commit `.env` or `.env*.local` to version control.
