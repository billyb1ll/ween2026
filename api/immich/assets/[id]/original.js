import { Readable } from 'node:stream'

export const config = {
  supportsResponseStreaming: true,
};

export default async function handler(req, res) {
  const { id } = req.query
  const IMMICH_SERVER_URL = process.env.VITE_IMMICH_SERVER_URL
  const IMMICH_API_KEY = process.env.IMMICH_API_KEY

  if (req.method === 'GET') {
    try {
      const response = await fetch(`${IMMICH_SERVER_URL}/api/assets/${id}/original`, {
        headers: { 'x-api-key': IMMICH_API_KEY }
      })
      
      if (!response.ok) {
        return res.status(404).send(Buffer.from(''))
      }
      
      res.setHeader('Content-Type', response.headers.get('content-type') || 'application/octet-stream')
      res.setHeader('Cache-Control', 'public, s-maxage=31536000, immutable')
      
      const cd = response.headers.get('content-disposition')
      if (cd) {
        res.setHeader('Content-Disposition', cd)
      } else {
        res.setHeader('Content-Disposition', `attachment; filename="immich-asset-${id}.jpg"`)
      }
      
      Readable.fromWeb(response.body).pipe(res)
      return
    } catch (error) {
      console.error('Proxy assets original error:', error.message)
      // Return 404 empty buffer instead of hanging/crashing
      return res.status(404).send(Buffer.from(''))
    }
  }

  res.setHeader('Allow', ['GET'])
  res.status(405).end(`Method ${req.method} Not Allowed`)
}
