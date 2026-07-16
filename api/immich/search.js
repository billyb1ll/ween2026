import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  // Strip trailing /api or / from the base URL to prevent /api/api double-prefixing
  const rawUrl = process.env.VITE_IMMICH_SERVER_URL || '';
  const IMMICH_SERVER_URL = rawUrl.replace(/\/api\/?$/, '').replace(/\/+$/, '');
  // Use the dedicated viewer key if available, otherwise fallback to master key
  const IMMICH_API_KEY = process.env.IMMICH_VIEWER_API_KEY || process.env.IMMICH_API_KEY;
  const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

  if (req.method === 'POST') {


    // Resilient body parsing for Vercel serverless
    let parsedBody = req.body;
    if (!parsedBody || typeof parsedBody !== 'object') {
      try {
        let rawBody = '';
        for await (const chunk of req) {
          rawBody += chunk;
        }
        parsedBody = rawBody ? JSON.parse(rawBody) : {};
      } catch {
        parsedBody = {};
      }
    }

    // 2. Proxy request
    try {
      const response = await fetch(`${IMMICH_SERVER_URL}/api/search/smart`, {
        method: 'POST',
        headers: {
          'x-api-key': IMMICH_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(parsedBody),
      });

      if (!response.ok) {
        console.warn(`Immich search proxy returned ${response.status}`);
        return res.status(response.status).json({ error: 'Search failed' });
      }

      const data = await response.json();
      return res.status(200).json(data);
    } catch (error) {
      console.error('Proxy search error:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  res.setHeader('Allow', ['POST'])
  res.status(405).end(`Method ${req.method} Not Allowed`)
}
