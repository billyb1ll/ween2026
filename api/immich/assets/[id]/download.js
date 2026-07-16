import { Readable } from 'node:stream'
import { createClient } from '@supabase/supabase-js'

export const config = {
  supportsResponseStreaming: true,
};

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



    try {
      const response = await fetch(`${IMMICH_SERVER_URL}/api/assets/${id}/original`, {
        headers: { 'x-api-key': IMMICH_VIEWER_API_KEY }
      })
      
      if (!response.ok) {
        return res.status(404).send(Buffer.from(''))
      }
      
      res.setHeader('Content-Type', response.headers.get('content-type') || 'application/octet-stream')
      res.setHeader('Cache-Control', 'public, s-maxage=31536000, immutable')
      
      // Force the browser to download the file instead of displaying it inline
      res.setHeader('Content-Disposition', `attachment; filename="immich-asset-${id}.jpg"`)
      
      Readable.fromWeb(response.body).pipe(res)
      return
    } catch (error) {
      console.error('Proxy assets download error:', error.message)
      return res.status(404).send(Buffer.from(''))
    }
  }

  res.setHeader('Allow', ['GET'])
  res.status(405).end(`Method ${req.method} Not Allowed`)
}
