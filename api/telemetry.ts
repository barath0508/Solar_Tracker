import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

// Initialize Supabase Client
const supabase = (supabaseUrl && supabaseAnonKey) 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : null;

export default async function handler(req: any, res: any) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const data = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    
    if (!supabase) {
      return res.status(200).json({ 
        status: 'mock_success', 
        message: 'Telemetry received, but Supabase variables not set on Vercel.' 
      });
    }

    // Insert telemetry into Supabase
    const { data: inserted, error } = await supabase
      .from('telemetry')
      .insert({
        device_id: data.device_id,
        v: Number(data.v),
        i: Number(data.i),
        p: Number(data.p),
        temp: Number(data.temp),
        fault: Number(data.fault),
        ldr: data.ldr,
        timestamp: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    return res.status(200).json({ status: 'success', data: inserted });
  } catch (err: any) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
}
