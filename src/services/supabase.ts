// src/services/supabase.ts
import { createClient } from '@supabase/supabase-js';
import { mockDb } from './mockDb';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isLiveMode = !!(supabaseUrl && supabaseAnonKey);

// Real Client initialization
export const supabaseReal = isLiveMode 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : null;

// Mock Client API mapping to mockDb
const mockSupabaseClient = {
  auth: {
    getUser: async () => {
      const p = mockDb.getProfile();
      if (!p) return { data: { user: null }, error: null };
      return {
        data: {
          user: {
            id: p.id,
            email: p.email,
            user_metadata: { role: p.role }
          }
        },
        error: null
      };
    },
    signInWithPassword: async ({ email }: any) => {
      const p = mockDb.getProfile();
      return {
        data: {
          user: {
            id: p?.id || 'user-id-123',
            email,
            user_metadata: { role: p?.role || 'Admin' }
          }
        },
        error: null
      };
    },
    signOut: async () => {
      return { error: null };
    }
  },

  from: (table: string) => {
    return {
      select: (_query?: string) => {
        const p = Promise.resolve({ data: [], error: null });
        return Object.assign(p, {
          eq: (_column: string, value: any) => {
            const pEq = Promise.resolve({ data: [], error: null });
            return Object.assign(pEq, {
              single: async () => {
                if (table === 'devices') {
                  const d = mockDb.getDevices().find(x => x.id === value);
                  return { data: d, error: d ? null : { message: 'Not Found' } };
                }
                if (table === 'profiles') {
                  const profile = mockDb.getProfile();
                  return { data: profile, error: profile ? null : { message: 'Not Found' } };
                }
                return { data: null, error: { message: 'Not implemented' } };
              },
              gte: (_cCol: string, gVal: any) => {
                return {
                  order: async (oCol: string, { ascending }: any = {}) => {
                    if (table === 'telemetry') {
                      let list = mockDb.getTelemetry(value);
                      if (gVal) {
                        list = list.filter(t => t.timestamp >= gVal);
                      }
                      const sorted = [...list].sort((a: any, b: any) => {
                        const timeA = new Date(a[oCol]).getTime();
                        const timeB = new Date(b[oCol]).getTime();
                        return ascending ? timeA - timeB : timeB - timeA;
                      });
                      return { data: sorted, error: null };
                    }
                    return { data: [], error: null };
                  }
                };
              }
            });
          },
          order: (_column: string, { ascending }: any = {}) => {
            if (table === 'devices') {
              return Promise.resolve({ data: mockDb.getDevices(), error: null });
            } else if (table === 'alerts') {
              const list = [...mockDb.getAlerts()].sort((a, b) => {
                const timeA = new Date(a.created_at).getTime();
                const timeB = new Date(b.created_at).getTime();
                return ascending ? timeA - timeB : timeB - timeA;
              });
              return Promise.resolve({ data: list, error: null });
            } else if (table === 'commands') {
              const list = [...mockDb.getCommands()].sort((a, b) => {
                const timeA = new Date(a.created_at).getTime();
                const timeB = new Date(b.created_at).getTime();
                return ascending ? timeA - timeB : timeB - timeA;
              });
              return Promise.resolve({ data: list, error: null });
            }
            return Promise.resolve({ data: [], error: null });
          }
        });
      },
      insert: (payload: any) => {
        const singlePayload = Array.isArray(payload) ? payload[0] : payload;
        const p = Promise.resolve({ data: [], error: null });
        return Object.assign(p, {
          select: () => ({
            single: async () => {
              if (table === 'commands') {
                const cmd = mockDb.insertCommand(singlePayload.device_id, singlePayload.action, singlePayload.payload);
                return { data: cmd, error: null };
              }
              if (table === 'devices') {
                const dev = mockDb.addDevice(payload);
                return { data: dev, error: null };
              }
              return { data: null, error: { message: 'Insert not implemented' } };
            }
          })
        });
      },
      update: (payload: any) => {
        return {
          eq: (_column: string, value: any) => {
            if (table === 'alerts' && payload.is_resolved !== undefined) {
              mockDb.resolveAlert(value);
            }
            return Promise.resolve({ data: null, error: null });
          }
        };
      }
    };
  },

  storage: {
    from: (bucket: string) => {
      return {
        upload: async (path: string, file: File) => {
          console.log(`📦 Mock Upload to [${bucket}] Bucket: Path: ${path}, File: ${file.name}`);
          return { data: { path }, error: null };
        },
        createSignedUrl: async (path: string, expiry: number) => {
          console.log(`🔗 Mock Signed URL generated for ${path} (expires in ${expiry}s)`);
          return {
            data: { signedUrl: `https://mock-storage.supabase.co/signed/${path}?t=${Date.now()}` },
            error: null
          };
        }
      };
    }
  },

  channel: (name: string) => {
    return {
      on: (event: string, filter: any, callback: (payload: any) => void) => {
        return {
          subscribe: () => {
            console.log(`📶 Mock Subscription Active: ${name} (Event: ${event}, Filter: ${JSON.stringify(filter)})`);
            const unsubscribe = mockDb.subscribe(() => {
              if (name.startsWith('device-telemetry:')) {
                const deviceId = name.split(':')[1];
                const list = mockDb.getTelemetry(deviceId);
                const latest = list[list.length - 1];
                if (latest) {
                  callback({ new: latest });
                }
              }
            });
            return { unsubscribe };
          }
        };
      },
      subscribe: () => {
        console.log(`📶 Mock Subscription Active (General): ${name}`);
        return {
          unsubscribe: () => console.log(`📶 Unsubscribed: ${name}`)
        };
      }
    };
  },
  removeChannel: (channel: any) => {
    if (channel && typeof channel.unsubscribe === 'function') {
      channel.unsubscribe();
    }
  }
};

export const supabase = isLiveMode ? (supabaseReal as unknown as typeof mockSupabaseClient) : mockSupabaseClient;
export default supabase;
