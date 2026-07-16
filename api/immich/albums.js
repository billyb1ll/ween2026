import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  const { name } = req.query
  const rawUrl = process.env.VITE_IMMICH_SERVER_URL || '';
  const IMMICH_SERVER_URL = rawUrl.replace(/\/api\/?$/, '').replace(/\/+$/, '');
  const IMMICH_API_KEY = process.env.IMMICH_VIEWER_API_KEY || process.env.IMMICH_API_KEY
  const SUPABASE_URL = process.env.VITE_SUPABASE_URL
  const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY

  if (req.method === 'GET') {


    try {
      const response = await fetch(`${IMMICH_SERVER_URL}/api/albums`, { 
        headers: { 'x-api-key': IMMICH_API_KEY, 'Content-Type': 'application/json' } 
      })
      if (!response.ok) {
        console.warn(`Immich albums returned ${response.status}`)
        return res.status(200).json([])
      }
      const albums = await response.json()
      
      if (name) {
        // Filter by explicit name if provided
        const filtered = albums.filter(a => a.albumName?.toLowerCase() === name.toLowerCase())
        return res.status(200).json(filtered)
      }

      return res.status(200).json(albums)
    } catch (error) {
      console.error('Proxy albums error:', error)
      return res.status(200).json([])
    }
  }
  
  res.setHeader('Allow', ['GET'])
  res.status(405).end(`Method ${req.method} Not Allowed`)
}
