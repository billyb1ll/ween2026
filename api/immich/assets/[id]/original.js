import { createClient } from '@supabase/supabase-js'

// Matches standard UUID v4 format. Rejects any path traversal or injection attempt.
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function handler(req, res) {
  const { id } = req.query
  const rawUrl = process.env.VITE_IMMICH_SERVER_URL || '';
  const IMMICH_SERVER_URL = rawUrl.replace(/\/api\/?$/, '').replace(/\/+$/, '');
  const IMMICH_VIEWER_API_KEY = process.env.IMMICH_VIEWER_API_KEY || process.env.IMMICH_API_KEY;
  const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

  if (req.method === 'GET') {
    if (!UUID_REGEX.test(id)) {
      return res.status(400).json({ error: 'Invalid identifier format' })
    }



    // Bypass Vercel byte streaming for full-resolution images via 302 redirect.
    // Note: Immich uses `apiKey` query parameter for auth, not `key`.
    const directUrl = `${IMMICH_SERVER_URL}/api/assets/${id}/original?apiKey=${IMMICH_VIEWER_API_KEY}`;
    
    // Explicitly do not cache this redirect so that session revocation is immediate
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    return res.redirect(302, directUrl);
  }

  res.setHeader('Allow', ['GET'])
  res.status(405).end(`Method ${req.method} Not Allowed`)
}
