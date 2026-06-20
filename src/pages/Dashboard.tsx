// src/pages/Dashboard.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { mockDb } from '../services/mockDb';
import type { Device, Telemetry } from '../services/mockDb';
import { supabase, isLiveMode } from '../services/supabase';
import { sendDeviceCommand } from '../services/controlActions';
import {
  Activity, ChevronRight, Plus, Map, Wind, RotateCw, Cpu, Check, ShieldAlert,
  Sliders, Search, X, Zap, RefreshCw, AlertTriangle
} from 'lucide-react';
import L from 'leaflet';

interface DashboardProps {
  userRole: 'Visitor' | 'End-User' | 'Technician' | 'Admin';
}

/* ─── Confirm Dialog ─── */
interface ConfirmDialogProps {
  action: string;
  onConfirm: () => void;
  onCancel: () => void;
}
function ConfirmDialog({ action, onConfirm, onCancel }: ConfirmDialogProps) {
  const labels: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    stow:        { label: 'Stow All Panels',     color: 'text-emerald-600 border-emerald-300', icon: <Wind className="h-5 w-5 text-emerald-600" /> },
    clean:       { label: 'Clean All Panels',    color: 'text-blue-600 border-blue-300',       icon: <RotateCw className="h-5 w-5 text-blue-600" /> },
    reboot:      { label: 'Reboot All Nodes',    color: 'text-rose-600 border-rose-300',       icon: <Cpu className="h-5 w-5 text-rose-600" /> },
    resolve_all: { label: 'Clear All Faults',    color: 'text-amber-600 border-amber-300',     icon: <Check className="h-5 w-5 text-amber-600" /> },
  };
  const info = labels[action] || { label: action, color: 'text-slate-600 border-slate-300', icon: null };

  return (
    <div className="confirm-overlay animate-fade-in-up" onClick={onCancel}>
      <div
        className="glass-panel bg-white rounded-3xl p-8 max-w-sm w-full border border-slate-200 shadow-2xl animate-bounce-in"
        onClick={e => e.stopPropagation()}
      >
        <div className={`flex items-center gap-3 mb-5 p-4 rounded-2xl border bg-slate-50 ${info.color}`}>
          {info.icon}
          <div>
            <p className="text-xs font-black uppercase tracking-wider">{info.label}</p>
            <p className="text-[10px] text-slate-500 mt-0.5 font-mono">Fleet-wide group action</p>
          </div>
        </div>
        <p className="text-sm text-slate-700 leading-relaxed mb-6">
          This will dispatch <strong className="text-slate-900">"{info.label}"</strong> to all active tracker nodes simultaneously.
          Are you sure you want to proceed?
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 border border-slate-200 text-slate-600 text-xs font-black uppercase rounded-xl hover:bg-slate-50 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 bg-gradient-to-r from-cyan-600 to-emerald-600 text-white text-xs font-black uppercase rounded-xl hover:opacity-90 transition cursor-pointer shadow-md"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard({ userRole }: DashboardProps) {
  const [devices, setDevices] = useState<Device[]>([]);
  const [telemetry, setTelemetry] = useState<Record<string, Telemetry[]>>({});
  const [showAddModal, setShowAddModal] = useState(false);
  const [newDevName, setNewDevName] = useState('');
  const [newDevSerial, setNewDevSerial] = useState('');
  const [newDevLat, setNewDevLat] = useState('19.0760');
  const [newDevLng, setNewDevLng] = useState('72.8777');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [commandStatus, setCommandStatus] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const navigate = useNavigate();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const markerGroupRef = useRef<L.LayerGroup | null>(null);

  // Initialize Map
  useEffect(() => {
    if (mapRef.current && !mapInstance.current) {
      const map = L.map(mapRef.current, { zoomControl: true, scrollWheelZoom: true })
        .setView([20.5937, 78.9629], 5);

      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
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

  // Update Markers + auto-fit bounds
  useEffect(() => {
    if (!mapInstance.current || !markerGroupRef.current) return;
    markerGroupRef.current.clearLayers();

    const bounds: [number, number][] = [];

    devices.forEach(d => {
      const markerColor = d.status === 'online' ? '#10b981' : d.status === 'fault' ? '#f59e0b' : '#64748b';
      const latestTel = telemetry[d.id]?.[telemetry[d.id].length - 1];
      const powerVal = (latestTel && typeof latestTel.p === 'number') ? latestTel.p : 0;

      const customIcon = L.divIcon({
        className: 'custom-marker-container',
        html: `<div style="position:relative;width:24px;height:24px;display:flex;align-items:center;justify-content:center;">
          <span class="animate-ping" style="position:absolute;width:20px;height:20px;border-radius:50%;background-color:${markerColor};opacity:0.35;"></span>
          <span style="position:relative;width:14px;height:14px;border-radius:50%;background-color:${markerColor};border:2px solid #fff;box-shadow:0 0 8px ${markerColor};"></span>
        </div>`,
        iconSize: [24, 24], iconAnchor: [12, 12]
      });

      const marker = L.marker([d.latitude, d.longitude], { icon: customIcon });
      const popupHtml = `
        <div style="color:#1e293b;background:#ffffff;border:1px solid #cbd5e1;padding:12px;border-radius:14px;font-family:sans-serif;font-size:11px;width:168px;box-shadow:0 10px 30px rgba(0,0,0,0.1);">
          <strong style="display:block;font-size:12px;color:#0f172a;margin-bottom:2px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;">${d.name}</strong>
          <span style="color:#64748b;font-family:monospace;font-size:9px;display:block;margin-bottom:8px;">${d.serial_number}</span>
          <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
            <span style="color:#64748b;">Power:</span>
            <strong style="color:#d97706;">${powerVal.toFixed(1)} W</strong>
          </div>
          <div style="display:flex;justify-content:space-between;margin-bottom:10px;">
            <span style="color:#64748b;">Status:</span>
            <strong style="color:${markerColor};text-transform:uppercase;">${d.status}</strong>
          </div>
          <button id="btn-popup-${d.id}" style="width:100%;border:0;background:linear-gradient(90deg,#0891b2,#10b981);color:#fff;font-weight:bold;border-radius:8px;padding:7px;cursor:pointer;font-size:10px;">
            Configure Node →
          </button>
        </div>`;

      marker.bindPopup(popupHtml, { className: 'custom-leaflet-popup', closeButton: false, minWidth: 168 });
      marker.on('popupopen', () => {
        const btn = document.getElementById(`btn-popup-${d.id}`);
        if (btn) btn.onclick = () => navigate(`/devices/${d.id}`);
      });
      markerGroupRef.current?.addLayer(marker);
      bounds.push([d.latitude, d.longitude]);
    });

    // Auto-fit map to device bounds
    if (bounds.length > 0 && mapInstance.current) {
      try {
        mapInstance.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 10 });
      } catch (_) {}
    }
  }, [devices, telemetry, navigate]);

  // Data sync
  useEffect(() => {
    if (!isLiveMode) {
      const syncData = () => {
        setDevices([...mockDb.getDevices()]);
        const telMap: Record<string, Telemetry[]> = {};
        mockDb.getDevices().forEach(d => {
          telMap[d.id] = mockDb.getTelemetry(d.id);
        });
        setTelemetry(telMap);
        setLastUpdated(new Date());
      };
      syncData();
      return mockDb.subscribe(syncData);
    } else {
      const fetchFleetData = async () => {
        const { data: devList } = await (supabase as any).from('devices').select('*').order('created_at', { ascending: true });
        if (devList) {
          setDevices(devList as any);
          const telMap: Record<string, Telemetry[]> = {};
          await Promise.all(devList.map(async (d: any) => {
            const { data: telList } = await (supabase as any).from('telemetry').select('*').eq('device_id', d.id).order('timestamp', { ascending: false }).limit(50);
            telMap[d.id] = telList ? [...telList].reverse() : [];
          }));
          setTelemetry(telMap);
          setLastUpdated(new Date());
        }
      };
      fetchFleetData();
      const telCh = supabase.channel('realtime-fleet-telemetry')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'telemetry' }, (payload) => {
          const t = payload.new as Telemetry;
          setTelemetry(prev => ({
            ...prev,
            [t.device_id]: [...(prev[t.device_id] || []).slice(-49), t]
          }));
          setLastUpdated(new Date());
        }).subscribe();
      const devCh = supabase.channel('realtime-fleet-devices')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'devices' }, fetchFleetData)
        .subscribe();
      return () => { supabase.removeChannel(telCh); supabase.removeChannel(devCh); };
    }
  }, []);

  // Group action executor
  const executeGroupAction = useCallback(async (action: string) => {
    setPendingAction(null);
    setCommandStatus(`Dispatching "${action.toUpperCase()}" to all active nodes…`);
    try {
      if (action === 'resolve_all') {
        if (!isLiveMode) {
          mockDb.getAlerts().filter(a => !a.is_resolved).forEach(a => mockDb.resolveAlert(a.id));
        } else {
          await supabase.from('alerts').update({ is_resolved: true, resolved_at: new Date().toISOString() }).eq('is_resolved', false);
          await supabase.from('devices').update({ status: 'online' }).eq('status', 'fault');
        }
        setCommandStatus('✅ All active fleet anomalies have been cleared.');
      } else {
        const targets = devices.filter(d => d.status !== 'offline');
        await Promise.all(targets.map(async (dev) => {
          if (!isLiveMode) mockDb.insertCommand(dev.id, action as any, { scope: 'fleet-group' });
          await sendDeviceCommand(dev.id, action as any, { scope: 'fleet-group' });
        }));
        setCommandStatus(`✅ Group command "${action.toUpperCase()}" dispatched to ${targets.length} active trackers.`);
      }
    } catch (err: any) {
      setCommandStatus(`❌ Group command failed: ${err.message}`);
    }
    setTimeout(() => setCommandStatus(null), 5000);
  }, [devices]);

  // Validate and add device
  const handleAddDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};
    if (!newDevName.trim()) errors.name = 'Device name is required.';
    if (!newDevSerial.trim()) errors.serial = 'Serial ID is required.';
    const lat = parseFloat(newDevLat);
    const lng = parseFloat(newDevLng);
    if (isNaN(lat) || lat < -90 || lat > 90) errors.lat = 'Latitude must be between -90 and 90.';
    if (isNaN(lng) || lng < -180 || lng > 180) errors.lng = 'Longitude must be between -180 and 180.';
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    if (!isLiveMode) {
      mockDb.addDevice({ name: newDevName, serial_number: newDevSerial, latitude: lat, longitude: lng, status: 'online', current_firmware_version: 'v1.0.0' });
    } else {
      const { error } = await supabase.from('devices').insert({ name: newDevName, serial_number: newDevSerial, latitude: lat, longitude: lng, status: 'online', current_firmware_version: 'v1.0.0' }) as any;
      if (error) { alert(`Failed to add device: ${error.message}`); return; }
    }
    setNewDevName(''); setNewDevSerial(''); setShowAddModal(false); setFormErrors({});
  };

  // Aggregated stats
  const totalNodes   = devices.length;
  const onlineNodes  = devices.filter(d => d.status === 'online').length;
  const faultNodes   = devices.filter(d => d.status === 'fault').length;
  const offlineNodes = totalNodes - onlineNodes - faultNodes;

  let totalPowerNow = 0;
  devices.forEach(d => {
    const list = telemetry[d.id] || [];
    const latest = list[list.length - 1];
    if (latest && d.status === 'online') totalPowerNow += latest.p || 0;
  });

  const totalEnergyToday = isLiveMode ? 0 : mockDb.getTotalFleetEnergyToday();

  // Filtered device list
  const filteredDevices = devices.filter(d =>
    !searchQuery || d.name.toLowerCase().includes(searchQuery.toLowerCase()) || d.serial_number.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Last-updated ticker
  const [secondsAgo, setSecondsAgo] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setSecondsAgo(Math.floor((Date.now() - lastUpdated.getTime()) / 1000)), 1000);
    return () => clearInterval(t);
  }, [lastUpdated]);

  return (
    <div className="relative min-h-screen bg-slate-50 p-6 md:p-8 font-sans">
      {/* Background flares */}
      <div className="absolute top-10 left-10 h-[300px] w-[300px] bg-cyan-500/8 rounded-full blur-3xl -z-10 animate-pulse" style={{ animationDuration: '8s' }} />
      <div className="absolute bottom-10 right-10 h-[300px] w-[300px] bg-amber-500/8 rounded-full blur-3xl -z-10 animate-pulse" style={{ animationDuration: '6s' }} />

      {/* Confirm Dialog */}
      {pendingAction && (
        <ConfirmDialog
          action={pendingAction}
          onConfirm={() => executeGroupAction(pendingAction)}
          onCancel={() => setPendingAction(null)}
        />
      )}

      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 pb-6 border-b border-slate-200">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase">Fleet Operational Center</h1>
          <div className="flex items-center gap-3 mt-1.5">
            <p className="text-cyan-600 font-mono text-[10px] tracking-widest uppercase">SYS_FLEET_DASHBOARD_LIVE_STREAM</p>
            <span className="flex items-center gap-1 text-[10px] text-slate-400 font-mono">
              <RefreshCw className="h-3 w-3 animate-spin-slow" />
              Updated {secondsAgo}s ago
            </span>
          </div>
        </div>
        {userRole !== 'Visitor' && (
          <button
            onClick={() => setShowAddModal(true)}
            className="mt-4 md:mt-0 px-5 py-3 bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 text-white font-black uppercase tracking-wider rounded-xl text-xs flex items-center gap-1.5 transition duration-300 shadow-md cursor-pointer"
          >
            <Plus className="h-4 w-4 stroke-[3]" /> Add Tracking Node
          </button>
        )}
      </div>

      {/* ── Fleet Stats Banner ── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-5 mb-8">
        {[
          { label: 'INV_TOTAL_NODES',    value: totalNodes,   sub: 'REG_FLT_ASSETS',      color: 'hover:border-cyan-300',    accent: '', textColor: 'text-slate-900' },
          { label: 'SYS_HEALTHY_ONLINE', value: onlineNodes,  sub: 'ACTUATOR_NOMINAL',    color: 'hover:border-emerald-300', accent: 'border-l-2 border-l-emerald-500', textColor: 'text-emerald-600' },
          { label: 'SYS_FAULT_ALARMS',   value: faultNodes,   sub: 'ANOMALY_WARN_REG',    color: 'hover:border-amber-300',   accent: 'border-l-2 border-l-amber-500',   textColor: 'text-amber-600' },
          { label: 'SYS_OFFLINE_NODES',  value: offlineNodes, sub: 'COMMS_TIMEOUT',       color: 'hover:border-slate-300',   accent: 'border-l-2 border-l-slate-400',   textColor: 'text-slate-600' },
        ].map(({ label, value, sub, color, accent, textColor }) => (
          <div key={label} className={`glass-panel p-5 rounded-2xl border border-slate-200 relative overflow-hidden group shadow-sm bg-white transition duration-300 ${color} ${accent}`}>
            <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest block font-bold">{label}</span>
            <p className={`text-4xl font-black mt-1.5 tracking-tighter ${textColor}`}>{value}</p>
            <span className="text-[9px] text-slate-400 font-mono mt-1 block uppercase">{sub}</span>
          </div>
        ))}

        {/* Power + Energy */}
        <div className="col-span-2 md:col-span-1 glass-panel p-5 rounded-2xl border border-slate-200 hover:border-yellow-300 relative overflow-hidden group shadow-sm bg-white transition duration-300 space-y-1">
          <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest block font-bold">ACTIVE_FLEET_GEN</span>
          <p className="text-3xl font-black text-amber-600 tracking-tighter">
            {(totalPowerNow / 1000).toFixed(2)} <span className="text-sm text-slate-400 font-normal font-sans">kW</span>
          </p>
          {totalEnergyToday > 0 && (
            <div className="flex items-center gap-1 text-[10px] text-emerald-600 font-mono font-bold">
              <Zap className="h-3 w-3" />
              {totalEnergyToday.toFixed(2)} Wh today
            </div>
          )}
          <span className="text-[9px] text-slate-400 font-mono block uppercase">YIELD_GAIN_MEASURE</span>
        </div>
      </div>

      {/* ── Layout Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-7">

        {/* Interactive Map */}
        <div className="lg:col-span-2 glass-panel p-6 rounded-3xl space-y-5 border border-slate-200 hover:border-cyan-300 transition duration-300 shadow-sm bg-white relative overflow-hidden">
          <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-cyan-500" />
          <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-cyan-500" />
          <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-cyan-500" />
          <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-cyan-500" />

          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-sm font-black text-slate-900 flex items-center gap-2 uppercase tracking-wide">
                <Map className="text-cyan-600 h-5 w-5" /> Indian Grid Fleet Map
              </h2>
              <p className="text-[10px] text-slate-400 font-mono mt-0.5">GEOSPATIAL_EDGE_VECTOR_COORDINATES</p>
            </div>
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          </div>

          <div className="relative aspect-video w-full border border-slate-200 rounded-2xl overflow-hidden bg-slate-50 shadow-inner z-10">
            <div ref={mapRef} className="w-full h-full" />
            <div className="absolute bottom-3 right-3 bg-white/95 border border-slate-200 p-2 rounded-xl text-[9px] text-slate-500 space-y-1.5 z-20 pointer-events-none font-mono shadow-sm">
              <div className="flex items-center gap-1.5 font-bold"><span className="h-2 w-2 rounded-full bg-emerald-500" /> ONLINE_NOMINAL</div>
              <div className="flex items-center gap-1.5 font-bold"><span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" /> FAULT_WARNING</div>
              <div className="flex items-center gap-1.5 font-bold"><span className="h-2 w-2 rounded-full bg-slate-400" /> COMMS_TIMEOUT</div>
            </div>
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="space-y-6 lg:col-span-1">

          {/* Device Inventory */}
          <div className="glass-panel p-6 rounded-3xl border border-slate-200 hover:border-emerald-300 transition duration-300 shadow-sm bg-white relative overflow-hidden">
            <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-emerald-500" />
            <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-emerald-500" />
            <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-emerald-500" />
            <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-emerald-500" />

            <div className="space-y-4">
              <div>
                <h2 className="text-sm font-black text-slate-900 flex items-center gap-2 uppercase tracking-wide">
                  <Activity className="text-emerald-600 h-5 w-5" /> Device Inventory ({devices.length})
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">Select node for metrics & override commands.</p>
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search nodes…"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 text-xs rounded-xl glass-input focus:outline-none"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="absolute right-3 top-2.5 text-slate-300 hover:text-slate-600">
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>

              <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
                {filteredDevices.length === 0 ? (
                  <p className="text-[10px] text-slate-400 font-mono text-center py-4 uppercase tracking-wider">
                    {searchQuery ? 'No nodes match your search.' : 'No devices registered.'}
                  </p>
                ) : filteredDevices.map(d => {
                  const telList = telemetry[d.id] || [];
                  const latest = telList[telList.length - 1];
                  const power = latest?.p || 0;
                  const tempVal = latest?.temp || 25;
                  return (
                    <button
                      key={d.id}
                      onClick={() => navigate(`/devices/${d.id}`)}
                      className="w-full p-3.5 bg-slate-50 hover:bg-cyan-50 border border-slate-200 hover:border-cyan-300 rounded-xl transition duration-200 flex items-center justify-between text-left group cursor-pointer shadow-sm"
                    >
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`h-2 w-2 rounded-full shrink-0 ${
                            d.status === 'online' ? 'bg-emerald-500' : d.status === 'fault' ? 'bg-amber-500 animate-pulse' : 'bg-slate-400'
                          }`} />
                          <h4 className="text-[10px] font-black text-slate-800 group-hover:text-cyan-600 uppercase tracking-wider transition truncate">{d.name}</h4>
                        </div>
                        <p className="text-[9px] text-slate-400 font-mono pl-4">{d.serial_number}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="text-right text-[10px] space-y-0.5">
                          <div className="font-bold text-slate-700 group-hover:text-cyan-600 transition">{power.toFixed(1)}W</div>
                          <div className="text-slate-400 font-mono">{tempVal.toFixed(0)}°C</div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-slate-600 transition group-hover:translate-x-0.5" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="bg-slate-50 p-3 border border-slate-200 rounded-xl mt-4 text-center text-[9px] text-slate-400 font-mono uppercase tracking-wider">
              ⚙️ Realtime CDC active via Supabase channels.
            </div>
          </div>

          {/* Fleet Group Operations */}
          <div className="glass-panel p-6 rounded-3xl border border-slate-200 hover:border-cyan-300 transition duration-300 shadow-sm bg-white relative overflow-hidden">
            <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-cyan-500" />
            <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-cyan-500" />
            <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-cyan-500" />
            <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-cyan-500" />

            <div className="space-y-4">
              <div>
                <h2 className="text-sm font-black text-slate-900 flex items-center gap-2 uppercase tracking-wide">
                  <Sliders className="text-cyan-600 h-5 w-5" /> Fleet Group Operations
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">Deploy synchronized overrides to all active trackers.</p>
              </div>

              {userRole === 'Visitor' ? (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-center flex flex-col items-center gap-2 h-28 justify-center">
                  <ShieldAlert className="h-5 w-5 text-rose-400/60" />
                  <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                    Group controls locked.<br />Requires Technician or Admin.
                  </span>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2.5">
                  {[
                    { action: 'stow',        icon: <Wind className="h-5 w-5 mb-1 text-emerald-600" />,  label: 'Stow All',    hover: 'hover:border-emerald-400/50 hover:bg-emerald-50' },
                    { action: 'clean',       icon: <RotateCw className="h-5 w-5 mb-1 text-blue-600" />,  label: 'Clean All',   hover: 'hover:border-blue-400/50 hover:bg-blue-50' },
                    { action: 'reboot',      icon: <Cpu className="h-5 w-5 mb-1 text-rose-600" />,       label: 'Reboot All',  hover: 'hover:border-rose-400/50 hover:bg-rose-50' },
                    { action: 'resolve_all', icon: <Check className="h-5 w-5 mb-1 text-amber-600" />,    label: 'Clear Faults',hover: 'hover:border-amber-400/50 hover:bg-amber-50' },
                  ].map(({ action, icon, label, hover }) => (
                    <button
                      key={action}
                      onClick={() => setPendingAction(action)}
                      className={`flex flex-col items-center justify-center py-3 px-2 bg-white border border-slate-200 text-slate-700 rounded-xl transition duration-200 text-center text-[10px] uppercase font-bold cursor-pointer group shadow-sm ${hover}`}
                    >
                      <div className="group-hover:scale-110 transition duration-200">{icon}</div>
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {commandStatus && (
              <div className="mt-4 p-3 bg-cyan-50 border border-cyan-200 rounded-xl text-[10px] font-mono text-cyan-700 flex items-center gap-2 shadow-sm animate-fade-in-up">
                <span className="h-2 w-2 rounded-full bg-cyan-500 animate-ping shrink-0" />
                <span>{commandStatus}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Add Device Modal ── */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-md flex items-center justify-center p-6" onClick={() => setShowAddModal(false)}>
          <div className="glass-panel p-8 rounded-3xl w-full max-w-md border border-slate-200 bg-white shadow-2xl animate-fade-in-up" onClick={e => e.stopPropagation()}>
            <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-cyan-500" />
            <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-cyan-500" />
            <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-cyan-500" />
            <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-cyan-500" />

            <button onClick={() => setShowAddModal(false)} className="absolute top-4 right-4 p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700 transition cursor-pointer">
              <X className="h-4 w-4" />
            </button>

            <div className="mb-6">
              <h2 className="text-xl font-black text-slate-900 uppercase tracking-wider">Register Tracker Node</h2>
              <p className="text-xs text-slate-400 mt-1">Register the ESP32-C6 device to start telemetry ingestion.</p>
            </div>

            <form onSubmit={handleAddDevice} className="space-y-4 text-left">
              <div>
                <label className="block text-xs uppercase font-extrabold text-slate-500 mb-1.5 tracking-wider font-mono">Device Name</label>
                <input type="text" value={newDevName} onChange={e => setNewDevName(e.target.value)}
                  placeholder="e.g. Pune Tech Farm Tracker #04" required
                  className={`w-full rounded-xl px-4 py-3 text-xs focus:outline-none glass-input ${formErrors.name ? 'error' : ''}`} />
                {formErrors.name && <p className="text-[10px] text-rose-500 mt-1 font-mono">{formErrors.name}</p>}
              </div>

              <div>
                <label className="block text-xs uppercase font-extrabold text-slate-500 mb-1.5 tracking-wider font-mono">Hardware Serial ID</label>
                <input type="text" value={newDevSerial} onChange={e => setNewDevSerial(e.target.value)}
                  placeholder="e.g. SM-ESP32-PN04" required
                  className={`w-full rounded-xl px-4 py-3 text-xs focus:outline-none glass-input ${formErrors.serial ? 'error' : ''}`} />
                {formErrors.serial && <p className="text-[10px] text-rose-500 mt-1 font-mono">{formErrors.serial}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs uppercase font-extrabold text-slate-500 mb-1.5 tracking-wider font-mono">Latitude</label>
                  <input type="number" step="0.0001" value={newDevLat} onChange={e => setNewDevLat(e.target.value)}
                    min="-90" max="90" required
                    className={`w-full rounded-xl px-4 py-3 text-xs focus:outline-none glass-input ${formErrors.lat ? 'error' : ''}`} />
                  {formErrors.lat && <p className="text-[10px] text-rose-500 mt-1 font-mono">{formErrors.lat}</p>}
                </div>
                <div>
                  <label className="block text-xs uppercase font-extrabold text-slate-500 mb-1.5 tracking-wider font-mono">Longitude</label>
                  <input type="number" step="0.0001" value={newDevLng} onChange={e => setNewDevLng(e.target.value)}
                    min="-180" max="180" required
                    className={`w-full rounded-xl px-4 py-3 text-xs focus:outline-none glass-input ${formErrors.lng ? 'error' : ''}`} />
                  {formErrors.lng && <p className="text-[10px] text-rose-500 mt-1 font-mono">{formErrors.lng}</p>}
                </div>
              </div>

              {Object.keys(formErrors).length > 0 && (
                <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-600 text-[10px] font-mono">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  Please fix the errors above before submitting.
                </div>
              )}

              <button type="submit"
                className="w-full py-3.5 mt-2 bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 text-white font-black text-xs uppercase tracking-widest rounded-xl transition duration-300 shadow-md cursor-pointer">
                Configure Ingestion Pipeline
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
