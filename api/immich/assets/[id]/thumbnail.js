import { Readable } from 'node:stream'

export const config = {
  supportsResponseStreaming: true,
};

// Matches standard UUID v4 format. Rejects any path traversal or injection attempt.
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Exhaustive whitelist of valid thumbnail size values accepted by Immich.
const VALID_SIZES = ['thumbnail', 'preview'];

export default async function handler(req, res) {
  const { id, size } = req.query
  const IMMICH_SERVER_URL = process.env.VITE_IMMICH_SERVER_URL
  const IMMICH_API_KEY = process.env.IMMICH_API_KEY

  if (req.method === 'GET') {
    if (!UUID_REGEX.test(id)) {
      return res.status(400).json({ error: 'Invalid identifier format' })
    }

    const imgSize = VALID_SIZES.includes(size) ? size : 'thumbnail'

    try {
      const response = await fetch(`${IMMICH_SERVER_URL}/api/assets/${id}/thumbnail?size=${imgSize}`, {
        headers: { 'x-api-key': IMMICH_API_KEY }
      })
      
      if (!response.ok) {
        return res.status(404).send(Buffer.from(''))
      }
      
      res.setHeader('Content-Type', response.headers.get('content-type') || 'image/jpeg')
      res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=43200')
      
      Readable.fromWeb(response.body).pipe(res)
      return
    } catch (error) {
      console.error('Proxy assets thumbnail error:', error.message)
      return res.status(404).send(Buffer.from(''))
    }
  }

  res.setHeader('Allow', ['GET'])
  res.status(405).end(`Method ${req.method} Not Allowed`)
}

