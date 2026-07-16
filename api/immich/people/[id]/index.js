import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  const { id } = req.query
  const rawUrl = process.env.VITE_IMMICH_SERVER_URL || '';
  const IMMICH_SERVER_URL = rawUrl.replace(/\/api\/?$/, '').replace(/\/+$/, '');
  const IMMICH_API_KEY = process.env.IMMICH_API_KEY
  const SUPABASE_URL = process.env.VITE_SUPABASE_URL
  const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY

  if (req.method === 'PUT') {
    try {
      // 1. Enforce Auth
      const authHeader = req.headers.authorization || req.headers['x-baan7-session'];
      if (!authHeader) {
        return res.status(401).json({ error: 'Unauthorized: Missing Authorization header' });
      }

      const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      const token = authHeader.replace('Bearer ', '');
      const { data: session } = await supabase.from('user_sessions').select('*').eq('session_token', token).maybeSingle();

      if (!session || new Date(session.expires_at) < new Date()) {
        return res.status(401).json({ error: 'Unauthorized: Invalid token' });
      }

      // 2. Enforce Face Claim Ownership
      const { data: faceRecord } = await supabase.from('user_faces').select('student_id').eq('immich_person_id', id).maybeSingle();
      if (faceRecord && faceRecord.student_id !== session.student_id) {
         return res.status(403).json({ error: 'Forbidden: Face claimed by another user' });
      }

      // 3. Forward to Immich
      const response = await fetch(`${IMMICH_SERVER_URL}/api/people/${id}`, {
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
