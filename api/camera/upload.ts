import { createClient } from '@supabase/supabase-js';
import { setCachedAnalysis } from './analysis-result';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const geminiApiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '';

const supabase = (supabaseUrl && supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

const GEMINI_URL =
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`;

export const config = { api: { bodyParser: false } };

function readRawBody(req: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export let lastImageBase64 = '';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-device-id');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    let imageBase64 = '';
    const deviceId = req.query.device_id || req.headers['x-device-id'] || 'd1e028b0-a541-4702-8c20-3354316d2cf1';

    const contentType = (req.headers['content-type'] || '').toLowerCase();

    if (contentType.includes('image/jpeg') || contentType.includes('image/jpg')) {
      const buf = await readRawBody(req);
      imageBase64 = buf.toString('base64');
    } else {
      const buf  = await readRawBody(req);
      const body = JSON.parse(buf.toString());
      imageBase64 = body.imageBase64 || '';
    }

    if (!imageBase64) {
      return res.status(400).json({ error: 'No image data provided' });
    }

    lastImageBase64 = imageBase64;

    if (!geminiApiKey) {
      const mockResult = {
        condition: 'unknown',
        confidence: 0,
        label: 'Gemini API key not configured',
        details: 'Set GEMINI_API_KEY in your environment to enable AI analysis.',
        recommendation: 'Configure GEMINI_API_KEY to activate panel inspection.',
        triggerCleaning: false,
        timestamp: new Date().toISOString(),
        device_id: deviceId
      };
      setCachedAnalysis(mockResult);
      return res.status(200).json({ status: 'success', analysis: mockResult });
    }

    const prompt = `You are an expert solar panel condition monitoring AI built into AadhavanAI — a smart dual-axis solar tracker system.

Analyze this image captured by the onboard ESP32-CAM mounted on the solar tracker panel.

Respond ONLY with a valid JSON object (no markdown, no code fences) in this exact structure:
{
  "condition": "<one of: clear | dusty | heavily_dusty | bird_dropping | obstructed | damaged | glare | water_logged | unknown>",
  "confidence": <integer 0-100>,
  "label": "<short human-readable label, max 40 chars>",
  "details": "<1-2 sentences describing exactly what you see on the panel>",
  "recommendation": "<one actionable sentence>",
  "triggerCleaning": <true | false>
}

Condition definitions:
- clear: panel surface is clean, full solar exposure, no obstructions
- dusty: light uniform dust layer reducing efficiency slightly
- heavily_dusty: thick dust significantly reducing panel output — set triggerCleaning true
- bird_dropping: visible bird droppings on surface — set triggerCleaning true
- obstructed: shadow or physical object blocking part of the panel
- damaged: cracks, delamination, burn marks, or broken cells visible
- glare: severe light reflection causing camera overexposure
- water_logged: water pooling or condensation on panel surface
- unknown: image too dark, blurry, or not recognisably a solar panel

Set triggerCleaning to true ONLY for heavily_dusty or bird_dropping conditions.`;

    const geminiBody = {
      contents: [{
        parts: [
          { text: prompt },
          { inline_data: { mime_type: 'image/jpeg', data: imageBase64 } }
        ]
      }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 350 }
    };

    const geminiRes = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiBody),
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      return res.status(502).json({ error: 'Gemini API error', details: errText });
    }

    const geminiData = await geminiRes.json();
    const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    const cleanText = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    let analysis: any = {};
    try {
      analysis = JSON.parse(cleanText);
    } catch {
      analysis = {
        condition: 'unknown',
        confidence: 0,
        label: 'Response parse error',
        details: rawText.slice(0, 200),
        recommendation: 'Retry capture.',
        triggerCleaning: false,
      };
    }

    const result = { ...analysis, device_id: deviceId, timestamp: new Date().toISOString() };
    setCachedAnalysis(result);

    // Persist to Supabase if configured
    if (supabase && deviceId) {
      await supabase.from('panel_analysis').insert({
        device_id:        deviceId,
        condition:        result.condition,
        confidence:       result.confidence,
        label:            result.label,
        details:          result.details,
        recommendation:   result.recommendation,
        trigger_cleaning: result.triggerCleaning,
        analyzed_at:      result.timestamp,
      });

      if (result.triggerCleaning) {
        await supabase.from('alerts').insert({
          device_id:   deviceId,
          severity:    'warning',
          message:     `AI Panel Inspection: ${result.label}. ${result.recommendation}`,
          is_resolved: false,
          created_at:  result.timestamp,
        });
      }
    }

    return res.status(200).json({ status: 'success', analysis: result });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
