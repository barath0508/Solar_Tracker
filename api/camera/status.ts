import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = (supabaseUrl && supabaseAnonKey) 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : null;

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const deviceId = req.query.device_id || 'd1e028b0-a541-4702-8c20-3354316d2cf1';
    let lastUploadTime = '';

    if (supabase) {
      const { data, error } = await supabase
        .from('panel_analysis')
        .select('analyzed_at')
        .eq('device_id', deviceId)
        .order('analyzed_at', { ascending: false })
        .limit(1);

      if (error) throw error;

      if (data && data.length > 0) {
        lastUploadTime = data[0].analyzed_at;
      }
    }

    return res.status(200).json({
      lastUploadTime,
      photoExists: false
    });
  } catch (err: any) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
}
