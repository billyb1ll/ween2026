export default async function handler(req, res) {
  const IMMICH_SERVER_URL = process.env.VITE_IMMICH_SERVER_URL || 'http://159.223.45.67:2283/api'
  const IMMICH_API_KEY = process.env.IMMICH_API_KEY

  if (req.method === 'POST') {
    try {
      const response = await fetch(`${IMMICH_SERVER_URL}/api/v1/search/metadata`, {
        method: 'POST',
        headers: { 'x-api-key': IMMICH_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify(req.body)
      })
      if (!response.ok) {
        console.warn(`Immich search returned ${response.status}`)
        return res.status(200).json({ assets: { items: [] } })
      }
      return res.status(200).json(await response.json())
    } catch (error) {
      console.error('Proxy search error:', error)
      return res.status(200).json({ assets: { items: [] } })
    }
  }

  res.setHeader('Allow', ['POST'])
  res.status(405).end(`Method ${req.method} Not Allowed`)
}
