export default async function handler(req, res) {
  const { id } = req.query
  const IMMICH_SERVER_URL = process.env.VITE_IMMICH_SERVER_URL || 'http://159.223.45.67:2283/api'
  const IMMICH_API_KEY = process.env.IMMICH_API_KEY

  if (req.method === 'GET') {
    try {
      const response = await fetch(`${IMMICH_SERVER_URL}/api/v1/people/${id}/thumbnail`, {
        headers: { 'x-api-key': IMMICH_API_KEY }
      })
      if (!response.ok) {
        return res.status(404).send(Buffer.from(''))
      }
      
      res.setHeader('Content-Type', response.headers.get('content-type') || 'image/jpeg')
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
      
      const arrayBuffer = await response.arrayBuffer()
      return res.send(Buffer.from(arrayBuffer))
    } catch (error) {
      console.error('Proxy people thumbnail error:', error)
      return res.status(404).send(Buffer.from(''))
    }
  }

  res.setHeader('Allow', ['GET'])
  res.status(405).end(`Method ${req.method} Not Allowed`)
}
