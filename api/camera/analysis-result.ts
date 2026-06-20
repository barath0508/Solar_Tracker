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

    if (supabase) {
      const { data, error } = await supabase
        .from('panel_analysis')
        .select('*')
        .eq('device_id', deviceId)
        .order('analyzed_at', { ascending: false })
        .limit(1);

      if (error) {
        console.error('Supabase query error in analysis-result:', error);
      } else if (data && data.length > 0) {
        const record = data[0];
        const analysis = {
          condition: record.condition,
          confidence: record.confidence,
          label: record.label,
          details: record.details,
          recommendation: record.recommendation,
          triggerCleaning: record.trigger_cleaning,
          timestamp: record.analyzed_at,
          device_id: record.device_id
        };
        return res.status(200).json({ status: 'success', analysis });
      }
    }

    return res.status(200).json({ status: 'success', analysis: null });
  } catch (err: any) {
    console.error('Analysis-result API error:', err);
    return res.status(200).json({ status: 'success', analysis: null });
  }
}
