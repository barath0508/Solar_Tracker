// src/hooks/useRealtimeTelemetry.ts
import { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import type { Telemetry as TelemetryData } from '../services/mockDb';


export type { TelemetryData };

export function useRealtimeTelemetry(deviceId: string) {
  const [liveData, setLiveData] = useState<TelemetryData | null>(null);

  useEffect(() => {
    if (!deviceId) return;

    const channel = supabase
      .channel(`device-telemetry:${deviceId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'telemetry',
          filter: `device_id=eq.${deviceId}`
        },
        (payload) => {
          setLiveData(payload.new as TelemetryData);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [deviceId]);

  return liveData;
}
export default useRealtimeTelemetry;
