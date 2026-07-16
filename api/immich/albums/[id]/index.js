import { createClient } from '@supabase/supabase-js'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function handler(req, res) {
  const { id } = req.query
  // Strip trailing /api or / from the base URL to prevent /api/api double-prefixing
  const rawUrl = process.env.VITE_IMMICH_SERVER_URL || '';
  const IMMICH_SERVER_URL = rawUrl.replace(/\/api\/?$/, '').replace(/\/+$/, '');
  // Use the dedicated viewer key if available, otherwise fallback to master key
  const IMMICH_API_KEY = process.env.IMMICH_VIEWER_API_KEY || process.env.IMMICH_API_KEY
  const SUPABASE_URL = process.env.VITE_SUPABASE_URL
  const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY

  if (req.method === 'GET') {
    if (!UUID_REGEX.test(id)) {
      return res.status(400).json({ error: 'Invalid identifier format' })
    }



    try {
      const response = await fetch(`${IMMICH_SERVER_URL}/api/albums/${id}`, {
        headers: { 'x-api-key': IMMICH_API_KEY, 'Content-Type': 'application/json' }
      })
      if (!response.ok) {
        console.warn(`Immich album fetch returned ${response.status}`)
        return res.status(response.status).json({ error: 'Album fetch failed' })
      }
      return res.status(200).json(await response.json())
    } catch (error) {
      console.error('Proxy album by ID error:', error)
      return res.status(500).json({ error: 'Internal Server Error' })
    }
  }

  res.setHeader('Allow', ['GET'])
  res.status(405).end(`Method ${req.method} Not Allowed`)
}
