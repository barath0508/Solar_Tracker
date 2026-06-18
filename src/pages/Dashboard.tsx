// src/pages/Dashboard.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { mockDb } from '../services/mockDb';
import type { Device, Telemetry } from '../services/mockDb';
import { supabase, isLiveMode } from '../services/supabase';
import { sendDeviceCommand } from '../services/controlActions';
import { 
  Activity, ChevronRight, Plus, Map, Wind, RotateCw, Cpu, Check, ShieldAlert, Sliders
} from 'lucide-react';
import L from 'leaflet';


interface DashboardProps {
  userRole: 'Visitor' | 'End-User' | 'Technician' | 'Admin';
}

export default function Dashboard({ userRole }: DashboardProps) {
  const [devices, setDevices] = useState<Device[]>([]);
  const [telemetry, setTelemetry] = useState<Record<string, Telemetry[]>>({});
  const [showAddModal, setShowAddModal] = useState(false);
  const [newDevName, setNewDevName] = useState('');
  const [newDevSerial, setNewDevSerial] = useState('');
  const [newDevLat, setNewDevLat] = useState('19.0760'); // Mumbai default
  const [newDevLng, setNewDevLng] = useState('72.8777');
  
  const navigate = useNavigate();
  const [commandStatus, setCommandStatus] = useState<string | null>(null);

  const triggerGroupAction = async (action: 'stow' | 'clean' | 'reboot' | 'resolve_all') => {
    if (userRole === 'Visitor') {
      alert('🔒 Access Denied: Visitor role cannot execute override controls.');
      return;
    }

    setCommandStatus(`Dispatching group command: ${action}...`);
    try {
      if (action === 'resolve_all') {
        if (!isLiveMode) {
          const activeAlerts = mockDb.getAlerts().filter(a => !a.is_resolved);
          activeAlerts.forEach(a => {
            mockDb.resolveAlert(a.id);
          });
        } else {
          // Resolve all active alerts in Supabase
          const { error } = await supabase
            .from('alerts')
            .update({ is_resolved: true, resolved_at: new Date().toISOString() })
            .eq('is_resolved', false);
          
          if (error) throw error;
          
          // Also set faulted devices back to online status
          const { error: devError } = await supabase
            .from('devices')
            .update({ status: 'online' })
            .eq('status', 'fault');

          if (devError) throw devError;
        }
        setCommandStatus('All active fleet anomalies have been cleared.');
      } else {
        // Use sendDeviceCommand for both local API posting and Supabase insertion
        const targetDevices = devices.filter(d => d.status !== 'offline');
        
        await Promise.all(targetDevices.map(async (dev) => {
          if (!isLiveMode) {
            mockDb.insertCommand(dev.id, action, { invoked_by: 'fleet-operator@aadhavan.ai', scope: 'fleet-group' });
          }
          await sendDeviceCommand(dev.id, action, { scope: 'fleet-group' });
        }));

        setCommandStatus(`Group command "${action.toUpperCase()}" successfully dispatched to all active trackers.`);
      }

      setTimeout(() => {
        setCommandStatus(null);
      }, 5000);
    } catch (err: any) {
      setCommandStatus(`Group command failed: ${err.message}`);
    }
  };
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const markerGroupRef = useRef<L.LayerGroup | null>(null);

  // Initialize Map
  useEffect(() => {
    if (mapRef.current && !mapInstance.current) {
      const map = L.map(mapRef.current, {
        zoomControl: true,
        scrollWheelZoom: true,
      }).setView([20.5937, 78.9629], 5);

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
      }).addTo(map);

      mapInstance.current = map;
      markerGroupRef.current = L.layerGroup().addTo(map);
    }

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
        markerGroupRef.current = null;
      }
    };
  }, []);

  // Update Markers when devices or telemetry updates
  useEffect(() => {
    if (mapInstance.current && markerGroupRef.current) {
      markerGroupRef.current.clearLayers();

      devices.forEach(d => {
        const markerColor = d.status === 'online' ? '#10b981' : d.status === 'fault' ? '#f59e0b' : '#64748b';
        const latestTel = telemetry[d.id]?.[telemetry[d.id].length - 1];
        const powerVal = (latestTel && typeof latestTel.p === 'number') ? latestTel.p : 0;

        const customIcon = L.divIcon({
          className: 'custom-marker-container',
          html: `
            <div style="position: relative; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;">
              <span class="animate-ping" style="position: absolute; width: 20px; height: 20px; border-radius: 50%; background-color: ${markerColor}; opacity: 0.4;"></span>
              <span style="position: relative; width: 14px; height: 14px; border-radius: 50%; background-color: ${markerColor}; border: 2px solid #020617; box-shadow: 0 0 8px ${markerColor};"></span>
            </div>
          `,
          iconSize: [24, 24],
          iconAnchor: [12, 12]
        });

        const marker = L.marker([d.latitude, d.longitude], { icon: customIcon });

        const popupHtml = `
          <div style="color: #f1f5f9; background: #0f172a; border: 1px solid #1e293b; padding: 10px; border-radius: 12px; font-family: sans-serif; font-size: 11px; width: 160px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.5);">
            <strong style="display: block; font-size: 12px; color: #fff; margin-bottom: 2px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${d.name}</strong>
            <span style="color: #64748b; font-family: monospace; font-size: 9px; display: block; margin-bottom: 6px;">${d.serial_number}</span>
            <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
              <span style="color: #94a3b8;">Power:</span>
              <strong style="color: #fbbf24;">${powerVal.toFixed(1)} W</strong>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
              <span style="color: #94a3b8;">Status:</span>
              <strong style="color: ${markerColor}; text-transform: uppercase;">${d.status}</strong>
            </div>
            <button id="btn-popup-${d.id}" style="width: 100%; border: 0; background: #10b981; color: #020617; font-weight: bold; border-radius: 6px; padding: 6px; cursor: pointer; text-align: center; font-size: 10px; font-family: sans-serif;">Configure Node</button>
          </div>
        `;

        marker.bindPopup(popupHtml, {
          className: 'custom-leaflet-popup',
          closeButton: false,
          minWidth: 160
        });

        marker.on('popupopen', () => {
          const btn = document.getElementById(`btn-popup-${d.id}`);
          if (btn) {
            btn.onclick = () => {
              navigate(`/devices/${d.id}`);
            };
          }
        });

        markerGroupRef.current?.addLayer(marker);
      });
    }
  }, [devices, telemetry, navigate]);

  useEffect(() => {
    if (!isLiveMode) {
      const syncData = () => {
        setDevices([...mockDb.getDevices()]);
        const telMap: Record<string, Telemetry[]> = {};
        mockDb.getDevices().forEach(d => {
          telMap[d.id] = mockDb.getTelemetry(d.id);
        });
        setTelemetry(telMap);
      };

      syncData();
      const unsubscribe = mockDb.subscribe(syncData);
      return () => unsubscribe();
    } else {
      async function fetchFleetData() {
        const { data: devList } = await (supabase as any)
          .from('devices')
          .select('*')
          .order('created_at', { ascending: true });
          
        if (devList) {
          setDevices(devList as any);
          
          const telMap: Record<string, Telemetry[]> = {};
          await Promise.all(devList.map(async (d: any) => {
            const { data: telList } = await (supabase as any)
              .from('telemetry')
              .select('*')
              .eq('device_id', d.id)
              .order('timestamp', { ascending: false })
              .limit(50);
            
            if (telList) {
              telMap[d.id] = [...telList].reverse();
            } else {
              telMap[d.id] = [];
            }
          }));
          setTelemetry(telMap);
        }
      }

      fetchFleetData();

      // Subscribe to real-time telemetry updates for all trackers
      const telChannel = supabase
        .channel('realtime-fleet-telemetry')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'telemetry' }, (payload) => {
          const newTel = payload.new as Telemetry;
          setTelemetry(prev => {
            const list = prev[newTel.device_id] || [];
            if (list.length > 0 && list[list.length - 1].timestamp === newTel.timestamp) return prev;
            return {
              ...prev,
              [newTel.device_id]: [...list.slice(-49), newTel]
            };
          });
        })
        .subscribe();

      // Subscribe to device additions/status updates
      const devChannel = supabase
        .channel('realtime-fleet-devices')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'devices' }, () => {
          fetchFleetData();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(telChannel);
        supabase.removeChannel(devChannel);
      };
    }
  }, []);

  const handleAddDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDevName || !newDevSerial) return;
    
    if (!isLiveMode) {
      mockDb.addDevice({
        name: newDevName,
        serial_number: newDevSerial,
        latitude: parseFloat(newDevLat),
        longitude: parseFloat(newDevLng),
        status: 'online',
        current_firmware_version: 'v1.0.0'
      });
    } else {
      const { error } = await supabase.from('devices').insert({
        name: newDevName,
        serial_number: newDevSerial,
        latitude: parseFloat(newDevLat),
        longitude: parseFloat(newDevLng),
        status: 'online',
        current_firmware_version: 'v1.0.0'
      });

      if (error) {
        alert(`Failed to add device: ${(error as any).message}`);
        return;
      }
    }

    setNewDevName('');
    setNewDevSerial('');
    setShowAddModal(false);
  };

  // Aggregated calculations
  const totalNodes = devices.length;
  const onlineNodes = devices.filter(d => d.status === 'online').length;
  const faultNodes = devices.filter(d => d.status === 'fault').length;
  const offlineNodes = totalNodes - onlineNodes - faultNodes;

  let totalPowerToday = 0;
  devices.forEach(d => {
    const list = telemetry[d.id] || [];
    const latest = list[list.length - 1];
    if (latest && d.status === 'online') {
      totalPowerToday += latest.p || 0;
    }
  });

  return (
    <div className="relative min-h-screen bg-slate-950 p-8 font-sans">
      {/* Background neon flares */}
      <div className="absolute top-10 left-10 h-[300px] w-[300px] bg-cyan-500/5 rounded-full blur-3xl -z-10 animate-pulse" style={{ animationDuration: '8s' }} />
      <div className="absolute bottom-10 right-10 h-[300px] w-[300px] bg-amber-500/5 rounded-full blur-3xl -z-10 animate-pulse" style={{ animationDuration: '6s' }} />
      
      {/* 🔝 Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 pb-6 border-b border-slate-800/60 relative">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tighter uppercase text-glow-cyan">Fleet Operational Center</h1>
          <p className="text-cyan-400 font-mono text-[10px] tracking-widest mt-1.5 uppercase">SYS_FLEET_DASHBOARD_LIVE_STREAM</p>
        </div>
        
        {/* Add Device Button (Tech/Admin Only) */}
        {userRole !== 'Visitor' && (
          <button 
            onClick={() => setShowAddModal(true)}
            className="mt-4 md:mt-0 px-5 py-3 bg-gradient-to-r from-cyan-500 via-teal-500 to-emerald-500 hover:from-cyan-400 hover:via-teal-400 hover:to-emerald-400 text-slate-950 font-black uppercase tracking-wider rounded-xl text-xs flex items-center gap-1.5 transition duration-300 shadow-lg shadow-cyan-500/15 cursor-pointer"
          >
            <Plus className="h-4 w-4 stroke-[3]" /> Add Tracking Node
          </button>
        )}
      </div>

      {/* 📊 Fleet Stats Banner */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-6 mb-8">
        <div className="glass-card p-5 rounded-2xl border border-slate-850 hover:border-cyan-500/25 relative overflow-hidden group">
          <div className="absolute top-0 right-0 h-4 w-4 border-t border-r border-slate-800 group-hover:border-cyan-500/40 transition-colors" />
          <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest block font-bold">INV_TOTAL_NODES</span>
          <p className="text-4xl font-black text-white mt-1.5 tracking-tighter">{totalNodes}</p>
          <span className="text-[9px] text-slate-400 font-mono mt-1 block uppercase">REG_FLT_ASSETS</span>
        </div>
        <div className="glass-card p-5 rounded-2xl border border-slate-850 hover:border-emerald-500/25 relative overflow-hidden border-l-2 border-l-emerald-500 group">
          <div className="absolute top-0 right-0 h-4 w-4 border-t border-r border-slate-800 group-hover:border-emerald-500/40 transition-colors" />
          <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest block font-bold">SYS_HEALTHY_ONLINE</span>
          <p className="text-4xl font-black text-emerald-400 mt-1.5 tracking-tighter text-glow-cyan">{onlineNodes}</p>
          <span className="text-[9px] text-slate-400 font-mono mt-1 block uppercase">ACTUATOR_NOMINAL</span>
        </div>
        <div className="glass-card p-5 rounded-2xl border border-slate-850 hover:border-amber-500/25 relative overflow-hidden border-l-2 border-l-amber-500 group">
          <div className="absolute top-0 right-0 h-4 w-4 border-t border-r border-slate-800 group-hover:border-amber-500/40 transition-colors" />
          <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest block font-bold">SYS_FAULT_ALARMS</span>
          <p className="text-4xl font-black text-amber-400 mt-1.5 tracking-tighter text-glow-gold">{faultNodes}</p>
          <span className="text-[9px] text-slate-400 font-mono mt-1 block uppercase">ANOMALY_WARN_REG</span>
        </div>
        <div className="glass-card p-5 rounded-2xl border border-slate-850 hover:border-slate-700/25 relative overflow-hidden border-l-2 border-l-slate-700 group">
          <div className="absolute top-0 right-0 h-4 w-4 border-t border-r border-slate-800 group-hover:border-slate-500/40 transition-colors" />
          <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest block font-bold">SYS_OFFLINE_NODES</span>
          <p className="text-4xl font-black text-slate-400 mt-1.5 tracking-tighter">{offlineNodes}</p>
          <span className="text-[9px] text-slate-400 font-mono mt-1 block uppercase">COMMS_TIMEOUT</span>
        </div>
        <div className="col-span-2 md:col-span-1 glass-card p-5 rounded-2xl border border-slate-850 hover:border-yellow-500/25 relative overflow-hidden group">
          <div className="absolute top-0 right-0 h-4 w-4 border-t border-r border-slate-800 group-hover:border-yellow-500/40 transition-colors" />
          <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest block font-bold">ACTIVE_FLEET_GEN</span>
          <p className="text-4xl font-black text-yellow-400 mt-1.5 tracking-tighter text-glow-gold">
            {(totalPowerToday / 1000).toFixed(2)} <span className="text-sm text-slate-500 font-normal">kW</span>
          </p>
          <span className="text-[9px] text-slate-400 font-mono mt-1 block uppercase">YIELD_GAIN_MEASURE</span>
        </div>
      </div>

      {/* 🗺️ Fleet Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Interactive Map Grid */}
        <div className="lg:col-span-2 glass-panel p-6 rounded-3xl space-y-5 hover:border-cyan-500/30 relative overflow-hidden transition duration-300">
          <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-cyan-500" />
          <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-cyan-500" />
          <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-cyan-500" />
          <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-cyan-500" />
          
          <div className="flex justify-between items-center border-b border-slate-850 pb-3">
            <div>
              <h2 className="text-base font-black text-white flex items-center gap-2 uppercase tracking-wide">
                <Map className="text-cyan-400 h-5 w-5 text-glow-cyan" /> Indian Grid Fleet Map
              </h2>
              <p className="text-[10px] text-slate-500 font-mono mt-0.5">GEOSPATIAL_EDGE_VECTOR_COORDINATES</p>
            </div>
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          </div>

          {/* Real Leaflet Map Container */}
          <div className="relative aspect-video w-full border border-cyan-500/25 neon-border-cyan rounded-2xl overflow-hidden bg-slate-950 shadow-2xl z-10">
            <div ref={mapRef} className="w-full h-full" />
            
            {/* Legend layout overlays (placed higher z-index to hover correctly on top of Leaflet) */}
            <div className="absolute bottom-4 right-4 bg-slate-950/95 border border-slate-800 p-2.5 rounded-lg text-[9px] text-slate-400 space-y-1.5 z-20 pointer-events-none font-mono">
              <div className="flex items-center gap-1.5 font-bold"><span className="h-2 w-2 rounded-full bg-emerald-500" /> ONLINE_NOMINAL</div>
              <div className="flex items-center gap-1.5 font-bold"><span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" /> FAULT_WARNING</div>
              <div className="flex items-center gap-1.5 font-bold"><span className="h-2 w-2 rounded-full bg-slate-600" /> COMMS_TIMEOUT</div>
            </div>
          </div>
        </div>

        {/* Right Sidebar: Inventory & Group Control */}
        <div className="space-y-8 lg:col-span-1">
          
          {/* Fleet Node List Card */}
          <div className="glass-panel p-6 rounded-3xl relative overflow-hidden hover:border-emerald-500/20 transition duration-300 flex flex-col justify-between">
            <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-emerald-500" />
            <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-emerald-500" />
            <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-emerald-500" />
            <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-emerald-500" />

            <div className="space-y-4">
              <div>
                <h2 className="text-base font-black text-white flex items-center gap-2 uppercase tracking-wide">
                  <Activity className="text-emerald-500 h-5 w-5" /> Device Inventory ({devices.length})
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">Select node for metrics & override commands.</p>
              </div>

              <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                {devices.map(d => {
                  const telList = telemetry[d.id] || [];
                  const latest = telList[telList.length - 1];
                  const power = (latest && typeof latest.p === 'number') ? latest.p : 0;
                  const tempVal = (latest && typeof latest.temp === 'number') ? latest.temp : 25;

                  return (
                    <button
                      key={d.id}
                      onClick={() => navigate(`/devices/${d.id}`)}
                      className="w-full p-4 bg-slate-950/40 hover:bg-cyan-500/5 border border-slate-850 hover:border-cyan-500/30 rounded-xl transition duration-300 flex items-center justify-between text-left group cursor-pointer"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className={`h-2 w-2 rounded-full ${
                            d.status === 'online' ? 'bg-emerald-500' : d.status === 'fault' ? 'bg-amber-500 animate-pulse' : 'bg-slate-600'
                          }`} />
                          <h4 className="text-xs font-black text-white group-hover:text-cyan-400 uppercase tracking-wider transition">{d.name}</h4>
                        </div>
                        <p className="text-[10px] text-slate-500 font-mono">{d.serial_number}</p>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right text-[10px] space-y-0.5">
                          <div className="font-bold text-white group-hover:text-cyan-400 transition">{power.toFixed(1)}W</div>
                          <div className="text-slate-500 font-mono">{tempVal.toFixed(0)}°C</div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-slate-600 group-hover:text-white transition group-hover:translate-x-0.5" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="bg-slate-950/70 p-3.5 border border-slate-850 rounded-xl mt-6 text-center text-[10px] text-slate-400 leading-normal font-mono uppercase tracking-wider">
              ⚙️ Realtime CDC active via Supabase channels.
            </div>
          </div>

          {/* Fleet Group Operations Card */}
          <div className="glass-panel p-6 rounded-3xl relative overflow-hidden hover:border-cyan-500/20 transition duration-300 flex flex-col justify-between">
            <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-cyan-500" />
            <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-cyan-500" />
            <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-cyan-500" />
            <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-cyan-500" />

            <div className="space-y-4">
              <div>
                <h2 className="text-base font-black text-white flex items-center gap-2 uppercase tracking-wide">
                  <Sliders className="text-cyan-400 h-5 w-5" /> Fleet Group Operations
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">Deploy synchronized overrides to all active trackers.</p>
              </div>

              {userRole === 'Visitor' ? (
                <div className="p-4 bg-slate-950/60 border border-slate-850 rounded-2xl text-slate-500 text-xs font-semibold text-center flex flex-col items-center justify-center gap-2 h-36">
                  <ShieldAlert className="h-6 w-6 text-rose-500/50" />
                  <span className="uppercase font-mono text-[10px] tracking-wider">Group controls locked.<br/>Requires Technician or Admin.</span>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => triggerGroupAction('stow')}
                    className="flex flex-col items-center justify-center py-3.5 px-2 bg-slate-950/50 border border-slate-850 hover:border-emerald-500/40 hover:bg-emerald-500/5 rounded-xl transition duration-300 text-center text-[10px] uppercase font-bold text-slate-300 cursor-pointer group"
                  >
                    <Wind className="h-5 w-5 mb-1.5 text-emerald-400 group-hover:scale-110 transition duration-350" />
                    <span>Stow All</span>
                  </button>

                  <button
                    onClick={() => triggerGroupAction('clean')}
                    className="flex flex-col items-center justify-center py-3.5 px-2 bg-slate-950/50 border border-slate-850 hover:border-blue-500/40 hover:bg-blue-500/5 rounded-xl transition duration-300 text-center text-[10px] uppercase font-bold text-slate-300 cursor-pointer group"
                  >
                    <RotateCw className="h-5 w-5 mb-1.5 text-blue-400 group-hover:rotate-45 transition duration-350" />
                    <span>Clean All</span>
                  </button>

                  <button
                    onClick={() => triggerGroupAction('reboot')}
                    className="flex flex-col items-center justify-center py-3.5 px-2 bg-slate-950/50 border border-slate-850 hover:border-rose-500/40 hover:bg-rose-500/5 rounded-xl transition duration-300 text-center text-[10px] uppercase font-bold text-slate-300 cursor-pointer group"
                  >
                    <Cpu className="h-5 w-5 mb-1.5 text-rose-400 group-hover:scale-110 transition duration-350" />
                    <span>Reboot All</span>
                  </button>

                  <button
                    onClick={() => triggerGroupAction('resolve_all')}
                    className="flex flex-col items-center justify-center py-3.5 px-2 bg-slate-950/50 border border-slate-850 hover:border-amber-500/40 hover:bg-amber-500/5 rounded-xl transition duration-300 text-center text-[10px] uppercase font-bold text-slate-300 cursor-pointer group"
                  >
                    <Check className="h-5 w-5 mb-1.5 text-amber-400 group-hover:scale-110 transition duration-350" />
                    <span>Clear Faults</span>
                  </button>
                </div>
              )}
            </div>

            {commandStatus && (
              <div className="mt-4 p-3 bg-slate-950/90 border border-cyan-500/20 rounded-xl text-[10px] font-mono text-cyan-400 flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <span className="h-2 w-2 rounded-full bg-cyan-400 animate-ping shrink-0" />
                <span>{commandStatus}</span>
              </div>
            )}
          </div>

        </div>

      </div>

      {/* ➕ Add Device Modal Form (Conditional Overlay) */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-6">
          <div className="glass-panel p-8 rounded-3xl w-full max-w-md relative overflow-hidden border border-cyan-500/30 shadow-2xl shadow-cyan-500/5 animate-in fade-in zoom-in duration-200">
            <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-cyan-400" />
            <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-cyan-400" />
            <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-cyan-400" />
            <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-cyan-400" />
            
            <button 
              onClick={() => setShowAddModal(false)}
              className="absolute top-4 right-4 text-xs font-bold text-slate-500 hover:text-white uppercase font-mono tracking-wider cursor-pointer"
            >
              Close [X]
            </button>

            <div className="mb-6">
              <h2 className="text-xl font-black text-white uppercase tracking-wider text-glow-cyan">Register Tracker Node</h2>
              <p className="text-xs text-slate-400 mt-1">Register the ESP32-C6 device identification to start telemetry ingestion.</p>
            </div>

            <form onSubmit={handleAddDevice} className="space-y-5 text-left">
              <div>
                <label htmlFor="dev-name-input" className="block text-xs uppercase font-extrabold text-slate-400 mb-1.5 tracking-wider font-mono">Device Name</label>
                <input 
                  type="text" 
                  id="dev-name-input"
                  value={newDevName}
                  onChange={(e) => setNewDevName(e.target.value)}
                  placeholder="e.g. Pune Tech Farm Tracker #04"
                  required
                  className="w-full rounded-xl px-4 py-3 text-xs text-slate-200 focus:outline-none glass-input"
                />
              </div>

              <div>
                <label htmlFor="dev-serial-input" className="block text-xs uppercase font-extrabold text-slate-400 mb-1.5 tracking-wider font-mono">Hardware Serial ID</label>
                <input 
                  type="text" 
                  id="dev-serial-input"
                  value={newDevSerial}
                  onChange={(e) => setNewDevSerial(e.target.value)}
                  placeholder="e.g. SM-ESP32-PN04"
                  required
                  className="w-full rounded-xl px-4 py-3 text-xs text-slate-200 focus:outline-none glass-input"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="dev-lat-input" className="block text-xs uppercase font-extrabold text-slate-400 mb-1.5 tracking-wider font-mono">Latitude</label>
                  <input 
                    type="number" 
                    id="dev-lat-input"
                    step="0.0001"
                    value={newDevLat}
                    onChange={(e) => setNewDevLat(e.target.value)}
                    required
                    className="w-full rounded-xl px-4 py-3 text-xs text-slate-200 focus:outline-none glass-input"
                  />
                </div>
                <div>
                  <label htmlFor="dev-lng-input" className="block text-xs uppercase font-extrabold text-slate-400 mb-1.5 tracking-wider font-mono">Longitude</label>
                  <input 
                    type="number" 
                    id="dev-lng-input"
                    step="0.0001"
                    value={newDevLng}
                    onChange={(e) => setNewDevLng(e.target.value)}
                    required
                    className="w-full rounded-xl px-4 py-3 text-xs text-slate-200 focus:outline-none glass-input"
                  />
                </div>
              </div>

              <button 
                type="submit"
                className="w-full py-3.5 mt-4 bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 font-black text-xs uppercase tracking-widest rounded-xl transition duration-300 shadow-lg shadow-cyan-500/15 cursor-pointer"
              >
                Configure Ingestion Pipeline
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
