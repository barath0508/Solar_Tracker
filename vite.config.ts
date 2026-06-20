import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'fs'
import path from 'path'

// Manually load variables from .env file into process.env for the Vite dev server context
try {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split(/\r?\n/).forEach((line) => {
      if (!line || line.trim().startsWith('#')) return;
      const parts = line.split('=');
      if (parts.length >= 2) {
        const key = parts[0].trim();
        let val = parts.slice(1).join('=').trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.substring(1, val.length - 1);
        }
        process.env[key] = val;
      }
    });
  }
} catch (err) {
  console.error('[ViteConfig] Failed to load .env file:', err);
}

const telemetryQueue: any[] = [];
const faultQueue: any[] = [];
const commandsQueue: any[] = [];
let lastCameraUploadTime = '';

// Gemini AI panel analysis — latest result cached in memory
let lastPanelAnalysis: any = null;

// Fast-lane in-memory override store for low-latency manual control
// Key: device_id, Value: latest override payload
const overrideStore: Record<string, { auto: boolean; azimuth: number; elevation: number; ts: number }> = {};

// ── Gemini AI analysis helper (called after every camera upload) ──────────────
async function analyzeImageWithGemini(imageBuffer: Buffer, deviceId: string): Promise<void> {
  const geminiApiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '';

  if (!geminiApiKey) {
    lastPanelAnalysis = {
      condition: 'unknown',
      confidence: 0,
      label: 'GEMINI_API_KEY not set',
      details: 'Add GEMINI_API_KEY to your .env file to enable AI panel analysis.',
      recommendation: 'Configure GEMINI_API_KEY in .env',
      triggerCleaning: false,
      device_id: deviceId,
      timestamp: new Date().toISOString(),
    };
    return;
  }

  const imageBase64 = imageBuffer.toString('base64');
  const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`;

  const prompt = `You are an expert solar panel condition monitoring AI built into AadhavanAI — a smart dual-axis solar tracker system prototype.

The image is captured by an onboard ESP32-CAM overlooking a mini solar panel (prototype model). The background may contain wiring, a prototype chassis, and electronic components.

Analyze the surface of the solar panel shown in the image.

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

  try {
    const res = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [
          { text: prompt },
          { inlineData: { mimeType: 'image/jpeg', data: imageBase64 } }
        ]}],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 350,
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              condition: {
                type: "STRING",
                enum: ["clear", "dusty", "heavily_dusty", "bird_dropping", "obstructed", "damaged", "glare", "water_logged", "unknown"]
              },
              confidence: { type: "INTEGER" },
              label: { type: "STRING" },
              details: { type: "STRING" },
              recommendation: { type: "STRING" },
              triggerCleaning: { type: "BOOLEAN" }
            },
            required: ["condition", "confidence", "label", "details", "recommendation", "triggerCleaning"]
          }
        }
      }),
    });

    if (!res.ok) {
      const txt = await res.text();
      console.error('[Gemini] API error:', txt);
      lastPanelAnalysis = { condition: 'unknown', confidence: 0, label: 'Gemini API error', details: txt.slice(0, 200), recommendation: 'Check API key.', triggerCleaning: false, device_id: deviceId, timestamp: new Date().toISOString() };
      return;
    }

    const data = (await res.json()) as any;
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    const cleanText = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    let analysis: any = {};
    try { analysis = JSON.parse(cleanText); }
    catch { analysis = { condition: 'unknown', confidence: 0, label: 'Parse error', details: rawText.slice(0, 200), recommendation: 'Retry capture.', triggerCleaning: false }; }

    lastPanelAnalysis = { ...analysis, device_id: deviceId, timestamp: new Date().toISOString() };
    console.log('[Gemini] Panel analysis:', lastPanelAnalysis.condition, `(${lastPanelAnalysis.confidence}%)`);
  } catch (err: any) {
    console.error('[Gemini] Fetch error:', err.message);
    lastPanelAnalysis = { condition: 'unknown', confidence: 0, label: 'Network error', details: err.message, recommendation: 'Check server connectivity.', triggerCleaning: false, device_id: deviceId, timestamp: new Date().toISOString() };
  }
}

function parseBody(req: any): Promise<string> {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk: any) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      resolve(body);
    });
  });
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(), 
    tailwindcss(),
    {
      name: 'api-endpoints',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          const url = req.url || '';
          
          // ── IMPORTANT: /api/telemetry/poll must be checked BEFORE /api/telemetry
          // because startsWith('/api/telemetry') also matches '/api/telemetry/poll'
          if (url.startsWith('/api/telemetry/poll') && req.method === 'GET') {
            res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
            res.end(JSON.stringify({
              telemetry: [...telemetryQueue],
              faults: [...faultQueue]
            }));
            telemetryQueue.length = 0;
            faultQueue.length = 0;
            return;
          }

          // Exact /api/telemetry path only (not sub-paths like /poll)
          if ((url === '/api/telemetry' || url.startsWith('/api/telemetry?')) && req.method === 'POST') {
            try {
              const rawBody = await parseBody(req);
              const data = JSON.parse(rawBody);
              
              telemetryQueue.push({
                ...data,
                timestamp: new Date().toISOString()
              });
              
              res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
              res.end(JSON.stringify({ status: 'success', message: 'Telemetry received', data }));
              return;
            } catch (err: any) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ status: 'error', message: err.message }));
              return;
            }
          }

          if (url.startsWith('/api/faults') && req.method === 'POST') {
            try {
              const rawBody = await parseBody(req);
              const data = JSON.parse(rawBody);
              
              faultQueue.push({
                ...data,
                timestamp: new Date().toISOString()
              });
              
              res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
              res.end(JSON.stringify({ status: 'success', message: 'Fault alert received', data }));
              return;
            } catch (err: any) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ status: 'error', message: err.message }));
              return;
            }
          }

          if (url.startsWith('/api/camera/upload') && req.method === 'POST') {
            const chunks: any[] = [];
            req.on('data', (chunk: any) => chunks.push(chunk));
            req.on('end', async () => {
              try {
                const buffer = Buffer.concat(chunks);
                const publicDir = path.join(process.cwd(), 'public');
                if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });
                const targetPath = path.join(publicDir, 'camera.jpg');
                fs.writeFileSync(targetPath, buffer);
                lastCameraUploadTime = new Date().toISOString();

                // Respond immediately — analysis runs in background
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'success', message: 'Camera photo uploaded. AI analysis started.', timestamp: lastCameraUploadTime }));

                // Extract device_id from query string if present
                const parsedUrl = new URL(url, 'http://localhost');
                const deviceId = parsedUrl.searchParams.get('device_id') || 'd1e028b0-a541-4702-8c20-3354316d2cf1';

                // Run Gemini AI analysis asynchronously (non-blocking)
                analyzeImageWithGemini(buffer, deviceId).catch(console.error);
              } catch (err: any) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'error', message: err.message }));
              }
            });
            return;
          }

          // ── Gemini AI analysis result endpoint ────────────────────────────
          if (url.startsWith('/api/camera/analysis-result') && req.method === 'GET') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'success', analysis: lastPanelAnalysis }));
            return;
          }

          // ── Manual analyze trigger (POST base64 image) ───────────────────
          if (url.startsWith('/api/camera/analyze') && req.method === 'POST') {
            try {
              const rawBody = await parseBody(req);
              const body = JSON.parse(rawBody);
              const deviceId = body.device_id || 'd1e028b0-a541-4702-8c20-3354316d2cf1';
              let buffer: Buffer;

              if (body.imageBase64) {
                buffer = Buffer.from(body.imageBase64, 'base64');
              } else {
                // Re-analyze the last uploaded camera.jpg
                const camPath = path.join(process.cwd(), 'public', 'camera.jpg');
                if (!fs.existsSync(camPath)) {
                  res.writeHead(404, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({ error: 'No camera image available yet.' }));
                  return;
                }
                buffer = fs.readFileSync(camPath);
              }

              await analyzeImageWithGemini(buffer, deviceId);
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ status: 'success', analysis: lastPanelAnalysis }));
            } catch (err: any) {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ status: 'error', message: err.message }));
            }
            return;
          }

          if (url.startsWith('/api/camera/status') && req.method === 'GET') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              lastUploadTime: lastCameraUploadTime,
              photoExists: fs.existsSync(path.join(process.cwd(), 'public', 'camera.jpg'))
            }));
            return;
          }

          if (url.startsWith('/api/commands/poll') && req.method === 'GET') {
            try {
              const parsedUrl = new URL(url, 'http://localhost');
              const deviceId = parsedUrl.searchParams.get('device_id');
              const client = parsedUrl.searchParams.get('client');
              
              // Filter commands for this device ID
              let deviceCommands = commandsQueue.filter(c => c.device_id === deviceId);
              
              if (client === 'camera') {
                // Camera client retrieves capture and reboot commands
                deviceCommands = deviceCommands.filter(c => c.action === 'capture' || c.action === 'reboot');
              } else {
                // Other clients (like the tracker) retrieve non-capture commands
                deviceCommands = deviceCommands.filter(c => c.action !== 'capture');
              }
              
              // Remove consumed commands from the queue
              for (let i = commandsQueue.length - 1; i >= 0; i--) {
                const cmd = commandsQueue[i];
                if (cmd.device_id === deviceId) {
                  if (client === 'camera' && (cmd.action === 'capture' || cmd.action === 'reboot')) {
                    commandsQueue.splice(i, 1);
                  } else if (client !== 'camera' && cmd.action !== 'capture') {
                    commandsQueue.splice(i, 1);
                  }
                }
              }
              
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ status: 'success', commands: deviceCommands }));
              return;
            } catch (err: any) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ status: 'error', message: err.message }));
              return;
            }
          }

          // ── Fast-lane override: POST stores, GET retrieves (no Supabase) ──────
          if (url.startsWith('/api/commands/override')) {
            const parsedUrl = new URL(url, 'http://localhost');
            const deviceId = parsedUrl.searchParams.get('device_id') || '';

            if (req.method === 'POST') {
              try {
                const rawBody = await parseBody(req);
                const body = JSON.parse(rawBody);
                overrideStore[body.device_id || deviceId] = {
                  auto:      body.auto      ?? true,
                  azimuth:   body.azimuth   ?? 0,
                  elevation: body.elevation ?? 45,
                  ts:        Date.now(),
                };
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'ok' }));
              } catch (err: any) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'error', message: err.message }));
              }
              return;
            }

            if (req.method === 'GET') {
              const entry = overrideStore[deviceId];
              // Only serve override if set within the last 30 seconds
              if (entry && Date.now() - entry.ts < 30_000) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                  status: 'ok',
                  command: { action: 'override', auto: entry.auto, azimuth: entry.azimuth, elevation: entry.elevation }
                }));
              } else {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'ok', command: null }));
              }
              return;
            }
          }

          if (url.startsWith('/api/commands') && req.method === 'POST') {
            try {
              const rawBody = await parseBody(req);
              const data = JSON.parse(rawBody);
              
              commandsQueue.push({
                ...data,
                timestamp: new Date().toISOString()
              });
              
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ status: 'success', message: 'Command queued', data }));
              return;
            } catch (err: any) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ status: 'error', message: err.message }));
              return;
            }
          }

          next();
        });
      }
    }
  ],
})

