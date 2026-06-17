import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const telemetryQueue: any[] = [];
const faultQueue: any[] = [];
const commandsQueue: any[] = [];

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

          if (url.startsWith('/api/commands/poll') && req.method === 'GET') {
            try {
              const parsedUrl = new URL(url, 'http://localhost');
              const deviceId = parsedUrl.searchParams.get('device_id');
              
              // Filter commands for this device ID
              const deviceCommands = commandsQueue.filter(c => c.device_id === deviceId);
              
              // Remove filtered commands from the queue (consume them)
              for (let i = commandsQueue.length - 1; i >= 0; i--) {
                if (commandsQueue[i].device_id === deviceId) {
                  commandsQueue.splice(i, 1);
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

