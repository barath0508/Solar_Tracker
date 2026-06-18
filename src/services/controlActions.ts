// src/services/controlActions.ts
import { supabase } from './supabase';

export async function sendDeviceCommand(
  deviceId: string, 
  action: 'stow' | 'clean' | 'reboot' | 'capture' | 'calibrate' | 'override',
  customPayload: any = {}
) {
  const payload = { invoked_by: 'operator@aadhavan.ai', ...customPayload };

  // 1. Fast-lane local post (fire and forget for local ESP32 polling)
  fetch('/api/commands', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      device_id: deviceId,
      action: action,
      payload: payload,
      status: 'pending'
    }),
  }).catch(() => { /* local server offline — no-op */ });

  // 2. Supabase insert for Vercel/remote syncing
  const { data, error } = await supabase
    .from('commands')
    .insert({
      device_id: deviceId,
      action,
      payload,
      status: 'pending'
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}
export default sendDeviceCommand;
