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
    let telemetry: any[] = [];
    let faults: any[] = [];

    if (supabase) {
      // 1. Fetch latest telemetry row
      const { data: telData, error: telError } = await supabase
        .from('telemetry')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(1);

      if (telError) {
        console.error('Supabase telemetry fetch error:', telError);
      } else if (telData) {
        telemetry = telData;
      }

      // 2. Fetch unresolved alerts/faults
      const { data: faultData, error: faultError } = await supabase
        .from('alerts')
        .select('*')
        .eq('is_resolved', false);

      if (faultError) {
        console.error('Supabase alerts fetch error:', faultError);
      } else if (faultData) {
        faults = faultData;
      }
    }

    return res.status(200).json({
      telemetry,
      faults
    });
  } catch (err: any) {
    console.error('Telemetry poll API error:', err);
    return res.status(200).json({
      telemetry: [],
      faults: []
    });
  }
}
