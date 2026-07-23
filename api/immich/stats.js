export default async function handler(req, res) {
  const rawUrl = process.env.VITE_IMMICH_SERVER_URL || '';
  const IMMICH_SERVER_URL = rawUrl.replace(/\/api\/?$/, '').replace(/\/+$/, '');
  const IMMICH_API_KEY = process.env.IMMICH_API_KEY || process.env.IMMICH_VIEWER_API_KEY;

  if (req.method === 'GET') {
    try {
      // 1. Try global statistics (Admin API Key)
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
      } else if (statsResponse.status === 403) {
        // Non-admin (Staff/User) API Key fallback
        const pingRes = await fetch(`${IMMICH_SERVER_URL}/api/server/ping`, {
          headers: { 'x-api-key': IMMICH_API_KEY },
          signal: AbortSignal.timeout(3000)
        });

        if (pingRes.ok) {
          ping = "200 OK (Droplet Live)";
          
          // Get user profile & quota
          try {
            const userRes = await fetch(`${IMMICH_SERVER_URL}/api/users/me`, {
              headers: { 'x-api-key': IMMICH_API_KEY },
              signal: AbortSignal.timeout(3000)
            });
            if (userRes.ok) {
              const userData = await userRes.json();
              if (userData.quotaUsageInBytes) {
                diskUsed = (userData.quotaUsageInBytes / (1024 * 1024 * 1024)).toFixed(1) + " GB";
              }
            }
          } catch (_) {}

          // Get indexed photos count for this user key
          try {
            const searchRes = await fetch(`${IMMICH_SERVER_URL}/api/search/metadata`, {
              method: 'POST',
              headers: { 'x-api-key': IMMICH_API_KEY, 'Content-Type': 'application/json' },
              body: JSON.stringify({}),
              signal: AbortSignal.timeout(3000)
            });
            if (searchRes.ok) {
              const searchData = await searchRes.json();
              totalImages = searchData.assets?.total || searchData.assets?.count || 0;
            }
          } catch (_) {}
        } else {
          ping = `Failed (${pingRes.status})`;
        }
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
