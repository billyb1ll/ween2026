import { Readable } from 'node:stream'
import { createClient } from '@supabase/supabase-js'

export const config = {
  supportsResponseStreaming: true,
};

export default async function handler(req, res) {
  const { id } = req.query
  const rawUrl = process.env.VITE_IMMICH_SERVER_URL || '';
  const IMMICH_SERVER_URL = rawUrl.replace(/\/api\/?$/, '').replace(/\/+$/, '');
  const IMMICH_VIEWER_API_KEY = process.env.IMMICH_VIEWER_API_KEY || process.env.IMMICH_API_KEY
  const SUPABASE_URL = process.env.VITE_SUPABASE_URL
  const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY

  if (req.method === 'GET') {
    // Auth is NOT enforced here to allow public 'Who is this?' sections
    // Face thumbnails (small crops) are considered safe for public display to encourage login.

    try {
      // 2. Proxy the Image Bytes
      const response = await fetch(`${IMMICH_SERVER_URL}/api/people/${id}/thumbnail`, {
        headers: { 'x-api-key': IMMICH_VIEWER_API_KEY }
      })
      
      if (!response.ok) {
        return res.status(404).send(Buffer.from(''))
      }
      
      res.setHeader('Content-Type', response.headers.get('content-type') || 'image/jpeg')
      res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=43200')
      
      Readable.fromWeb(response.body).pipe(res)
      return
    } catch (error) {
      console.error('Proxy people thumbnail error:', error.message)
      return res.status(404).send(Buffer.from(''))
    }
  }

  res.setHeader('Allow', ['GET'])
  res.status(405).end(`Method ${req.method} Not Allowed`)
}
