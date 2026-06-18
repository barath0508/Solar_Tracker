import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'fs'
import path from 'path'

const telemetryQueue: any[] = [];
const faultQueue: any[] = [];
const commandsQueue: any[] = [];
let lastCameraUploadTime = '';

// Fast-lane in-memory override store for low-latency manual control
// Key: device_id, Value: latest override payload
const overrideStore: Record<string, { auto: boolean; azimuth: number; elevation: number; ts: number }> = {};

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
          
          if (url.startsWith('/api/telemetry') && req.method === 'POST') {
            try {
              const rawBody = await parseBody(req);
              const data = JSON.parse(rawBody);
              
              telemetryQueue.push({
                ...data,
                timestamp: new Date().toISOString()
              });
              
              res.writeHead(200, { 'Content-Type': 'application/json' });
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
              
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ status: 'success', message: 'Fault alert received', data }));
              return;
            } catch (err: any) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ status: 'error', message: err.message }));
              return;
            }
          }

          if (url.startsWith('/api/telemetry/poll') && req.method === 'GET') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              telemetry: [...telemetryQueue],
              faults: [...faultQueue]
            }));
            telemetryQueue.length = 0;
            faultQueue.length = 0;
            return;
          }

          if (url.startsWith('/api/camera/upload') && req.method === 'POST') {
            try {
              const chunks: any[] = [];
              req.on('data', (chunk: any) => {
                chunks.push(chunk);
              });
              req.on('end', () => {
                const buffer = Buffer.concat(chunks);
                const publicDir = path.join(process.cwd(), 'public');
                if (!fs.existsSync(publicDir)) {
                  fs.mkdirSync(publicDir, { recursive: true });
                }
                const targetPath = path.join(publicDir, 'camera.jpg');
                fs.writeFileSync(targetPath, buffer);
                lastCameraUploadTime = new Date().toISOString();
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'success', message: 'Camera photo uploaded successfully', timestamp: lastCameraUploadTime }));
              });
              return;
            } catch (err: any) {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ status: 'error', message: err.message }));
              return;
            }
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

