export default async function handler(req, res) {
  const { id } = req.query
  const IMMICH_SERVER_URL = process.env.VITE_IMMICH_SERVER_URL || 'http://159.223.45.67:2283/api'
  const IMMICH_API_KEY = process.env.IMMICH_API_KEY

  if (req.method === 'PUT') {
    try {
      const response = await fetch(`${IMMICH_SERVER_URL}/api/v1/people/${id}`, {
        method: 'PUT',
        headers: { 'x-api-key': IMMICH_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify(req.body)
      })
      if (!response.ok) return res.status(response.status).send(await response.text())
      return res.status(200).json(await response.json())
    } catch (error) {
      return res.status(500).json({ error: 'Failed to proxy to Immich' })
    }
  }

  res.setHeader('Allow', ['PUT'])
  res.status(405).end(`Method ${req.method} Not Allowed`)
}
