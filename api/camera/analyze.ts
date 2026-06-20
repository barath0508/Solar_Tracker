import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = (supabaseUrl && supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-device-id');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const deviceId = req.query.device_id || req.headers['x-device-id'] || 'd1e028b0-a541-4702-8c20-3354316d2cf1';
    
    const mockResult = {
      condition: "clear",
      confidence: 98,
      label: "Optimal Cleanliness",
      details: "Visual monitoring confirms the solar panel surface is clear, with optimal solar exposure and no visible obstructions.",
      recommendation: "No cleaning required at this time.",
      triggerCleaning: false,
      device_id: deviceId,
      timestamp: new Date().toISOString()
    };

    // Persist to Supabase if configured
    if (supabase && deviceId) {
      try {
        const { error: insertError } = await supabase.from('panel_analysis').insert({
          device_id:        deviceId,
          condition:        mockResult.condition,
          confidence:       mockResult.confidence,
          label:            mockResult.label,
          details:          mockResult.details,
          recommendation:   mockResult.recommendation,
          trigger_cleaning: mockResult.triggerCleaning,
          analyzed_at:      mockResult.timestamp,
        });

        if (insertError) {
          console.error('[Supabase] panel_analysis insert error:', insertError);
        }
      } catch (dbErr) {
        console.error('[Supabase] DB exception during insertion:', dbErr);
      }
    }

    return res.status(200).json({ status: 'success', analysis: mockResult });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
