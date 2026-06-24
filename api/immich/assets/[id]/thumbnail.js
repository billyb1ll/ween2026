export default async function handler(req, res) {
  const { id, size } = req.query
  const IMMICH_SERVER_URL = process.env.VITE_IMMICH_SERVER_URL
  const IMMICH_API_KEY = process.env.IMMICH_API_KEY

  if (req.method === 'GET') {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)
    try {
      const imgSize = size || 'thumbnail'
      const response = await fetch(`${IMMICH_SERVER_URL}/api/assets/${id}/thumbnail?size=${imgSize}`, {
        headers: { 'x-api-key': IMMICH_API_KEY },
        signal: controller.signal
      })
      clearTimeout(timeoutId)
      
      if (!response.ok) {
        return res.status(404).send(Buffer.from(''))
      }
      
      res.setHeader('Content-Type', response.headers.get('content-type') || 'image/jpeg')
      res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=43200')
      
      const arrayBuffer = await response.arrayBuffer()
      return res.send(Buffer.from(arrayBuffer))
    } catch (error) {
      clearTimeout(timeoutId)
      console.error('Proxy assets thumbnail error:', error)
      // Return 404 empty buffer instead of hanging/crashing
      return res.status(404).send(Buffer.from(''))
    }
  }

  res.setHeader('Allow', ['GET'])
  res.status(405).end(`Method ${req.method} Not Allowed`)
}
