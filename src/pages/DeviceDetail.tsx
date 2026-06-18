// src/pages/DeviceDetail.tsx
import React, { useState, useEffect, useRef } from 'react';
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
  Play, Sliders, Sun, Brain, Camera, Video, Compass, MapPin, Radio, Wifi, Shield
} from 'lucide-react';

// Generates mock telemetry data if the Supabase tables are empty
function generateMockHistory(devId: string): TelemetryData[] {
  const now = Date.now();
  const list: TelemetryData[] = [];
  for (let hour = 24; hour > 0; hour--) {
    const time = new Date(now - hour * 3600 * 1000);
    const hourOfDay = time.getHours();

    // Solar pattern simulation
    const solarFactor = hourOfDay > 6 && hourOfDay < 18 ? Math.sin((hourOfDay - 6) / 12 * Math.PI) : 0;
    const v = solarFactor > 0 ? 12 + solarFactor * 8 + (Math.random() - 0.5) : 0;
    const i = solarFactor > 0 ? 1 + solarFactor * 4 + (Math.random() * 0.4) : 0;
    const p = v * i;
    const temp = 25 + solarFactor * 25 + (Math.random() * 5);
    const humidity = 40 + Math.random() * 30;
    const ldrBase = Math.floor(solarFactor * 3500);

    list.push({
      id: Math.floor(Math.random() * 1000000),
      device_id: devId,
      v,
      i,
      p,
      temp,
      humidity,
      fault: 0,
      ldr: [
        Math.max(100, Math.floor(ldrBase + (Math.random() - 0.5) * 200)),
        Math.max(100, Math.floor(ldrBase + (Math.random() - 0.5) * 200)),
        Math.max(100, Math.floor(ldrBase + (Math.random() - 0.5) * 200)),
        Math.max(100, Math.floor(ldrBase + (Math.random() - 0.5) * 200)),
      ],
      timestamp: time.toISOString()
    });
  }
  return list;
}

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
  const [isAiControl, setIsAiControl] = useState(false);
  const [aiLogs, setAiLogs] = useState<string[]>(["[AI Engine] Initialized in passive monitoring mode."]);
  
  // Camera States
  const [camIp, setCamIp] = useState(() => localStorage.getItem('sm_cam_ip') || '192.168.1.50');
  const [isStreaming, setIsStreaming] = useState(false);
  const [lastUploadTime, setLastUploadTime] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Simulated latency tick
  const [latency, setLatency] = useState(24);

  useEffect(() => {
    const interval = setInterval(() => {
      setLatency(prev => {
        const change = Math.floor(Math.random() * 5) - 2;
        return Math.max(12, Math.min(45, prev + change));
      });
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleCamIpChange = (ip: string) => {
    setCamIp(ip);
    localStorage.setItem('sm_cam_ip', ip);
  };

  useEffect(() => {
    if (isLiveMode) {
      setLastUploadTime(new Date().toISOString());
      return;
    }

    let intervalId: any;
    const fetchCameraStatus = async () => {
      try {
        const res = await fetch('/api/camera/status');
        if (res.status === 404) {
          console.warn("Camera status endpoint not found (404). Stopping polling loop.");
          if (intervalId) clearInterval(intervalId);
          return;
        }
        if (res.ok) {
          const data = await res.json();
          if (data.lastUploadTime) {
            setLastUploadTime(data.lastUploadTime);
          }
        }
      } catch (err) {
        console.error('Failed to fetch camera status:', err);
      }
    };
    fetchCameraStatus();
    intervalId = setInterval(fetchCameraStatus, 10000);
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  const lastCommandTimeRef = useRef<Record<string, number>>({});

  // Scroll to top on page load / device change
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [deviceId]);

  // AI Autonomous Control Loop
  useEffect(() => {
    if (!isAiControl || !deviceId || loading) return;
    
    const latestMetrics = liveTelemetry || history[history.length - 1];
    if (!latestMetrics) return;

    const runAiOptimization = async () => {
      const now = Date.now();

      // 1. High Temperature Stow
      if (latestMetrics.temp > 65.0 && device?.status !== 'stow') {
        const lastSent = lastCommandTimeRef.current['stow'] || 0;
        if (now - lastSent < 30000) return;
        lastCommandTimeRef.current['stow'] = now;

        const logMsg = `[AI Control]: Critical temp (${latestMetrics.temp.toFixed(1)}°C) detected on Node. Autonomously stowing panel flat.`;
        setAiLogs(prev => [logMsg, ...prev.slice(0, 9)]);
        try {
          await sendDeviceCommand(deviceId, 'stow');
        } catch (e) {
          console.error("AI Stow failed", e);
        }
      }
      // 2. Dust/Soiling Sweep
      else if (latestMetrics.fault === 1) { // Dust detected
        const lastSent = lastCommandTimeRef.current['clean'] || 0;
        if (now - lastSent < 45000) return;
        lastCommandTimeRef.current['clean'] = now;

        const logMsg = `[AI Control]: Surface soiling anomaly detected (yield drop 18%). Dispatched autonomous cleaning cycle.`;
        setAiLogs(prev => [logMsg, ...prev.slice(0, 9)]);
        try {
          await sendDeviceCommand(deviceId, 'clean');
        } catch (e) {
          console.error("AI Clean failed", e);
        }
      }
      // 3. High Wind Stow
      else if (latestMetrics.fault === 6) { // High Wind
        const lastSent = lastCommandTimeRef.current['stow'] || 0;
        if (now - lastSent < 30000) return;
        lastCommandTimeRef.current['stow'] = now;

        const logMsg = `[AI Control]: High wind velocities registered by anemometer. Stowing panel flat for structural protection.`;
        setAiLogs(prev => [logMsg, ...prev.slice(0, 9)]);
        try {
          await sendDeviceCommand(deviceId, 'stow');
        } catch (e) {
          console.error("AI Stow failed", e);
        }
      }
      // 4. Shading / Hotspot optimization
      else if (latestMetrics.fault === 2) { // Shading
        const lastSent = lastCommandTimeRef.current['override'] || 0;
        if (now - lastSent < 10000) return;
        lastCommandTimeRef.current['override'] = now;

        const logMsg = `[AI Control]: Shading pattern detected. Overriding closed-loop LDR. Shifted Azimuth offset by +15° to capture diffuse scatter light.`;
        setAiLogs(prev => [logMsg, ...prev.slice(0, 9)]);
        // Automatically shift manual angles
        setIsAutoTracking(false);
        setManualAzimuth(15); 
        setManualElevation(60);
      }
    };

    runAiOptimization();
  }, [liveTelemetry, isAiControl, deviceId, loading, device?.status, history]);

  // Initial Load & Fetching trailing 24 hours with robust fallbacks
  useEffect(() => {
    async function fetchDeviceData() {
      if (!deviceId) return;
      
      try {
        const { data: devInfo, error: devError } = await supabase
          .from('devices')
          .select('*')
          .eq('id', deviceId)
          .single();

        if (devError || !devInfo) {
          console.warn("Device ID not found in database, applying local simulation fallback.");
          const mockDev = mockDb.getDevices().find(x => x.id === deviceId) || {
            id: deviceId,
            name: 'Rajalakshmi Institute of Technology',
            serial_number: 'SM-ESP32-RIT01',
            owner_id: 'user-id-123',
            latitude: 13.037945701528033,
            longitude: 80.0448727760485,
            status: 'online',
            current_firmware_version: 'v1.0.0',
            created_at: new Date().toISOString()
          };
          setDevice(mockDev);
        } else {
          setDevice(devInfo);
        }
      } catch (err) {
        console.error("Error loading device metadata, using fallback:", err);
        setDevice({
          id: deviceId,
          name: 'Rajalakshmi Institute of Technology',
          serial_number: 'SM-ESP32-RIT01',
          owner_id: 'user-id-123',
          latitude: 13.037945701528033,
          longitude: 80.0448727760485,
          status: 'online',
          current_firmware_version: 'v1.0.0',
          created_at: new Date().toISOString()
        });
      }

      try {
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { data: histData, error: histError } = await supabase
          .from('telemetry')
          .select('*')
          .eq('device_id', deviceId)
          .gte('timestamp', yesterday)
          .order('timestamp', { ascending: true });

        if (histError || !histData || histData.length === 0) {
          setHistory(generateMockHistory(deviceId));
        } else {
          setHistory(histData);
        }
      } catch (err) {
        console.error("Error loading telemetry history, generating mock fallback:", err);
        setHistory(generateMockHistory(deviceId));
      }
      setLoading(false);
    }
    fetchDeviceData();
  }, [deviceId]);

  // Append live data to local memory state
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

  // Poll custom API server middleware for physical device telemetry streams (works in both local and live/Vercel modes)
  useEffect(() => {
    if (!deviceId) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/telemetry/poll');
        if (res.status === 404) {
          clearInterval(interval);
          console.warn('⚠️ Backend API polling endpoint returned 404. Disabling polling loop.');
          return;
        }
        if (res.ok) {
          const data = await res.json();
          if (data.telemetry && data.telemetry.length > 0) {
            data.telemetry.forEach((t: any) => {
              if (t.device_id === deviceId) {
                // Inject into mockDb for local mode
                mockDb.injectExternalTelemetry(deviceId, t);
                // Also directly update live history so KPI cards refresh in all modes
                setHistory(prev => {
                  if (prev.length > 0 && prev[prev.length - 1].timestamp === t.timestamp) return prev;
                  return [...prev.slice(-48), t];
                });
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
        // Silently swallow — expected when no local server running in pure Vercel mode
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [deviceId]);

  // Send manual override command when sliders/tracking changes
  // Fast-lane: POST directly to local /api/commands/override (no Supabase latency)
  // Fallback: also insert to Supabase so Vercel/remote control keeps working
  useEffect(() => {
    if (!deviceId || loading) return;
    if (userRole === 'Visitor') return;

    const payload = {
      device_id: deviceId,
      auto:      isAutoTracking,
      azimuth:   manualAzimuth,
      elevation: manualElevation,
    };

    // 1. Fast-lane local post (fire immediately, no debounce)
    fetch('/api/commands/override', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    }).catch(() => { /* local server offline — no-op */ });

    // 2. Supabase insert (50ms debounce to avoid hammering during rapid slider drag)
    const delayDebounce = setTimeout(async () => {
      try {
        await supabase.from('commands').insert({
          device_id: deviceId,
          action:    'override' as any,
          payload:   { auto: isAutoTracking, azimuth: manualAzimuth, elevation: manualElevation },
          status:    'pending'
        });
      } catch (err) {
        console.error('Failed to send override command to Supabase:', err);
      }
    }, 50);

    return () => clearTimeout(delayDebounce);
  }, [isAutoTracking, manualAzimuth, manualElevation, deviceId, loading, userRole]);

  // Compute MD5 Checksum on file selection
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

  // OTA Firmware Deployment Pipeline
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

  // Trigger hardware actions
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

  const getCameraImgSrc = () => {
    if (isStreaming) {
      return `http://${camIp}/stream`;
    }
    if (isLiveMode) {
      // In live production mode (Vercel), show a high-quality solar panel placeholder image to avoid 404
      return "https://images.unsplash.com/photo-1508514177221-188b1cf16e9d?w=600&auto=format&fit=crop";
    }
    return `/camera.jpg?t=${refreshTrigger}-${lastUploadTime || ''}`;
  };

  if (loading) return (
    <div className="flex h-screen items-center justify-center bg-slate-950 text-orange-500">
      <RefreshCw className="h-10 w-10 animate-spin text-glow-solar" />
    </div>
  );

  const rawMetrics = liveTelemetry || history[history.length - 1] || { v: 0, i: 0, p: 0, temp: 0, fault: 0, ldr: [0,0,0,0], id: 0 };
  
  const currentMetrics = {
    v: typeof rawMetrics.v === 'number' ? rawMetrics.v : 0,
    i: typeof rawMetrics.i === 'number' ? rawMetrics.i : 0,
    p: typeof rawMetrics.p === 'number' ? rawMetrics.p : 0,
    temp: typeof rawMetrics.temp === 'number' ? rawMetrics.temp : 0,
    humidity: typeof rawMetrics.humidity === 'number' ? rawMetrics.humidity : 55,
    fault: typeof rawMetrics.fault === 'number' ? rawMetrics.fault : 0,
    ldr: Array.isArray(rawMetrics.ldr) ? rawMetrics.ldr : [0, 0, 0, 0],
    id: typeof rawMetrics.id === 'number' ? rawMetrics.id : 0,
  };

  // Sanitize LDR inputs to ensure they are numeric values and don't cause NaN issues
  const safeLdr = currentMetrics.ldr.map((val: any) => {
    const num = typeof val === 'number' ? val : parseFloat(val);
    return isNaN(num) ? 0 : num;
  });
  while (safeLdr.length < 4) safeLdr.push(0);

  // Calculate dynamic Panel Angle relative to Horizon
  const leftAvg = (safeLdr[0] + safeLdr[1]) / 2;
  const rightAvg = (safeLdr[2] + safeLdr[3]) / 2;
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
      return "WARNING [AI CORE]: Panel degradation metrics spike. Local resistance hotspot detected via 1D-CNN thermal analyzer. Actuator commanded to stow angle (0° tilt) to reduce heat exposure.";
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

  // Run Edge 1D-CNN Inference simulation
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
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-8 font-sans selection:bg-orange-500 selection:text-slate-955">
      
      {/* 🔝 Dashboard Header Cockpit */}
      <div className="glass-panel aadhavan-sun-glow p-6 rounded-3xl mb-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 h-40 w-40 bg-orange-500/5 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-orange-500" />
        <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-orange-500" />
        <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-orange-500" />
        <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-orange-500" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <Link to="/dashboard" className="p-3 bg-slate-900/80 hover:bg-slate-800 border border-slate-800 hover:border-orange-500/30 rounded-2xl transition duration-300 text-slate-400 hover:text-white flex items-center justify-center">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white font-sans text-glow-solar">
                  {device?.name || 'AadhavanAI Simulation Node'}
                </h1>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black border uppercase tracking-wider ${
                  device?.status === 'online' 
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                    : device?.status === 'fault'
                    ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                    : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                }`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${
                    device?.status === 'online' 
                      ? 'bg-emerald-400 animate-pulse' 
                      : device?.status === 'fault'
                      ? 'bg-rose-400 animate-pulse'
                      : 'bg-amber-400'
                  }`} />
                  {device?.status || 'ONLINE'}
                </span>
              </div>
              <p className="text-slate-500 text-xs mt-1.5 font-mono">
                DEVICE_ID: <span className="text-slate-400 font-bold">{device?.id || deviceId}</span>
              </p>
            </div>
          </div>

          {/* Metadata Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-slate-950/80 border border-slate-900 rounded-2xl p-4 font-mono text-[10px]">
            <div className="space-y-1">
              <span className="text-slate-500 uppercase flex items-center gap-1"><MapPin className="h-3 w-3 text-orange-500" /> GPS COORDS</span>
              <span className="text-slate-300 font-bold block">13.0379° N, 80.0448° E</span>
            </div>
            <div className="space-y-1 border-l border-slate-900/60 pl-4">
              <span className="text-slate-500 uppercase flex items-center gap-1"><Compass className="h-3 w-3 text-cyan-400" /> NODE SERIAL</span>
              <span className="text-slate-300 font-bold block">{device?.serial_number || 'SM-ESP32-RIT01'}</span>
            </div>
            <div className="space-y-1 border-l border-slate-900/60 pl-4">
              <span className="text-slate-500 uppercase flex items-center gap-1"><Radio className="h-3 w-3 text-yellow-500" /> FIRMWARE</span>
              <span className="text-yellow-400 font-bold block">{device?.current_firmware_version || 'v1.0.0'}</span>
            </div>
            <div className="space-y-1 border-l border-slate-900/60 pl-4">
              <span className="text-slate-500 uppercase flex items-center gap-1"><Wifi className="h-3 w-3 text-emerald-400" /> PING RATIO</span>
              <span className="text-emerald-400 font-bold block flex items-center gap-1">
                {latency} ms <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
              </span>
            </div>
          </div>
        </div>
        
        {/* Commands Status Feed inside Cockpit */}
        {commandStatus && (
          <div className="mt-4 p-3 bg-slate-900/80 border border-slate-800/80 rounded-xl text-xs flex items-center gap-2 font-mono">
            <div className="h-2 w-2 rounded-full bg-orange-500 animate-ping" />
            <span className="text-slate-300 font-semibold">{commandStatus}</span>
          </div>
        )}
      </div>

      {/* 🔒 RBAC Banner Warning */}
      {userRole === 'Visitor' && (
        <div className="mb-6 p-4 bg-orange-500/10 border border-orange-500/20 rounded-2xl flex items-center gap-3 text-orange-400 text-xs font-bold font-mono">
          <ShieldAlert className="h-5 w-5 shrink-0 text-orange-500" />
          <span>You are logged in as a <strong className="text-white">Visitor</strong>. Manual steer parameters and OTA firmware actions are locked. Switch roles in the top header to unlock commands.</span>
        </div>
      )}

      {/* 🚀 KPI Dashboard Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4 sm:gap-6 mb-8">
        {/* Voltage Card */}
        <div className="glass-panel p-5 rounded-2xl relative overflow-hidden transition duration-300 hover:border-orange-500/20 group">
          <div className="absolute top-0 right-0 h-16 w-16 bg-orange-500/5 rounded-full blur-lg" />
          <p className="text-[10px] text-slate-500 uppercase font-black tracking-wider font-mono">PV Array Voltage</p>
          <p className="text-3xl font-black text-white mt-2 tracking-tighter font-sans">{currentMetrics.v.toFixed(1)} <span className="text-xs text-slate-500 font-normal font-mono">V</span></p>
          <div className="text-[9px] text-slate-500 mt-2 font-mono">VOC_LIMIT: 24.0V</div>
        </div>

        {/* Current Card */}
        <div className="glass-panel p-5 rounded-2xl relative overflow-hidden transition duration-300 hover:border-cyan-500/20 group">
          <div className="absolute top-0 right-0 h-16 w-16 bg-cyan-500/5 rounded-full blur-lg" />
          <p className="text-[10px] text-slate-500 uppercase font-black tracking-wider font-mono">Ingested Loop Current</p>
          <p className="text-3xl font-black text-white mt-2 tracking-tighter font-sans">{currentMetrics.i.toFixed(2)} <span className="text-xs text-slate-500 font-normal font-mono">A</span></p>
          <div className="text-[9px] text-slate-500 mt-2 font-mono">IASC_LIMIT: 5.0A</div>
        </div>

        {/* Total Power Card */}
        <div className="glass-panel p-5 rounded-2xl relative overflow-hidden transition duration-300 hover:border-yellow-500/20 group">
          <div className="absolute top-0 right-0 h-16 w-16 bg-yellow-500/5 rounded-full blur-lg" />
          <p className="text-[10px] text-slate-500 uppercase font-black tracking-wider font-mono">Net Power Generated</p>
          <p className="text-3xl font-black text-white mt-2 tracking-tighter font-sans">{currentMetrics.p.toFixed(2)} <span className="text-xs text-slate-500 font-normal font-mono">W</span></p>
          <div className="text-[9px] text-slate-500 mt-2 font-mono">CALCULATED: V * I</div>
        </div>

        {/* Temperature Card */}
        <div className="glass-panel p-5 rounded-2xl relative overflow-hidden transition duration-300 hover:border-rose-500/20 group">
          <div className="absolute top-0 right-0 h-16 w-16 bg-rose-500/5 rounded-full blur-lg" />
          <p className="text-[10px] text-slate-500 uppercase font-black tracking-wider font-mono">Panel Temperature</p>
          <p className={`text-3xl font-black mt-2 tracking-tighter font-sans ${currentMetrics.temp > 60 ? 'text-rose-500 text-glow-rose' : 'text-white'}`}>
            {currentMetrics.temp.toFixed(1)} <span className="text-xs text-slate-500 font-normal font-mono">°C</span>
          </p>
          <div className="text-[9px] text-slate-500 mt-2 font-mono">TEMP_LIMIT: 65.0°C</div>
        </div>

        {/* Humidity Card */}
        <div className="glass-panel p-5 rounded-2xl relative overflow-hidden transition duration-300 hover:border-emerald-500/20 group">
          <div className="absolute top-0 right-0 h-16 w-16 bg-emerald-500/5 rounded-full blur-lg" />
          <p className="text-[10px] text-slate-500 uppercase font-black tracking-wider font-mono">Relative Humidity</p>
          <p className="text-3xl font-black text-white mt-2 tracking-tighter font-sans">
            {currentMetrics.humidity.toFixed(0)} <span className="text-xs text-slate-500 font-normal font-mono">%</span>
          </p>
          <div className="text-[9px] text-slate-500 mt-2 font-mono">DHT11 SENSOR</div>
        </div>
      </div>

      {/* 📊 Main Content Area: Charts & Widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        
        {/* Left Column: Generation Chart & AI Fault Console */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Recharts Analytics Chart */}
          <div className="glass-panel p-6 rounded-3xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-orange-500" />
            <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-orange-500" />
            <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-orange-500" />
            <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-orange-500" />

            <h2 className="text-sm font-black text-white mb-4 uppercase tracking-wider flex items-center gap-2 font-mono">
              <Sun className="h-4 w-4 text-orange-500" /> Synchronized Generation & Thermal Profiling
            </h2>
            
            <div className="h-80 w-full font-mono text-[10px]">
              {history.length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-500">Connecting to telemetry stream...</div>
              ) : (
                <ResponsiveContainer width="100%" height={320}>
                  <LineChart data={history} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorPower" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                    <XAxis 
                      dataKey="timestamp" 
                      tickFormatter={(t) => t ? new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : ''}
                      stroke="#475569" 
                      style={{ fontSize: '9px' }}
                    />
                    <YAxis yAxisId="left" stroke="#06b6d4" style={{ fontSize: '9px' }} />
                    <YAxis yAxisId="right" orientation="right" stroke="#f43f5e" style={{ fontSize: '9px' }} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#020617', borderColor: 'rgba(249, 115, 22, 0.2)', color: '#fff', fontSize: '11px', borderRadius: '12px' }} 
                      labelFormatter={(l) => l ? new Date(l).toLocaleTimeString() : ''} 
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
            <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-orange-500" />
            <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-orange-500" />
            <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-orange-500" />
            <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-orange-500" />

            <h2 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2 mb-6 font-mono">
              <Cpu className="text-orange-500 h-5 w-5 text-glow-solar" /> Intelligent Fault Detection & Diagnostics
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <h3 className="text-[9px] uppercase font-black tracking-widest font-mono text-slate-500 mb-2">Edge IoT Diagnostics</h3>
                  <div className="grid grid-cols-3 gap-2">
                    <div className={`py-2 px-1 rounded-xl border text-center font-mono text-[9px] uppercase tracking-wider font-bold transition duration-300 ${
                      isOpenCircuit 
                        ? 'bg-rose-500/10 text-rose-400 border-rose-500/35 text-glow-rose animate-pulse'
                        : 'bg-slate-950/40 text-slate-650 border-slate-900'
                    }`}>
                      Open Circ
                    </div>
                    <div className={`py-2 px-1 rounded-xl border text-center font-mono text-[9px] uppercase tracking-wider font-bold transition duration-300 ${
                      isShortCircuit 
                        ? 'bg-rose-500/10 text-rose-400 border-rose-500/35 text-glow-rose animate-pulse'
                        : 'bg-slate-950/40 text-slate-650 border-slate-900'
                    }`}>
                      Short Circ
                    </div>
                    <div className={`py-2 px-1 rounded-xl border text-center font-mono text-[9px] uppercase tracking-wider font-bold transition duration-300 ${
                      isPanelFailure 
                        ? 'bg-rose-500/10 text-rose-400 border-rose-500/35 text-glow-rose animate-pulse'
                        : 'bg-slate-950/40 text-slate-650 border-slate-900'
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
                        ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/35 text-glow-gold animate-pulse'
                        : 'bg-slate-950/40 text-slate-650 border-slate-900'
                    }`}>
                      Dust/Soil
                    </div>
                    <div className={`py-2 px-1 rounded-xl border text-center font-mono text-[9px] uppercase tracking-wider font-bold transition duration-300 ${
                      isBirdDroppings 
                        ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/35 text-glow-gold animate-pulse'
                        : 'bg-slate-950/40 text-slate-650 border-slate-900'
                    }`}>
                      Droppings
                    </div>
                    <div className={`py-2 px-1 rounded-xl border text-center font-mono text-[9px] uppercase tracking-wider font-bold transition duration-300 ${
                      isPartialShading 
                        ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/35 text-glow-gold animate-pulse'
                        : 'bg-slate-950/40 text-slate-650 border-slate-900'
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
                      : 'border-slate-850 text-orange-400 bg-orange-950/5'
                  }`}>
                    {getAgenticAlert()}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* AadhavanAI Camera Visual Inspection Panel */}
          <div className="glass-panel p-6 rounded-3xl relative overflow-hidden transition hover:border-orange-500/20 group">
            <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-orange-500" />
            <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-orange-500" />
            <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-orange-500" />
            <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-orange-500" />
            
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2 font-mono">
                  <Camera className="text-orange-500 h-5 w-5" /> AadhavanAI Optical Inspection Feed
                </h2>
                <p className="text-[10px] text-slate-500 font-mono">SYS_CAMERA_VISUAL_MONITORING_UNIT</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-slate-400 font-mono bg-slate-900 border border-slate-800 px-2 py-1 rounded-md">
                  OV2640 CAMERA MODULE
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              {/* Image Frame Column */}
              <div className="md:col-span-7 flex flex-col justify-center">
                <div className="relative aspect-video rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 flex items-center justify-center group/screen">
                  <div className="absolute inset-0 bg-grid-white/[0.02] pointer-events-none" />
                  
                  <img 
                    src={getCameraImgSrc()} 
                    alt={isStreaming ? "Live Stream" : "Last Capture"} 
                    className="w-full h-full object-cover animate-fade-in"
                    onError={(e) => {
                      if (isStreaming) {
                        setIsStreaming(false);
                        alert("Failed to connect to ESP32-CAM live stream. Make sure the camera is online and your browser has local IP access to http://" + camIp);
                      } else {
                        (e.target as any).style.display = 'none';
                        const parent = (e.target as any).parentNode;
                        const placeholder = parent.querySelector('.placeholder-text');
                        if (placeholder) placeholder.style.display = 'flex';
                      }
                    }}
                    onLoad={(e) => {
                      if (!isStreaming) {
                        (e.target as any).style.display = 'block';
                        const parent = (e.target as any).parentNode;
                        const placeholder = parent.querySelector('.placeholder-text');
                        if (placeholder) placeholder.style.display = 'none';
                      }
                    }}
                  />
                  
                  {/* Fallback Placeholder Text */}
                  <div className="placeholder-text absolute inset-0 hidden flex-col items-center justify-center text-slate-500 p-4 font-mono text-center">
                    <Video className="h-10 w-10 text-slate-600 mb-2 animate-pulse" />
                    <span className="text-xs">No Photo Uploaded Yet</span>
                    <span className="text-[9px] text-slate-600 mt-1 max-w-[250px]">Hourly upload will update this frame. Make sure your ESP32-CAM is powered and configured.</span>
                  </div>

                  {/* Watermark Overlay */}
                  <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-md text-[9px] font-mono text-slate-300 border border-white/5 flex items-center gap-1.5 z-10">
                    <span className={`h-1.5 w-1.5 rounded-full ${isStreaming ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'}`} />
                    {isStreaming ? 'LIVE MONITORING' : 'STILL CAPTURE'}
                  </div>

                  <div className="absolute bottom-3 right-3 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-md text-[9px] font-mono text-slate-400 border border-white/5 z-10">
                    {lastUploadTime ? new Date(lastUploadTime).toLocaleTimeString() : 'N/A'}
                  </div>
                </div>
              </div>

              {/* Camera Configurations Column */}
              <div className="md:col-span-5 flex flex-col justify-between space-y-4">
                <div className="space-y-4">
                  {/* Mixed Content Browser Warning Alert */}
                  {window.location.protocol === 'https:' && (
                    <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-[9.5px] font-mono text-rose-450 leading-relaxed">
                      <p className="font-bold flex items-center gap-1.5 uppercase"><ShieldAlert className="h-3.5 w-3.5" /> HTTPS Mixed Content</p>
                      <p className="mt-1">Browsers block insecure camera streams (<code className="text-white">http://</code>) inside secure sites (<code className="text-white">https://</code>). To view the live feed, please launch the website locally on HTTP (e.g. <code className="text-white">http://localhost:5173</code>) or allow insecure content in your browser site permissions.</p>
                    </div>
                  )}

                  <div className="p-4 bg-slate-950/60 border border-slate-900 rounded-2xl space-y-3">
                    <h3 className="text-xs font-black text-slate-300 uppercase font-mono tracking-wider">Stream Configuration</h3>
                    
                    <div>
                      <label className="text-[9px] text-slate-500 uppercase font-black tracking-wider block mb-1">ESP32-CAM Local IP Address</label>
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          value={camIp}
                          onChange={(e) => handleCamIpChange(e.target.value)}
                          placeholder="e.g. 192.168.1.50" 
                          className="flex-1 bg-slate-900 border border-slate-800 text-white rounded-xl px-3 py-1.5 text-xs font-mono focus:border-orange-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <div>
                        <span className="text-[10px] font-bold text-slate-300 block">Start Live Stream</span>
                        <span className="text-[9px] text-slate-500 font-mono">MJPEG stream via local network</span>
                      </div>
                      <button
                        onClick={() => setIsStreaming(!isStreaming)}
                        className={`relative inline-flex h-5.5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          isStreaming ? 'bg-rose-500' : 'bg-slate-800'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4.5 w-4.5 transform rounded-full bg-slate-950 shadow ring-0 transition duration-200 ease-in-out ${
                            isStreaming ? 'translate-x-4.5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  <div className="p-4 bg-slate-950/60 border border-slate-900 rounded-2xl space-y-2.5">
                    <h3 className="text-xs font-black text-slate-300 uppercase font-mono tracking-wider">Health & Timing</h3>
                    <div className="grid grid-cols-2 gap-4 text-left font-mono">
                      <div>
                        <span className="text-[9px] text-slate-500 block uppercase font-black">Interval</span>
                        <span className="text-xs text-slate-300">1 Hour</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-500 block uppercase font-black">WiFi Status</span>
                        <span className="text-xs text-emerald-400 font-bold">Connected</span>
                      </div>
                    </div>
                    <div className="border-t border-slate-900/60 pt-2 text-left font-mono">
                      <span className="text-[9px] text-slate-500 block uppercase font-black">Last Photo Uploaded</span>
                      <span className="text-[10px] text-slate-300 font-bold">
                        {lastUploadTime ? new Date(lastUploadTime).toLocaleString() : 'Waiting for initial capture...'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button 
                    onClick={() => setRefreshTrigger(prev => prev + 1)}
                    className="flex-1 py-2.5 px-3 bg-slate-900 border border-slate-800 hover:border-slate-700 active:bg-slate-950 text-slate-300 hover:text-white rounded-xl font-bold font-mono text-[10px] uppercase transition duration-200 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className="h-3 w-3" /> Refresh Image
                  </button>
                  <button 
                    onClick={async () => {
                      if (userRole === 'Visitor') {
                        alert('🔒 Access Denied: Visitor role cannot dispatch capture commands.');
                        return;
                      }
                      try {
                        await supabase.from('commands').insert({
                          device_id: deviceId,
                          action: 'capture' as any,
                          status: 'pending'
                        });
                        alert('Capture command queued! The camera will upload a new image in a few seconds.');
                      } catch (err) {
                        console.error('Failed to trigger capture:', err);
                      }
                    }}
                    className="flex-1 py-2.5 px-3 bg-orange-500/10 border border-orange-500/25 hover:border-orange-500/40 text-orange-400 hover:text-orange-350 rounded-xl font-bold font-mono text-[10px] uppercase transition duration-200 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Camera className="h-3.5 w-3.5" /> Capture Now
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: 3D Twin, Target HUD & Steering Compartment */}
        <div className="lg:col-span-1 space-y-8">
          
          {/* Interactive 3D Digital Twin */}
          <div className="glass-panel p-4 rounded-3xl relative overflow-hidden transition hover:border-orange-500/20 group">
            <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-orange-500" />
            <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-orange-500" />
            <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-orange-500" />
            <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-orange-500" />
            <div className="aspect-square w-full rounded-2xl overflow-hidden relative">
              <SolarDigitalTwin azimuth={panelAngle} elevation={isAutoTracking ? 45 : manualElevation} />
            </div>
          </div>

          {/* SVG Target tracking path alignment vector */}
          <div className="glass-panel p-6 rounded-3xl relative overflow-hidden hover:border-orange-500/25 transition duration-300">
            <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-orange-500" />
            <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-orange-500" />
            <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-orange-500" />
            <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-orange-500" />
            
            <div>
              <h2 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-1.5 font-mono">
                <Sun className="text-orange-500 h-4.5 w-4.5 text-glow-solar animate-spin-slow" /> Target Tracking HUD
              </h2>
              <p className="text-[10px] text-slate-500 font-mono mt-0.5">SYS_RADAR_SUN_ALIGNMENT_VECTOR</p>
            </div>

            <div className="flex justify-center items-center my-6 relative p-4 bg-slate-950/40 border border-slate-900 rounded-2xl">
              <div className="absolute inset-0 bg-grid-white/[0.02] rounded-2xl pointer-events-none" />
              
              <svg width="240" height="130" viewBox="0 0 240 130" className="overflow-visible z-10 font-mono">
                <line x1="10" y1="120" x2="230" y2="120" stroke="#1e293b" strokeWidth="2" />
                <path d="M 20 120 A 100 100 0 0 1 220 120" fill="none" stroke="rgba(249, 115, 22, 0.1)" strokeWidth="2" />
                <path d="M 50 120 A 70 70 0 0 1 190 120" fill="none" stroke="rgba(249, 115, 22, 0.15)" strokeWidth="1" strokeDasharray="3 3" />
                <path d="M 80 120 A 40 40 0 0 1 160 120" fill="none" stroke="rgba(249, 115, 22, 0.08)" strokeWidth="2" />
                
                <line x1="120" y1="120" x2="120" y2="20" stroke="rgba(249, 115, 22, 0.15)" strokeWidth="1" strokeDasharray="2 2" />
                <line x1="120" y1="120" x2="49.28" y2="49.28" stroke="rgba(249, 115, 22, 0.08)" strokeWidth="1" />
                <line x1="120" y1="120" x2="190.72" y2="49.28" stroke="rgba(249, 115, 22, 0.08)" strokeWidth="1" />
                
                {(() => {
                  const angleRad = (90 - panelAngle) * (Math.PI / 180);
                  const sunX = 120 + 100 * Math.cos(angleRad);
                  const sunY = 120 - 100 * Math.sin(angleRad);
                  return (
                    <>
                      <line x1="120" y1="120" x2={sunX} y2={sunY} stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="3 2" />
                      
                      <g transform={`translate(${sunX}, ${sunY})`}>
                        <circle cx="0" cy="0" r="10" fill="none" stroke="#f59e0b" strokeWidth="1" className="animate-ping" style={{ animationDuration: '3s' }} />
                        <circle cx="0" cy="0" r="6" fill="#f59e0b" />
                        <line x1="-8" y1="0" x2="8" y2="0" stroke="#f59e0b" strokeWidth="1" />
                        <line x1="0" y1="-8" x2="0" y2="8" stroke="#f59e0b" strokeWidth="1" />
                      </g>
                    </>
                  );
                })()}

                <g transform={`translate(120, 120) rotate(${panelAngle})`}>
                  <line x1="0" y1="0" x2="0" y2="-20" stroke="#64748b" strokeWidth="5" />
                  <circle cx="0" cy="0" r="6" fill="#0f172a" stroke="#64748b" strokeWidth="3" />
                  <line x1="-45" y1="-20" x2="45" y2="-20" stroke="#f59e0b" strokeWidth="5" strokeLinecap="round" />
                  <line x1="-38" y1="-23" x2="-5" y2="-23" stroke="#1e3a8a" strokeWidth="1.5" />
                  <line x1="5" y1="-23" x2="38" y2="-23" stroke="#1e3a8a" strokeWidth="1.5" />
                  <circle cx="-42" cy="-20" r="2" fill="#f43f5e" />
                  <circle cx="42" cy="-20" r="2" fill="#f43f5e" />
                </g>
                
                <text x="12" y="115" fill="#475569" fontSize="8" fontWeight="bold">E_TGT</text>
                <text x="210" y="115" fill="#475569" fontSize="8" fontWeight="bold">W_TGT</text>
                <text x="123" y="32" fill="rgba(249, 115, 22, 0.4)" fontSize="7">ZENITH_90</text>
              </svg>
            </div>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-900 text-center text-[10px] font-mono flex items-center justify-between">
              <span className="text-slate-500 uppercase font-bold">ALIGN_EFFICIENCY:</span>
              <span className="font-extrabold text-emerald-400 font-mono">{(98.5 - Math.abs(calculatedPanelAngle * 0.05)).toFixed(2)}%</span>
            </div>
          </div>

        </div>
      </div>

      {/* 🎮 Overrides & Edge Diagnostics Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-8">
        
        {/* Card 1: Edge Steering Overrides */}
        <div className="glass-panel p-6 rounded-3xl relative overflow-hidden hover:border-orange-500/20 transition duration-300 flex flex-col justify-between">
          <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-orange-500" />
          <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-orange-500" />
          <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-orange-500" />
          <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-orange-500" />

          <div>
            <h2 className="text-sm font-black text-white mb-2 flex items-center gap-2 uppercase tracking-wider font-mono">
              <Settings className="text-orange-500 h-5 w-5 text-glow-solar" /> Edge Steering Overrides
            </h2>
            <p className="text-xs text-slate-400 mb-6 leading-normal">Manage tracking mode and tilt angles of the actuator motors.</p>

            {/* Toggle Switch */}
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800/85">
              <div>
                <span className="text-xs font-black uppercase tracking-wider text-slate-300 block font-mono">Closed-Loop Tracking</span>
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
                  isAutoTracking ? 'bg-orange-500' : 'bg-slate-800'
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
                  <span className={`text-xs font-mono font-bold ${isAutoTracking ? 'text-slate-550' : 'text-yellow-400'}`}>
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
                  className={`w-full h-1.5 rounded-lg appearance-none cursor-pointer bg-slate-800 accent-orange-500 focus:outline-none transition ${
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
                  <span className={`text-xs font-mono font-bold ${isAutoTracking ? 'text-slate-555' : 'text-cyan-400'}`}>
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
                className={`flex flex-col items-center justify-center py-2.5 px-1 bg-slate-950/60 border rounded-xl transition text-center hover:bg-slate-900 border-slate-850 hover:border-orange-500/30 text-[10px] uppercase font-bold text-slate-300 cursor-pointer ${
                  !hasControlsAccess ? 'opacity-40 cursor-not-allowed' : ''
                }`}
              >
                <Wind className="h-4 w-4 mb-1 text-cyan-400 animate-pulse" />
                Stow (0°)
              </button>

              <button
                onClick={() => triggerAction('clean')}
                disabled={!hasControlsAccess}
                className={`flex flex-col items-center justify-center py-2.5 px-1 bg-slate-950/60 border rounded-xl transition text-center hover:bg-slate-900 border-slate-850 hover:border-yellow-500/30 text-[10px] uppercase font-bold text-slate-300 cursor-pointer ${
                  !hasControlsAccess ? 'opacity-40 cursor-not-allowed' : ''
                }`}
              >
                <RotateCw className="h-4 w-4 mb-1 text-yellow-500" />
                Clean
              </button>

              <button
                onClick={() => triggerAction('reboot')}
                disabled={!hasControlsAccess}
                className={`flex flex-col items-center justify-center py-2.5 px-1 bg-slate-950/60 border rounded-xl transition text-center hover:bg-slate-900 border-slate-850 hover:border-rose-500/30 text-[10px] uppercase font-bold text-slate-300 cursor-pointer ${
                  !hasControlsAccess ? 'opacity-40 cursor-not-allowed' : ''
                }`}
              >
                <Cpu className="h-4 w-4 mb-1 text-rose-500" />
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
            <h2 className="text-sm font-black text-white mb-2 flex items-center gap-2 uppercase tracking-wider font-mono">
              <Cpu className="text-emerald-500 h-5 w-5 text-glow-cyan" /> ESP32 Edge AI Diagnostics
            </h2>
            <p className="text-xs text-slate-400 leading-normal mb-4">
              Execute a simulated 1D-CNN deep learning classifier to isolate tracking and sensor anomalies.
            </p>

            {/* Glowing Terminal with animated softmax bars */}
            <div className="my-2 p-4 bg-slate-950/90 border border-slate-900 rounded-xl font-mono text-[10px] leading-relaxed text-slate-300 min-h-60 relative overflow-hidden flex flex-col justify-between">
              <div className="absolute inset-0 bg-scanline pointer-events-none opacity-[0.03]" />
              <div className="absolute top-0 right-0 h-16 w-16 bg-emerald-500/5 rounded-full blur-lg" />
              
              <div className="space-y-1 z-10 flex-grow">
                {inferencing ? (
                  <div className="space-y-1">
                    <p className="text-slate-500 animate-pulse">[+] INITIALIZING AI CORE ENGINE...</p>
                    <p className="text-slate-500 animate-pulse">[+] RETRIEVING LDR TIME-SERIES BUFFER...</p>
                    <p className="text-slate-400 animate-pulse">[D] CURRENT INPUT VEC: [{safeLdr.join(', ')}]</p>
                    <p className="text-emerald-500 animate-pulse">[!] RUNNING 1D-CNN CORE LAYER WEIGHTS...</p>
                  </div>
                ) : cnnOutput ? (
                  <div className="space-y-2.5">
                    <p className="text-[9px] text-slate-500">[INFO] INFERENCE COMPLETE (LATENCY: 1.22ms)</p>
                    <p className="text-emerald-400 font-bold text-[9px] uppercase tracking-wider">[SUCCESS] SOFTMAX CLASSIFICATION:</p>
                    
                    <div className="space-y-2 mt-1">
                      {[
                        { name: 'Healthy (Nominal)', pct: cnnOutput[0], color: 'bg-emerald-500' },
                        { name: 'Dust Soiling', pct: cnnOutput[1], color: 'bg-yellow-500' },
                        { name: 'Partial Shading', pct: cnnOutput[2], color: 'bg-blue-500' },
                        { name: 'Electrical Hotspot', pct: cnnOutput[3], color: 'bg-rose-500' },
                        { name: 'Actuator Blocked', pct: cnnOutput[4], color: 'bg-orange-500' },
                        { name: 'Sensor Degradation', pct: cnnOutput[5], color: 'bg-purple-500' },
                      ].map((cl, idx) => (
                        <div key={idx} className="space-y-0.5">
                          <div className="flex justify-between text-[8px] font-bold text-slate-400">
                            <span>CLASS #{idx}: {cl.name}</span>
                            <span className="font-mono text-white">{(cl.pct * 100).toFixed(1)}%</span>
                          </div>
                          <div className="w-full h-1 bg-slate-900 rounded-full overflow-hidden">
                            <div className={`h-full ${cl.color} transition-all duration-700 ease-out`} style={{ width: `${cl.pct * 100}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="h-full flex flex-col justify-center items-center text-center text-slate-500 py-8">
                    <Play className="h-6 w-6 text-slate-700 mb-2 animate-pulse" />
                    <p className="text-slate-400 font-bold text-xs uppercase tracking-wider font-mono">Edge Inference Standby</p>
                    <p className="text-[9px] text-slate-500 mt-1 max-w-[200px] leading-relaxed">Click below to run telemetry streams through the CNN layer weights.</p>
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
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-900'
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

        {/* Card 3: AI Autonomous Agent */}
        <div className="glass-panel p-6 rounded-3xl relative overflow-hidden hover:border-teal-500/20 transition duration-300 flex flex-col justify-between">
          <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-teal-500" />
          <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-teal-500" />
          <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-teal-500" />
          <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-teal-500" />

          <div>
            <h2 className="text-sm font-black text-white mb-2 flex items-center gap-2 uppercase tracking-wider font-mono">
              <Brain className="text-teal-400 h-5 w-5 animate-pulse" /> AI Autonomous Agent
            </h2>
            <p className="text-xs text-slate-400 mb-6 leading-normal font-sans">Enable closed-loop agentic overrides. The AI Core will monitor telemetry anomalies and dispatch commands autonomously.</p>

            {/* Toggle Switch */}
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800/80">
              <div>
                <span className="text-xs font-black uppercase tracking-wider text-slate-300 block font-mono">Agent Autonomy</span>
                <span className="text-[10px] text-slate-500 font-mono">Execute closed-loop mitigation loops</span>
              </div>
              <button
                onClick={() => {
                  if (!hasControlsAccess) {
                    alert('🔒 Access Denied: Visitor role cannot toggle AI controls.');
                    return;
                  }
                  setIsAiControl(!isAiControl);
                }}
                disabled={!hasControlsAccess}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  isAiControl ? 'bg-teal-500' : 'bg-slate-800'
                } ${!hasControlsAccess ? 'opacity-55 cursor-not-allowed' : ''}`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-slate-950 shadow ring-0 transition duration-200 ease-in-out ${
                    isAiControl ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* AI Action Logs */}
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-550 block mb-2 font-mono">Agent Operation Log</span>
              <div className="p-3 bg-slate-950 border border-slate-900 rounded-xl font-mono text-[9px] text-teal-400 leading-normal min-h-32 max-h-36 overflow-y-auto space-y-1.5 scrollbar-thin">
                {aiLogs.map((log, idx) => (
                  <p key={idx} className="border-l-2 border-teal-500/40 pl-2">{log}</p>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-slate-950/40 p-2.5 border border-slate-900 rounded-xl mt-4 text-center text-[9px] text-slate-500 font-mono uppercase">
            {isAiControl ? '🟢 Agent Active (Monitoring)' : '⚪ Agent Idle'}
          </div>
        </div>

        {/* Card 4: OTA Firmware Upgrades */}
        <div className="glass-panel p-6 rounded-3xl relative overflow-hidden hover:border-rose-500/20 transition duration-300 flex flex-col justify-between">
          <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-rose-500" />
          <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-rose-500" />
          <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-rose-500" />
          <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-rose-500" />

          <div>
            <h2 className="text-sm font-black text-white mb-2 flex items-center gap-2 uppercase tracking-wider font-mono">
              <Shield className="text-rose-500 h-5 w-5 text-glow-rose" /> OTA Firmware Deployment
            </h2>
            <p className="text-xs text-slate-400 mb-6 leading-normal">Compile and upload binary packages. Automated MD5 validation avoids bootloops or corruption issues.</p>

            {/* Lock overlay for Non-Admins */}
            {!hasOtaAccess ? (
              <div className="p-4 bg-slate-955 border border-slate-900 rounded-2xl text-slate-500 text-xs font-semibold text-center flex flex-col items-center justify-center gap-2 h-48">
                <ShieldAlert className="h-6 w-6 text-rose-500/30" />
                <span className="uppercase font-mono text-[9px] tracking-wider">Firmware upload locked.<br/>Requires Admin privilege.</span>
              </div>
            ) : (
              <div className="border-2 border-dashed border-slate-800 hover:border-orange-500/35 hover:bg-orange-500/5 rounded-2xl p-6 text-center transition duration-300 bg-slate-950/60">
                <input 
                  type="file" 
                  accept=".bin" 
                  id="firmware-file-input-detail" 
                  onChange={handleFileChange} 
                  className="hidden" 
                />
                <label htmlFor="firmware-file-input-detail" className="cursor-pointer block font-mono">
                  <Cpu className="h-8 w-8 text-slate-650 mx-auto mb-2" />
                  <span className="text-[11px] text-slate-300 font-black block uppercase tracking-wider">
                    {otaFile ? otaFile.name : 'Select firmware.bin'}
                  </span>
                  <span className="text-[9px] text-slate-500 block mt-1">Compiled binary files only</span>
                </label>
              </div>
            )}

            {otaChecksum && (
              <div className="mt-4 p-3 bg-slate-950/80 border border-slate-900 rounded-xl text-[10px] font-mono text-slate-400 break-all">
                <span className="text-slate-550 block text-[9px] uppercase font-black tracking-wider mb-0.5">Computed Checksum MD5</span>
                {otaChecksum}
              </div>
            )}
          </div>

          <button
            onClick={handleOtaUpload}
            disabled={!otaFile || otaUploading || !hasOtaAccess}
            className={`w-full mt-6 py-3.5 px-4 rounded-xl font-black text-xs uppercase tracking-widest transition flex items-center justify-center gap-2 cursor-pointer ${
              !otaFile || otaUploading || !hasOtaAccess
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-900'
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
