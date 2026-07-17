export default async function handler(req, res) {
  const rawUrl = process.env.VITE_IMMICH_SERVER_URL || '';
  const IMMICH_SERVER_URL = rawUrl.replace(/\/api\/?$/, '').replace(/\/+$/, '');
  const IMMICH_API_KEY = process.env.IMMICH_API_KEY || process.env.IMMICH_VIEWER_API_KEY;

  if (req.method === 'GET') {
    try {
      const statsResponse = await fetch(`${IMMICH_SERVER_URL}/api/server/statistics`, { 
        headers: { 'x-api-key': IMMICH_API_KEY, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(5000)
      });
      
      let ping = "Error";
      let totalImages = 0;
      let diskUsed = "0 GB";

      if (statsResponse.ok) {
        const stats = await statsResponse.json();
        totalImages = stats.photos || 0;
        const usageBytes = stats.usage || 0;
        diskUsed = (usageBytes / (1024 * 1024 * 1024)).toFixed(1) + " GB";
        ping = "200 OK (Droplet Live)";
      } else {
        ping = `Failed (${statsResponse.status})`;
      }

      return res.status(200).json({
        ping,
        totalImages,
        diskUsed,
        activeSyncs: 0
      });
    } catch (error) {
      console.error('Proxy stats error:', error);
      return res.status(200).json({
        ping: "Offline",
        totalImages: 0,
        diskUsed: "0 GB",
        activeSyncs: 0
      });
    }
  }
  
  res.setHeader('Allow', ['GET']);
  res.status(405).end(`Method ${req.method} Not Allowed`);
}
