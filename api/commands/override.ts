// api/commands/override.ts
// Fast-lane in-memory override store.
// The slider POSTs here directly (no Supabase), and the ESP32 GETs here every 100ms.
// This cuts manual control latency from ~750ms → ~100ms worst case.

interface OverridePayload {
  auto: boolean;
  azimuth: number;
  elevation: number;
  ts: number;
}

// In-memory store keyed by device_id — survives for the lifetime of the Vite dev process
const store: Record<string, OverridePayload> = {};

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // ── POST: frontend slider writes a new override ──────────────────────────
  if (req.method === 'POST') {
    const { device_id, auto, azimuth, elevation } = req.body || {};
    if (!device_id) return res.status(400).json({ error: 'device_id required' });

    store[device_id] = {
      auto:      auto      ?? true,
      azimuth:   azimuth   ?? 0,
      elevation: elevation ?? 45,
      ts:        Date.now(),
    };
    return res.status(200).json({ status: 'ok', stored: store[device_id] });
  }

  // ── GET: ESP32 polls for the latest override ─────────────────────────────
  if (req.method === 'GET') {
    const deviceId = req.query.device_id;
    if (!deviceId) return res.status(400).json({ error: 'device_id required' });

    const entry = store[deviceId];

    // Only serve if the override was set within the last 30 seconds
    // (prevents stale commands being re-applied after a long idle period)
    if (entry && Date.now() - entry.ts < 30_000) {
      return res.status(200).json({
        status: 'ok',
        command: {
          action:    'override',
          auto:      entry.auto,
          azimuth:   entry.azimuth,
          elevation: entry.elevation,
        },
      });
    }

    return res.status(200).json({ status: 'ok', command: null });
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
