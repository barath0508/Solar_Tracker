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
        message: 'Mock command queued locally.' 
      });
    }

    // Insert command into Supabase commands table
    const { data: inserted, error } = await supabase
      .from('commands')
      .insert({
        device_id: data.device_id,
        action: data.action,
        payload: data.payload || {},
        status: 'pending',
        created_by: data.created_by || 'visitor-uid',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    return res.status(200).json({ status: 'success', data: inserted });
  } catch (err: any) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
}
