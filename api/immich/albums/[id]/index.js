export default async function handler(req, res) {
  const { id } = req.query
  const IMMICH_SERVER_URL = process.env.VITE_IMMICH_SERVER_URL || 'http://159.223.45.67:2283/api'
  const IMMICH_API_KEY = process.env.IMMICH_API_KEY

  if (req.method === 'GET') {
    try {
      const response = await fetch(`${IMMICH_SERVER_URL}/api/v1/albums/${id}`, { 
        headers: { 'x-api-key': IMMICH_API_KEY, 'Content-Type': 'application/json' } 
      })
      if (!response.ok) {
        console.warn(`Immich album fetch returned ${response.status}`)
        return res.status(200).json({ assets: [] })
      }
      return res.status(200).json(await response.json())
    } catch (error) {
      console.error('Proxy album assets error:', error)
      return res.status(200).json({ assets: [] })
    }
  }
  
  res.setHeader('Allow', ['GET'])
  res.status(405).end(`Method ${req.method} Not Allowed`)
}
