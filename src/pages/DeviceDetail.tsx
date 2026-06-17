// src/pages/DeviceDetail.tsx
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase, isLiveMode } from '../services/supabase';
import { useRealtimeTelemetry } from '../hooks/useRealtimeTelemetry';
import type { TelemetryData } from '../hooks/useRealtimeTelemetry';
import { sendDeviceCommand } from '../services/controlActions';
import SparkMD5 from 'spark-md5';
import mockDb from '../services/mockDb';
import SolarDigitalTwin from '../components/SolarDigitalTwin';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { 
  ShieldAlert, Settings, RotateCw, Wind, Cpu, RefreshCw, ArrowLeft,
  Play, Sliders, Sun
} from 'lucide-react';


interface DeviceDetailProps {
  userRole: 'Visitor' | 'End-User' | 'Technician' | 'Admin';
}

export default function DeviceDetail({ userRole }: DeviceDetailProps) {
  const { deviceId } = useParams<{ deviceId: string }>();
  const [device, setDevice] = useState<any>(null);
  const [history, setHistory] = useState<TelemetryData[]>([]);
  const [loading, setLoading] = useState(true);
  const [commandStatus, setCommandStatus] = useState<string | null>(null);
  const [otaFile, setOtaFile] = useState<File | null>(null);
  const [otaChecksum, setOtaChecksum] = useState<string>('');
  const [otaUploading, setOtaUploading] = useState(false);
  
  // Custom Real-Time Telemetry Hook
  const liveTelemetry = useRealtimeTelemetry(deviceId || '');

  const [isAutoTracking, setIsAutoTracking] = useState(true);
  const [manualAzimuth, setManualAzimuth] = useState(0);
  const [manualElevation, setManualElevation] = useState(45);
  const [cnnOutput, setCnnOutput] = useState<number[] | null>(null);
  const [inferencing, setInferencing] = useState(false);

  // 1. Initial Load & Fetching trailing 24 hours
  useEffect(() => {
    async function fetchDeviceData() {
      if (!deviceId) return;
      
      const { data: devInfo } = await supabase
        .from('devices')
        .select('*')
        .eq('id', deviceId)
        .single();
      setDevice(devInfo);

      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: histData } = await supabase
        .from('telemetry')
        .select('*')
        .eq('device_id', deviceId)
        .gte('timestamp', yesterday)
        .order('timestamp', { ascending: true });

      if (histData) setHistory(histData);
      setLoading(false);
    }
    fetchDeviceData();
  }, [deviceId]);

  // 2. Append live data to local memory state
  useEffect(() => {
    if (liveTelemetry) {
      setHistory(prev => {
        // Avoid adding duplicates of the same timestamp
        if (prev.length > 0 && prev[prev.length - 1].timestamp === liveTelemetry.timestamp) {
          return prev;
        }
        return [...prev.slice(-48), liveTelemetry]; // keep trailing cache buffer
      });
    }
  }, [liveTelemetry]);

  // 3. Poll custom API server middleware for physical device telemetry streams (local mock mode only)
  useEffect(() => {
    if (!deviceId || isLiveMode) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/telemetry/poll');
        if (res.ok) {
          const data = await res.json();
          if (data.telemetry && data.telemetry.length > 0) {
            data.telemetry.forEach((t: any) => {
              if (t.device_id === deviceId) {
                mockDb.injectExternalTelemetry(deviceId, t);
              }
            });
          }
          if (data.faults && data.faults.length > 0) {
            data.faults.forEach((f: any) => {
              if (f.device_id === deviceId) {
                mockDb.injectExternalFault(deviceId, f);
              }
            });
          }
        }
      } catch (err) {
        console.error('API polling stream offline', err);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [deviceId]);

  // 3.5. Send manual override command when sliders/tracking changes (debounced)
  useEffect(() => {
    if (!deviceId || loading) return;
    if (userRole === 'Visitor') return;

    const delayDebounce = setTimeout(async () => {
      try {
        await supabase.from('commands').insert({
          device_id: deviceId,
          action: 'override' as any, // Cast custom action type
          payload: {
            auto: isAutoTracking,
            azimuth: manualAzimuth,
            elevation: manualElevation
          },
          status: 'pending'
        });
      } catch (err) {
        console.error('Failed to send override command:', err);
      }
    }, 500);

    return () => clearTimeout(delayDebounce);
  }, [isAutoTracking, manualAzimuth, manualElevation, deviceId, loading, userRole]);

  // 4. Compute MD5 Checksum on file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setOtaFile(file);

    const reader = new FileReader();
    reader.onload = (event) => {
      const binary = event.target?.result;
      const spark = new SparkMD5.ArrayBuffer();
      if (binary instanceof ArrayBuffer) {
        spark.append(binary);
        setOtaChecksum(spark.end());
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // 5. OTA Firmware Deployment Pipeline
  const handleOtaUpload = async () => {
    if (!otaFile || !deviceId) return;
    
    // RBAC validation
    if (userRole !== 'Admin') {
      alert('🔒 Access Denied: Only Admin accounts can deploy firmware binaries.');
      return;
    }

    setOtaUploading(true);
    try {
      const fileExt = otaFile.name.split('.').pop();
      const filePath = `firmware/${deviceId}/${Date.now()}.${fileExt}`;

      // Upload binary to Supabase storage bucket
      const { error: uploadError } = await supabase.storage
        .from('firmware-updates')
        .upload(filePath, otaFile);

      if (uploadError) throw uploadError;

      // Fetch signed download URL (valid for 1 hour)
      const { data: urlData, error: urlError } = await supabase.storage
        .from('firmware-updates')
        .createSignedUrl(filePath, 3600);

      if (urlError) throw urlError;

      const fileVersion = 'v' + otaFile.name.replace(/[^\d.]/g, '') || 'v2.0.0';

      // Log commands record to trigger edge MQTT dispatch
      const { error: cmdError } = await supabase
        .from('commands')
        .insert({
          device_id: deviceId,
          action: 'calibrate', // Using calibrate flow for update dispatch
          payload: { 
            ota_url: urlData.signedUrl, 
            md5_hash: otaChecksum,
            version: fileVersion
          },
          status: 'pending'
        });

      if (cmdError) throw cmdError;
      
      alert(`⚡ OTA Update Dispatched successfully!\nNew version: ${fileVersion}\nMD5: ${otaChecksum}`);
      setOtaFile(null);
      setOtaChecksum('');
    } catch (err: any) {
      alert(`OTA Deployment Failed: ${err.message}`);
    } finally {
      setOtaUploading(false);
    }
  };

  // 6. Trigger hardware actions
  const triggerAction = async (action: 'stow' | 'clean' | 'reboot') => {
    if (!deviceId) return;

    // RBAC validation
    if (userRole === 'Visitor') {
      alert('🔒 Access Denied: Visitor role cannot execute override controls.');
      return;
    }

    setCommandStatus(`Sending ${action}...`);
    try {
      await sendDeviceCommand(deviceId, action);
      setCommandStatus(`Command "${action}" sent successfully. Waiting execution confirmation...`);
      setTimeout(() => {
        setCommandStatus(null);
      }, 5000);
    } catch (err: any) {
      setCommandStatus(`Error: ${err.message}`);
    }
  };

  if (loading) return (
    <div className="flex h-screen items-center justify-center bg-slate-950 text-emerald-400">
      <RefreshCw className="h-10 w-10 animate-spin" />
    </div>
  );

  const currentMetrics = liveTelemetry || history[history.length - 1] || { v: 0, i: 0, p: 0, temp: 0, fault: 0, ldr: [0,0,0,0], id: 0 };
  
  // Calculate dynamic Panel Angle relative to Horizon
  const leftAvg = (currentMetrics.ldr[0] + currentMetrics.ldr[1]) / 2;
  const rightAvg = (currentMetrics.ldr[2] + currentMetrics.ldr[3]) / 2;
  const calculatedPanelAngle = Math.max(-45, Math.min(45, (leftAvg - rightAvg) * 0.05));

  const panelAngle = isAutoTracking ? calculatedPanelAngle : manualAzimuth;

  const hasControlsAccess = userRole !== 'Visitor';
  const hasOtaAccess = userRole === 'Admin';

  // AI Fault Diagnostics mappings
  const isOpenCircuit = currentMetrics.v > 18 && currentMetrics.i < 0.1;
  const isShortCircuit = currentMetrics.v < 1 && currentMetrics.i > 4.5;
  const isPanelFailure = currentMetrics.fault === 3 || currentMetrics.fault === 5;

  const isDustSoiling = currentMetrics.fault === 1;
  const isBirdDroppings = currentMetrics.fault === 2 && (currentMetrics.id % 2 === 0);
  const isPartialShading = currentMetrics.fault === 2 && (currentMetrics.id % 2 !== 0);

  const getAgenticAlert = () => {
    if (isOpenCircuit) {
      return "ALERT [SYSTEM]: Open circuit condition detected at edge actuator output. Suspect disconnected solar PV leads or blown DC fuse. Recommend checking physical loop connection.";
    }
    if (isShortCircuit) {
      return "CRITICAL [SYSTEM]: Short circuit condition active. Current draw spiked to max limits with near-zero voltage. Disconnect actuator relay immediately to prevent thermal runaway.";
    }
    if (isPanelFailure) {
      return "WARNING [AI CORE]: Panel degradation metrics spike. local resistance hotspot detected via 1D-CNN thermal analyzer. Actuator commanded to stow angle (0° tilt) to reduce heat exposure.";
    }
    if (isDustSoiling) {
      return "MAINTENANCE [VISION AI]: Heavy dust/soiling detected on monocrystalline surface. Power output reduced by 18%. Recommend executing a clean loop or deploying physical wipe sweepers.";
    }
    if (isBirdDroppings) {
      return "WARNING [VISION AI]: Non-uniform light obstruction detected. Patterns indicate localized surface bird droppings. Clean surface area immediately to avoid hot-spot corrosion.";
    }
    if (isPartialShading) {
      return "INFO [VISION AI]: Transient partial shading pattern recorded. Ambient solar irradiance variance matches neighbor structure shading. Closed-loop tracking optimized for diffuse scatter.";
    }
    if (currentMetrics.fault === 4) {
      return "ALERT [EDGE]: Actuator motor blockage registered. Torque exceeds safety bounds. Verify structure joints are free of debris and reset node.";
    }
    if (currentMetrics.fault === 6) {
      return "SAFE_MODE [ANEMOMETER]: Local wind velocity exceeds threshold. Smart safe stow protocol successfully deployed. Panels locked flat (0° orientation).";
    }
    return "SYSTEM NOMINAL: AI models and physical sensors reporting nominal tracking coordinates. Sun alignment is optimal. No maintenance required.";
  };

  // 7. Run Edge 1D-CNN Inference simulation
  const runEdgeInference = () => {
    if (userRole === 'Visitor') {
      alert('🔒 Access Denied: Visitor role cannot run edge diagnostics.');
      return;
    }
    setInferencing(true);
    setCnnOutput(null);
    
    setTimeout(() => {
      setInferencing(false);
      const faultCode = currentMetrics.fault || 0;
      const mockSoftmax = [0, 0, 0, 0, 0, 0];
      
      if (faultCode === 0) {
        mockSoftmax[0] = 0.95 + Math.random() * 0.04; // Healthy 95-99%
        let remaining = 1.0 - mockSoftmax[0];
        for (let i = 1; i <= 5; i++) {
          const share = i === 5 ? remaining : remaining * Math.random();
          mockSoftmax[i] = share;
          remaining -= share;
        }
      } else {
        const targetIndex = faultCode > 5 ? 0 : faultCode;
        mockSoftmax[targetIndex] = 0.88 + Math.random() * 0.10; // 88-98%
        let remaining = 1.0 - mockSoftmax[targetIndex];
        for (let i = 0; i <= 5; i++) {
          if (i === targetIndex) continue;
          const isLast = i === 5 || (i === 4 && targetIndex === 5);
          const share = isLast ? remaining : remaining * Math.random();
          mockSoftmax[i] = share;
          remaining -= share;
        }
      }
      setCnnOutput(mockSoftmax);
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-8 font-sans selection:bg-emerald-500 selection:text-slate-950">
      
      {/* 🔝 Dashboard Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-3">
            <Link to="/dashboard" className="p-2 hover:bg-slate-900 border border-slate-850 hover:border-slate-800 rounded-xl transition text-slate-400 hover:text-white">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-3xl font-black tracking-tight text-white">{device?.name || 'SuryaMitra Node'}</h1>
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${
              device?.status === 'online' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
            }`}>
              <span className={`h-1.5 w-1.5 rounded-full ${device?.status === 'online' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
              {device?.status?.toUpperCase()}
            </span>
          </div>
          <p className="text-slate-400 mt-1 pl-10">Serial Number: <code className="text-emerald-500 font-mono text-xs">{device?.serial_number}</code> | Firmware: <span className="text-amber-400 font-semibold">{device?.current_firmware_version}</span></p>
        </div>
        
        {/* Commands Status Feed */}
        {commandStatus && (
          <div className="mt-4 md:mt-0 px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full bg-amber-500 animate-ping" />
            <span className="text-slate-300 font-medium">{commandStatus}</span>
          </div>
        )}
      </div>

      {/* 🔒 RBAC Banner Warn */}
      {userRole === 'Visitor' && (
        <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center gap-3 text-amber-400 text-xs font-semibold">
          <ShieldAlert className="h-5 w-5 shrink-0" />
          <span>You are logged in as a <strong>Visitor</strong>. Override commands and OTA firmware updates are locked. Switch your role in the top header to test control operations.</span>
        </div>
      )}

      {/* 🚀 KPI Dashboard Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Voltage Card */}
        <div className="glass-panel p-5 rounded-2xl relative overflow-hidden transition hover:border-cyan-500/20 group">
          <div className="absolute top-0 right-0 h-16 w-16 bg-cyan-500/5 rounded-full blur-lg" />
          <p className="text-[10px] text-slate-500 uppercase font-black tracking-wider font-mono">PV Array Voltage</p>
          <p className="text-3xl font-black text-white mt-2 tracking-tighter font-sans">{currentMetrics.v.toFixed(1)} <span className="text-xs text-slate-500 font-normal font-mono">V</span></p>
          <div className="text-[9px] text-slate-500 mt-2 font-mono">VOC_LIMIT: 24.0V</div>
        </div>

        {/* Current Card */}
        <div className="glass-panel p-5 rounded-2xl relative overflow-hidden transition hover:border-cyan-500/20 group">
          <div className="absolute top-0 right-0 h-16 w-16 bg-cyan-500/5 rounded-full blur-lg" />
          <p className="text-[10px] text-slate-500 uppercase font-black tracking-wider font-mono">Ingested Loop Current</p>
          <p className="text-3xl font-black text-white mt-2 tracking-tighter font-sans">{currentMetrics.i.toFixed(2)} <span className="text-xs text-slate-500 font-normal font-mono">A</span></p>
          <div className="text-[9px] text-slate-500 mt-2 font-mono">IASC_LIMIT: 5.0A</div>
        </div>

        {/* Total Power Card */}
        <div className="glass-panel p-5 rounded-2xl relative overflow-hidden transition hover:border-cyan-500/20 group">
          <div className="absolute top-0 right-0 h-16 w-16 bg-cyan-500/5 rounded-full blur-lg" />
          <p className="text-[10px] text-slate-500 uppercase font-black tracking-wider font-mono">Net Power Generated</p>
          <p className="text-3xl font-black text-white mt-2 tracking-tighter font-sans">{currentMetrics.p.toFixed(2)} <span className="text-xs text-slate-500 font-normal font-mono">W</span></p>
          <div className="text-[9px] text-slate-500 mt-2 font-mono">CALCULATED: V * I</div>
        </div>

        {/* Temperature Card */}
        <div className="glass-panel p-5 rounded-2xl relative overflow-hidden transition hover:border-cyan-500/20 group">
          <div className="absolute top-0 right-0 h-16 w-16 bg-cyan-500/5 rounded-full blur-lg" />
          <p className="text-[10px] text-slate-500 uppercase font-black tracking-wider font-mono">Panel Temperature</p>
          <p className={`text-3xl font-black mt-2 tracking-tighter font-sans ${currentMetrics.temp > 60 ? 'text-rose-500 text-glow-rose' : 'text-white'}`}>
            {currentMetrics.temp.toFixed(1)} <span className="text-xs text-slate-500 font-normal font-mono">°C</span>
          </p>
          <div className="text-[9px] text-slate-500 mt-2 font-mono">TEMP_LIMIT: 65.0°C</div>
        </div>
      </div>

      {/* 📊 Main Content Area: Charts & Widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        
        {/* Left Column: Generation Chart & AI Fault Console */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Recharts Analytics Chart */}
          <div className="glass-panel p-6 rounded-3xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-cyan-500" />
            <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-cyan-500" />
            <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-cyan-500" />
            <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-cyan-500" />

            <h2 className="text-base font-black text-white mb-4 uppercase tracking-wide flex items-center gap-2">
              Synchronized Generation & Thermal Profiling
            </h2>
            
            <div className="h-80 w-full font-mono text-[10px]">
              {history.length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-500">Connecting to telemetry stream...</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <LineChart data={history} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                    <XAxis 
                      dataKey="timestamp" 
                      tickFormatter={(t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      stroke="#475569" 
                      style={{ fontSize: '9px' }}
                    />
                    <YAxis yAxisId="left" stroke="#06b6d4" style={{ fontSize: '9px' }} />
                    <YAxis yAxisId="right" orientation="right" stroke="#f43f5e" style={{ fontSize: '9px' }} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#020617', borderColor: 'rgba(6, 182, 212, 0.2)', color: '#fff', fontSize: '11px', borderRadius: '12px' }} 
                      labelFormatter={(l) => new Date(l).toLocaleTimeString()} 
                    />
                    <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                    <Line yAxisId="left" type="monotone" dataKey="p" name="Power (W)" stroke="#06b6d4" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                    <Line yAxisId="left" type="monotone" dataKey="v" name="Voltage (V)" stroke="#3b82f6" strokeWidth={1.5} dot={false} />
                    <Line yAxisId="right" type="monotone" dataKey="temp" name="Temperature (°C)" stroke="#f43f5e" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* AI Fault Diagnostics Panel */}
          <div className="glass-panel p-6 rounded-3xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-cyan-500" />
            <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-cyan-500" />
            <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-cyan-500" />
            <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-cyan-500" />

            <h2 className="text-base font-black text-white uppercase tracking-wide flex items-center gap-2 mb-4">
              <Cpu className="text-cyan-400 h-5 w-5 text-glow-cyan" /> Intelligent Fault Detection & Diagnostics
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <h3 className="text-[9px] uppercase font-black tracking-widest font-mono text-slate-500 mb-2">Edge IoT Diagnostics</h3>
                  <div className="grid grid-cols-3 gap-2">
                    <div className={`py-2 px-1 rounded-xl border text-center font-mono text-[9px] uppercase tracking-wider font-bold transition duration-300 ${
                      isOpenCircuit 
                        ? 'bg-rose-500/10 text-rose-400 border-rose-500/35 text-glow-rose animate-pulse'
                        : 'bg-slate-950/40 text-slate-600 border-slate-900'
                    }`}>
                      Open Circ
                    </div>
                    <div className={`py-2 px-1 rounded-xl border text-center font-mono text-[9px] uppercase tracking-wider font-bold transition duration-300 ${
                      isShortCircuit 
                        ? 'bg-rose-500/10 text-rose-400 border-rose-500/35 text-glow-rose animate-pulse'
                        : 'bg-slate-950/40 text-slate-600 border-slate-900'
                    }`}>
                      Short Circ
                    </div>
                    <div className={`py-2 px-1 rounded-xl border text-center font-mono text-[9px] uppercase tracking-wider font-bold transition duration-300 ${
                      isPanelFailure 
                        ? 'bg-rose-500/10 text-rose-400 border-rose-500/35 text-glow-rose animate-pulse'
                        : 'bg-slate-950/40 text-slate-600 border-slate-900'
                    }`}>
                      Panel Fail
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-[9px] uppercase font-black tracking-widest font-mono text-slate-500 mb-2">Vision AI Diagnostics</h3>
                  <div className="grid grid-cols-3 gap-2">
                    <div className={`py-2 px-1 rounded-xl border text-center font-mono text-[9px] uppercase tracking-wider font-bold transition duration-300 ${
                      isDustSoiling 
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/35 text-glow-gold animate-pulse'
                        : 'bg-slate-950/40 text-slate-600 border-slate-900'
                    }`}>
                      Dust/Soil
                    </div>
                    <div className={`py-2 px-1 rounded-xl border text-center font-mono text-[9px] uppercase tracking-wider font-bold transition duration-300 ${
                      isBirdDroppings 
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/35 text-glow-gold animate-pulse'
                        : 'bg-slate-950/40 text-slate-600 border-slate-900'
                    }`}>
                      Droppings
                    </div>
                    <div className={`py-2 px-1 rounded-xl border text-center font-mono text-[9px] uppercase tracking-wider font-bold transition duration-300 ${
                      isPartialShading 
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/35 text-glow-gold animate-pulse'
                        : 'bg-slate-950/40 text-slate-600 border-slate-900'
                    }`}>
                      Shading
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col justify-between">
                <div>
                  <h3 className="text-[9px] uppercase font-black tracking-widest font-mono text-slate-500 mb-2">Agentic Early Warning Alerts</h3>
                  <div className={`p-4 bg-slate-950 border rounded-xl font-mono text-[10px] leading-relaxed min-h-[96px] flex items-center transition duration-300 ${
                    currentMetrics.fault !== 0 || isOpenCircuit || isShortCircuit
                      ? 'border-rose-500/30 text-rose-400 bg-rose-950/10'
                      : 'border-slate-850 text-cyan-400 bg-cyan-950/5'
                  }`}>
                    {getAgenticAlert()}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: 3D Twin & Radar Tracker */}
        <div className="lg:col-span-1 space-y-8">
          
          {/* Interactive 3D digital twin */}
          <SolarDigitalTwin azimuth={panelAngle} elevation={isAutoTracking ? 45 : manualElevation} />

          {/* SVG Sun Path Graph */}
          <div className="glass-panel p-6 rounded-3xl relative overflow-hidden hover:border-cyan-500/25 transition duration-300">
            <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-cyan-500" />
            <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-cyan-500" />
            <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-cyan-500" />
            <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-cyan-500" />
            
            <div>
              <h2 className="text-base font-black text-white uppercase tracking-wide flex items-center gap-1.5">
                <Sun className="text-amber-400 h-4.5 w-4.5 text-glow-gold animate-spin-slow" /> Target Tracking HUD
              </h2>
              <p className="text-[10px] text-slate-500 font-mono mt-0.5">SYS_RADAR_SUN_ALIGNMENT_VECTOR</p>
            </div>

            <div className="flex justify-center items-center my-6 relative p-4 bg-slate-950/40 border border-slate-850 rounded-2xl">
              <div className="absolute inset-0 bg-grid-white/[0.02] rounded-2xl pointer-events-none" />
              
              <svg width="240" height="130" viewBox="0 0 240 130" className="overflow-visible z-10 font-mono">
                <line x1="10" y1="120" x2="230" y2="120" stroke="#1e293b" strokeWidth="2" />
                <path d="M 20 120 A 100 100 0 0 1 220 120" fill="none" stroke="rgba(6, 182, 212, 0.1)" strokeWidth="2" />
                <path d="M 50 120 A 70 70 0 0 1 190 120" fill="none" stroke="rgba(6, 182, 212, 0.15)" strokeWidth="1" strokeDasharray="3 3" />
                <path d="M 80 120 A 40 40 0 0 1 160 120" fill="none" stroke="rgba(6, 182, 212, 0.08)" strokeWidth="2" />
                
                <line x1="120" y1="120" x2="120" y2="20" stroke="rgba(6, 182, 212, 0.15)" strokeWidth="1" strokeDasharray="2 2" />
                <line x1="120" y1="120" x2="49.28" y2="49.28" stroke="rgba(6, 182, 212, 0.08)" strokeWidth="1" />
                <line x1="120" y1="120" x2="190.72" y2="49.28" stroke="rgba(6, 182, 212, 0.08)" strokeWidth="1" />
                
                {(() => {
                  const angleRad = (90 - panelAngle) * (Math.PI / 180);
                  const sunX = 120 + 100 * Math.cos(angleRad);
                  const sunY = 120 - 100 * Math.sin(angleRad);
                  return (
                    <>
                      <line x1="120" y1="120" x2={sunX} y2={sunY} stroke="#fbbf24" strokeWidth="1.5" strokeDasharray="3 2" />
                      
                      <g transform={`translate(${sunX}, ${sunY})`}>
                        <circle cx="0" cy="0" r="10" fill="none" stroke="#fbbf24" strokeWidth="1" className="animate-ping" style={{ animationDuration: '3s' }} />
                        <circle cx="0" cy="0" r="6" fill="#fbbf24" />
                        <line x1="-8" y1="0" x2="8" y2="0" stroke="#fbbf24" strokeWidth="1" />
                        <line x1="0" y1="-8" x2="0" y2="8" stroke="#fbbf24" strokeWidth="1" />
                      </g>
                    </>
                  );
                })()}

                <g transform={`translate(120, 120) rotate(${panelAngle})`}>
                  <line x1="0" y1="0" x2="0" y2="-20" stroke="#64748b" strokeWidth="5" />
                  <circle cx="0" cy="0" r="6" fill="#0f172a" stroke="#64748b" strokeWidth="3" />
                  <line x1="-45" y1="-20" x2="45" y2="-20" stroke="#06b6d4" strokeWidth="5" strokeLinecap="round" />
                  <line x1="-38" y1="-23" x2="-5" y2="-23" stroke="#1e3a8a" strokeWidth="1.5" />
                  <line x1="5" y1="-23" x2="38" y2="-23" stroke="#1e3a8a" strokeWidth="1.5" />
                  <circle cx="-42" cy="-20" r="2" fill="#f43f5e" />
                  <circle cx="42" cy="-20" r="2" fill="#f43f5e" />
                </g>
                
                <text x="12" y="115" fill="#475569" fontSize="8" fontWeight="bold">E_TGT</text>
                <text x="210" y="115" fill="#475569" fontSize="8" fontWeight="bold">W_TGT</text>
                <text x="123" y="32" fill="rgba(6, 182, 212, 0.4)" fontSize="7">ZENITH_90</text>
              </svg>
            </div>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-850 text-center text-[10px] font-mono flex items-center justify-between">
              <span className="text-slate-500 uppercase font-bold">ALIGN_EFFICIENCY:</span>
              <span className="font-extrabold text-emerald-400 font-mono">{(98.5 - Math.abs(calculatedPanelAngle * 0.05)).toFixed(2)}%</span>
            </div>
          </div>

        </div>
      </div>

      {/* 🎮 Overrides & Edge Diagnostics Section */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        
        {/* Card 1: Edge Steering Overrides */}
        <div className="glass-panel p-6 rounded-3xl relative overflow-hidden hover:border-cyan-500/20 transition duration-300 flex flex-col justify-between">
          <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-cyan-500" />
          <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-cyan-500" />
          <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-cyan-500" />
          <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-cyan-500" />

          <div>
            <h2 className="text-base font-black text-white mb-2 flex items-center gap-2 uppercase tracking-wide">
              <Settings className="text-cyan-400 h-5 w-5 text-glow-cyan" /> Edge Steering Overrides
            </h2>
            <p className="text-xs text-slate-400 mb-6 leading-normal">Manage tracking mode and tilt angles of the actuator motors.</p>

            {/* Toggle Switch */}
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800/80">
              <div>
                <span className="text-xs font-black uppercase tracking-wider text-slate-300 block">Closed-Loop Tracking</span>
                <span className="text-[10px] text-slate-500 font-mono">Autonomous active LDR differential vectoring</span>
              </div>
              <button
                onClick={() => {
                  if (!hasControlsAccess) {
                    alert('🔒 Access Denied: Visitor role cannot toggle tracking modes.');
                    return;
                  }
                  setIsAutoTracking(!isAutoTracking);
                }}
                disabled={!hasControlsAccess}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  isAutoTracking ? 'bg-cyan-500' : 'bg-slate-800'
                } ${!hasControlsAccess ? 'opacity-55 cursor-not-allowed' : ''}`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-slate-950 shadow ring-0 transition duration-200 ease-in-out ${
                    isAutoTracking ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Sliders */}
            <div className="space-y-6">
              {/* Azimuth manual steering */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-black text-slate-300 flex items-center gap-1.5 uppercase font-mono tracking-wider">
                    <Sliders className="h-3.5 w-3.5 text-yellow-500" /> Azimuth Override (E-W)
                  </label>
                  <span className={`text-xs font-mono font-bold ${isAutoTracking ? 'text-slate-500' : 'text-yellow-400'}`}>
                    {(manualAzimuth >= 0 ? '+' : '') + manualAzimuth}°
                  </span>
                </div>
                <input
                  type="range"
                  min="-45"
                  max="45"
                  value={manualAzimuth}
                  onChange={(e) => {
                    if (!hasControlsAccess) return;
                    setManualAzimuth(Number(e.target.value));
                  }}
                  disabled={isAutoTracking || !hasControlsAccess}
                  className={`w-full h-1.5 rounded-lg appearance-none cursor-pointer bg-slate-800 accent-yellow-500 focus:outline-none transition ${
                    (isAutoTracking || !hasControlsAccess) ? 'opacity-40 cursor-not-allowed' : ''
                  }`}
                />
                <div className="flex justify-between text-[10px] text-slate-600 mt-1 font-mono">
                  <span>-45° East</span>
                  <span>0° Neutral</span>
                  <span>+45° West</span>
                </div>
              </div>

              {/* Elevation manual steering */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-black text-slate-300 flex items-center gap-1.5 uppercase font-mono tracking-wider">
                    <Sliders className="h-3.5 w-3.5 text-cyan-400" /> Elevation Override (H-Z)
                  </label>
                  <span className={`text-xs font-mono font-bold ${isAutoTracking ? 'text-slate-500' : 'text-cyan-400'}`}>
                    {manualElevation}°
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="90"
                  value={manualElevation}
                  onChange={(e) => {
                    if (!hasControlsAccess) return;
                    setManualElevation(Number(e.target.value));
                  }}
                  disabled={isAutoTracking || !hasControlsAccess}
                  className={`w-full h-1.5 rounded-lg appearance-none cursor-pointer bg-slate-800 accent-cyan-500 focus:outline-none transition ${
                    (isAutoTracking || !hasControlsAccess) ? 'opacity-40 cursor-not-allowed' : ''
                  }`}
                />
                <div className="flex justify-between text-[10px] text-slate-600 mt-1 font-mono">
                  <span>0° Horizontal</span>
                  <span>45° Optimal</span>
                  <span>90° Zenith</span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick presets */}
          <div className="border-t border-slate-800/80 mt-6 pt-4">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block mb-3 font-mono">Priority Overrides</span>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => triggerAction('stow')}
                disabled={!hasControlsAccess}
                className={`flex flex-col items-center justify-center py-2.5 px-1 bg-slate-950/60 border rounded-xl transition text-center hover:bg-slate-900 border-slate-850 hover:border-cyan-500/30 text-[10px] uppercase font-bold text-slate-300 cursor-pointer ${
                  !hasControlsAccess ? 'opacity-40 cursor-not-allowed' : ''
                }`}
              >
                <Wind className="h-4 w-4 mb-1 text-cyan-400 animate-pulse" />
                Stow (0°)
              </button>

              <button
                onClick={() => triggerAction('clean')}
                disabled={!hasControlsAccess}
                className={`flex flex-col items-center justify-center py-2.5 px-1 bg-slate-950/60 border rounded-xl transition text-center hover:bg-slate-900 border-slate-850 hover:border-blue-500/30 text-[10px] uppercase font-bold text-slate-300 cursor-pointer ${
                  !hasControlsAccess ? 'opacity-40 cursor-not-allowed' : ''
                }`}
              >
                <RotateCw className="h-4 w-4 mb-1 text-blue-400" />
                Clean
              </button>

              <button
                onClick={() => triggerAction('reboot')}
                disabled={!hasControlsAccess}
                className={`flex flex-col items-center justify-center py-2.5 px-1 bg-slate-950/60 border rounded-xl transition text-center hover:bg-slate-900 border-slate-850 hover:border-rose-500/30 text-[10px] uppercase font-bold text-slate-300 cursor-pointer ${
                  !hasControlsAccess ? 'opacity-40 cursor-not-allowed' : ''
                }`}
              >
                <Cpu className="h-4 w-4 mb-1 text-rose-400" />
                Reboot
              </button>
            </div>
          </div>
        </div>

        {/* Card 2: ESP32 Edge AI Diagnostics */}
        <div className="glass-panel p-6 rounded-3xl relative overflow-hidden hover:border-emerald-500/20 transition duration-300 flex flex-col justify-between">
          <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-emerald-500" />
          <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-emerald-500" />
          <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-emerald-500" />
          <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-emerald-500" />

          <div>
            <h2 className="text-base font-black text-white mb-2 flex items-center gap-2 uppercase tracking-wide">
              <Cpu className="text-emerald-500 h-5 w-5 text-glow-cyan" /> ESP32 Edge AI Diagnostics
            </h2>
            <p className="text-xs text-slate-400 leading-normal mb-4">
              Execute a simulated 1D-CNN deep learning classifier to isolate tracking and sensor anomalies.
            </p>

            {/* Glowing Terminal */}
            <div className="my-2 p-4 bg-slate-950/90 border border-slate-850 rounded-xl font-mono text-[10px] leading-relaxed text-slate-300 min-h-60 relative overflow-hidden flex flex-col justify-between">
              {/* Scanline overlay */}
              <div className="absolute inset-0 bg-scanline pointer-events-none opacity-[0.03]" />
              <div className="absolute top-0 right-0 h-16 w-16 bg-emerald-500/5 rounded-full blur-lg" />
              
              <div className="space-y-1 z-10 flex-grow">
                {inferencing ? (
                  <div className="space-y-1">
                    <p className="text-slate-500 animate-pulse">[+] INITIALIZING AI CORE ENGINE...</p>
                    <p className="text-slate-500 animate-pulse">[+] RETRIEVING LDR TIME-SERIES BUFFER...</p>
                    <p className="text-slate-400 animate-pulse">[D] CURRENT INPUT VEC: [{currentMetrics.ldr.join(', ')}]</p>
                    <p className="text-emerald-500 animate-pulse">[!] RUNNING 1D-CNN CORE LAYER WEIGHTS...</p>
                  </div>
                ) : cnnOutput ? (
                  <div className="space-y-2">
                    <p className="text-slate-500">[INFO] INFERENCE COMPLETE (LATENCY: 1.22ms)</p>
                    <p className="text-emerald-400 font-bold">[SUCCESS] SOFTMAX CLASSIFICATION:</p>
                    
                    <div className="space-y-2.5 mt-2">
                      {[
                        { name: 'Healthy (Nominal)', pct: cnnOutput[0], color: 'bg-emerald-500' },
                        { name: 'Dust Soiling', pct: cnnOutput[1], color: 'bg-yellow-500' },
                        { name: 'Partial Shading', pct: cnnOutput[2], color: 'bg-blue-500' },
                        { name: 'Electrical Hotspot', pct: cnnOutput[3], color: 'bg-red-500' },
                        { name: 'Actuator Blocked', pct: cnnOutput[4], color: 'bg-orange-500' },
                        { name: 'Sensor Degradation', pct: cnnOutput[5], color: 'bg-purple-500' },
                      ].map((cl, idx) => (
                        <div key={idx} className="space-y-1">
                          <div className="flex justify-between text-[8.5px] font-bold text-slate-400">
                            <span>CLASS #{idx}: {cl.name}</span>
                            <span className="font-mono text-white">{(cl.pct * 100).toFixed(1)}%</span>
                          </div>
                          <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                            <div className={`h-full ${cl.color} transition-all duration-500`} style={{ width: `${cl.pct * 100}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="h-full flex flex-col justify-center items-center text-center text-slate-500 py-8">
                    <Play className="h-6 w-6 text-slate-600 mb-2 animate-pulse" />
                    <p className="text-slate-400 font-bold text-xs uppercase tracking-wider font-mono">Edge Inference Standby</p>
                    <p className="text-[10px] text-slate-500 mt-1 max-w-[200px] leading-relaxed">Click below to run telemetry streams through the CNN layer weights.</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={runEdgeInference}
            disabled={inferencing || !hasControlsAccess}
            className={`w-full mt-4 py-3 px-4 rounded-xl font-black text-xs uppercase tracking-wider transition flex items-center justify-center gap-2 cursor-pointer ${
              inferencing || !hasControlsAccess
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-850'
                : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/20'
            }`}
          >
            {inferencing ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Processing CNN Layers...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 fill-current" />
                Execute 1D-CNN Diagnostic
              </>
            )}
          </button>
        </div>

        {/* Card 3: OTA Firmware Upgrades */}
        <div className="glass-panel p-6 rounded-3xl relative overflow-hidden hover:border-rose-500/20 transition duration-300 flex flex-col justify-between">
          <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-rose-500" />
          <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-rose-500" />
          <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-rose-500" />
          <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-rose-500" />

          <div>
            <h2 className="text-base font-black text-white mb-2 flex items-center gap-2 uppercase tracking-wide">
              <ShieldAlert className="text-rose-500 h-5 w-5 text-glow-rose" /> OTA Firmware Deployment
            </h2>
            <p className="text-xs text-slate-400 mb-6 leading-normal">Compile and upload binary packages. Automated MD5 validation avoids bootloops or corruption issues.</p>

            {/* Lock overlay for Non-Admins */}
            {!hasOtaAccess ? (
              <div className="p-4 bg-slate-950/60 border border-slate-850 rounded-2xl text-slate-500 text-xs font-semibold text-center flex flex-col items-center justify-center gap-2 h-48">
                <ShieldAlert className="h-6 w-6 text-rose-500/50" />
                <span className="uppercase font-mono text-[10px] tracking-wider">Firmware upload locked.<br/>Requires Admin privilege.</span>
              </div>
            ) : (
              <div className="border-2 border-dashed border-slate-850 hover:border-cyan-500/35 hover:bg-cyan-500/5 rounded-2xl p-6 text-center transition duration-300 bg-slate-950/60">
                <input 
                  type="file" 
                  accept=".bin" 
                  id="firmware-file-input-detail" 
                  onChange={handleFileChange} 
                  className="hidden" 
                />
                <label htmlFor="firmware-file-input-detail" className="cursor-pointer block">
                  <Cpu className="h-8 w-8 text-slate-500 mx-auto mb-2" />
                  <span className="text-xs text-slate-300 font-black block uppercase tracking-wider font-mono">
                    {otaFile ? otaFile.name : 'Select firmware.bin'}
                  </span>
                  <span className="text-[10px] text-slate-500 block mt-1 font-mono">Compiled binary files only</span>
                </label>
              </div>
            )}

            {otaChecksum && (
              <div className="mt-4 p-3 bg-slate-950/80 border border-slate-850 rounded-xl text-[10px] font-mono text-slate-400 break-all">
                <span className="text-slate-500 block text-[9px] uppercase font-black tracking-wider font-mono mb-0.5">Computed Checksum MD5</span>
                {otaChecksum}
              </div>
            )}
          </div>

          <button
            onClick={handleOtaUpload}
            disabled={!otaFile || otaUploading || !hasOtaAccess}
            className={`w-full mt-6 py-3.5 px-4 rounded-xl font-black text-xs uppercase tracking-widest transition flex items-center justify-center gap-2 cursor-pointer ${
              !otaFile || otaUploading || !hasOtaAccess
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-850'
                : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/20'
            }`}
          >
            {otaUploading ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Validating & Deploying...
              </>
            ) : (
              'Deploy Firmware Over-The-Air'
            )}
          </button>
        </div>
        
      </div>
      
    </div>
  );
}
