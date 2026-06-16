// src/services/controlActions.ts
import { supabase } from './supabase';

export async function sendDeviceCommand(deviceId: string, action: 'stow' | 'clean' | 'reboot') {
  const { data, error } = await supabase
    .from('commands')
    .insert({
      device_id: deviceId,
      action,
      payload: { invoked_by: 'operator@suryamitra.in' },
      status: 'pending'
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}
export default sendDeviceCommand;
