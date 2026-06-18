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
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const deviceId = req.query.device_id;
    if (!deviceId) {
      return res.status(400).json({ error: 'device_id query parameter is required' });
    }

    if (!supabase) {
      return res.status(200).json({ 
        status: 'success', 
        commands: [] 
      });
    }

    const client = req.query.client;

    // 1. Fetch pending commands for this device ID
    let query = supabase
      .from('commands')
      .select('*')
      .eq('device_id', deviceId)
      .eq('status', 'pending');

    if (client === 'camera') {
      // Camera client retrieves capture and reboot commands
      query = query.in('action', ['capture', 'reboot']);
    } else {
      // Other clients (like the tracker) retrieve non-capture commands
      query = query.neq('action', 'capture');
    }

    const { data: commands, error } = await query;

    if (error) throw error;

    if (commands && commands.length > 0) {
      // 2. Mark retrieved commands as 'sent' in Supabase to consume them
      const ids = commands.map(c => c.id);
      const { error: updateError } = await supabase
        .from('commands')
        .update({ status: 'sent' })
        .in('id', ids);

      if (updateError) throw updateError;
    }

    return res.status(200).json({ status: 'success', commands: commands || [] });
  } catch (err: any) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
}
