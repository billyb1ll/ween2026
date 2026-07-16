export default async function handler(req, res) {
  const rawUrl = process.env.VITE_IMMICH_SERVER_URL || '';
  const IMMICH_SERVER_URL = rawUrl.replace(/\/api\/?$/, '').replace(/\/+$/, '');
  const IMMICH_API_KEY = process.env.IMMICH_API_KEY

  if (req.method === 'GET') {
    try {
      const response = await fetch(`${IMMICH_SERVER_URL}/api/people?withHidden=false`, { 
        headers: { 'x-api-key': IMMICH_API_KEY, 'Content-Type': 'application/json' } 
      })
      if (!response.ok) {
        console.warn(`Immich people returned ${response.status}`)
        return res.status(200).json([])
      }
      
      res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120')
      return res.status(200).json(await response.json())
    } catch (error) {
      console.error('Proxy people error:', error)
      return res.status(200).json([])
    }
  }
  
  res.setHeader('Allow', ['GET'])
  res.status(405).end(`Method ${req.method} Not Allowed`)
}
