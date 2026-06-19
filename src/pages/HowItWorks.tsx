// src/pages/HowItWorks.tsx
import { useState, useEffect } from 'react';
import { Compass, Cpu, Zap, Cloud, Database, Brain, ChevronDown, Activity, Wifi } from 'lucide-react';
import { mockDb } from '../services/mockDb';

export default function HowItWorks() {
  const [expandedSpec, setExpandedSpec] = useState<string | null>('hardware');
  const [liveData, setLiveData] = useState({ p: 0, temp: 0, v: 0, i: 0, fault: 0, status: 'online' });

  // Pull live telemetry for the preview card
  useEffect(() => {
    const syncData = () => {
      const devices = mockDb.getDevices();
      if (devices.length > 0) {
        const dev = devices[0];
        const tel = mockDb.getTelemetry(dev.id);
        const latest = tel[tel.length - 1];
        if (latest) {
          setLiveData({
            p: latest.p || 0,
            temp: latest.temp || 0,
            v: latest.v || 0,
            i: latest.i || 0,
            fault: latest.fault || 0,
            status: dev.status,
          });
        }
      }
    };
    syncData();
    const unsub = mockDb.subscribe(syncData);
    return () => unsub();
  }, []);

  const pipelineSteps = [
    {
      step: '01',
      icon: <Compass className="h-6 w-6 text-amber-500" />,
      color: 'border-amber-200 bg-amber-50 text-amber-600',
      title: 'Sun Position & LDRs',
      desc: 'Four LDR photodiode sensors measure light intensity differentials to compute the sun vector in real time.',
      detail: 'LDR sensors are arranged in a cross-pattern on the panel edges. The ESP32 reads all four ADC channels at 100Hz, computing the differential to determine which direction the sun is offset from the tracker\'s current pointing angle.',
    },
    {
      step: '02',
      icon: <Cpu className="h-6 w-6 text-blue-500" />,
      color: 'border-blue-200 bg-blue-50 text-blue-600',
      title: 'ESP32-C6 Microcontroller',
      desc: 'RISC-V core reads sensor inputs, runs AI inference, and coordinates motor tilt actions.',
      detail: 'The ESP32-C6 features a single-core 32-bit RISC-V processor clocking at up to 160MHz with 512KB SRAM. It hosts our INT8-quantized CNN model in flash, runs the closed-loop tracker PID, and manages Wi-Fi 6 connectivity simultaneously.',
    },
    {
      step: '03',
      icon: <Zap className="h-6 w-6 text-emerald-500" />,
      color: 'border-emerald-200 bg-emerald-50 text-emerald-600',
      title: 'High-Torque Actuators',
      desc: 'Dual-axis metal gear servo motors rotate the panel to align with maximum light coordinates.',
      detail: 'We use DS3218 digital servos rated at 20kg/cm torque on the azimuth axis and 15kg/cm on the elevation axis. PWM duty-cycle commands from the ESP32 produce micro-adjustments of 0.1° resolution, driven at 50Hz.',
    },
    {
      step: '04',
      icon: <Brain className="h-6 w-6 text-purple-500" />,
      color: 'border-purple-200 bg-purple-50 text-purple-600',
      title: 'Edge AI 1D-CNN Model',
      desc: 'INT8-quantized neural net classifies 9 electrical/thermal anomaly classes in under 1ms.',
      detail: 'A 5-layer 1D Convolutional Neural Network is trained on 50,000 labeled sensor sequences. Post-training quantization reduces it to 180KB, fitting in ESP32 flash. TensorFlow Lite Micro runtime executes inference in ~0.8ms per cycle.',
    },
    {
      step: '05',
      icon: <Cloud className="h-6 w-6 text-cyan-500" />,
      color: 'border-cyan-200 bg-cyan-50 text-cyan-600',
      title: 'HiveMQ Cloud Gateway',
      desc: 'Real-time MQTT telemetry packets dispatched to cloud broker securely via TLS 1.3.',
      detail: 'Each ESP32 publishes to HiveMQ Cloud every 2 seconds over a TLS-encrypted MQTT connection. Topics are namespaced per device: aadhavan/{device_id}/telemetry. A Supabase edge function subscribes to the broker and writes rows to PostgreSQL.',
    },
    {
      step: '06',
      icon: <Database className="h-6 w-6 text-indigo-500" />,
      color: 'border-indigo-200 bg-indigo-50 text-indigo-600',
      title: 'Supabase Dashboard',
      desc: 'CDC triggers live dashboard updates and alerts fleet operators via Telegram bots instantly.',
      detail: 'Supabase Realtime uses PostgreSQL logical replication (CDC) to push row-level changes to all subscribed dashboard clients via WebSockets. Alert rows trigger a Supabase Database Function that calls the Telegram Bot API with formatted anomaly details.',
    },
  ];

  const specs = [
    {
      id: 'hardware',
      color: 'text-cyan-700 bg-cyan-50 border-cyan-200',
      icon: <Cpu className="h-3.5 w-3.5" />,
      label: 'Hardware Stack',
      items: [
        { name: 'ESP32-C6 Core Unit', detail: 'Single-core 32-bit RISC-V at 160MHz. Wi-Fi 6, BLE 5, Thread mesh support. 512KB SRAM, 4MB Flash.' },
        { name: 'INA219 I2C Power Monitor', detail: 'High-side DC current and voltage sensing with 1% accuracy. Detects open/short circuit conditions.' },
        { name: 'DHT11 Environmental Sensor', detail: 'Temperature ±2°C, Humidity ±5% RH measurement for thermal management and moisture alerts.' },
        { name: 'DS3218 High-Torque Servos', detail: '20kg/cm azimuth + 15kg/cm elevation dual-axis motion system with metal gears and 0.1° resolution.' },
      ],
    },
    {
      id: 'ai',
      color: 'text-purple-700 bg-purple-50 border-purple-200',
      icon: <Brain className="h-3.5 w-3.5" />,
      label: 'Edge Intelligence',
      items: [
        { name: '1D CNN Topology', detail: '5-layer Conv1D network processing 100Hz LDR time-series input windows of 50 samples.' },
        { name: 'INT8 Quantization', detail: 'Post-training quantization via TensorFlow Lite Micro reduces model size from 2.1MB to 180KB.' },
        { name: 'Softmax Classifier', detail: '9-class output: Nominal, Dust, Shading, Hotspot, Motor Block, Wind Stow, Open Circuit, Short Circuit, Panel Failure.' },
        { name: 'Inference Latency', detail: '<1ms per inference cycle at 160MHz. Runs alongside the tracking loop with no performance penalty.' },
      ],
    },
    {
      id: 'cloud',
      color: 'text-emerald-700 bg-emerald-50 border-emerald-200',
      icon: <Database className="h-3.5 w-3.5" />,
      label: 'Cloud Platform',
      items: [
        { name: 'HiveMQ MQTT Broker', detail: 'TLS 1.3 encrypted topics with client certificate validation. Supports thousands of concurrent device connections.' },
        { name: 'Supabase PostgreSQL', detail: 'Row-Level Security policies enforce per-device data isolation. Realtime CDC for sub-100ms dashboard updates.' },
        { name: 'Telegram Alert Bot', detail: 'Database triggers invoke Bot API with fault type, device ID, and severity. Supports group chat fleet channels.' },
        { name: 'Vercel Edge API', detail: 'Serverless functions handle OTA firmware routing, command queuing, and camera snapshot proxy.' },
      ],
    },
  ];

  return (
    <div className="relative min-h-screen bg-slate-50 py-16 px-6 overflow-hidden">
      <div className="absolute top-0 right-0 h-[400px] w-[400px] bg-emerald-500/8 rounded-full blur-3xl -z-10" />
      <div className="absolute bottom-0 left-0 h-[400px] w-[400px] bg-blue-500/8 rounded-full blur-3xl -z-10" />

      <div className="max-w-6xl mx-auto space-y-20">

        {/* ── Title ── */}
        <div className="text-center space-y-3">
          <div className="inline-block text-[10px] font-mono font-black uppercase tracking-widest text-cyan-600 bg-cyan-50 border border-cyan-200 px-3 py-1 rounded-full">
            System Architecture
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-slate-900 uppercase tracking-tighter">
            System Pipeline & Architecture
          </h1>
          <p className="text-slate-500 text-sm max-w-lg mx-auto">
            From raw LDR photons to cloud dashboard — the complete end-to-end data flow of AadhavanAI.
          </p>
          <p className="text-cyan-600 font-mono text-[10px] tracking-widest uppercase">NODE_VECTOR_INGESTION_PIPELINE</p>
        </div>

        {/* ── Pipeline Flow Steps ── */}
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 relative">
            {pipelineSteps.map((step, idx) => (
              <div key={idx} className="glass-card p-6 rounded-2xl border border-slate-200 bg-white relative group hover:border-cyan-300 transition duration-300 shadow-sm">
                {/* Number badge */}
                <div className="absolute -top-3 left-5 px-2 py-0.5 bg-slate-800 text-white text-[10px] font-black font-mono rounded-full tracking-wider">
                  {step.step}
                </div>

                {/* Arrow connector on desktop */}
                {idx < 5 && idx % 3 !== 2 && (
                  <div className="hidden md:block pipeline-connector" />
                )}

                <div className="flex items-center gap-3 mb-3 mt-1">
                  <div className={`p-2 rounded-xl border ${step.color}`}>
                    {step.icon}
                  </div>
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-wide">{step.title}</h3>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">{step.desc}</p>

                {/* Expandable detail */}
                <details className="mt-3 group/details">
                  <summary className="text-[10px] text-cyan-600 font-bold cursor-pointer list-none flex items-center gap-1 hover:text-cyan-700 transition select-none">
                    <ChevronDown className="h-3 w-3 transition-transform group-open/details:rotate-180" />
                    Technical detail
                  </summary>
                  <p className="mt-2 text-[10px] text-slate-500 leading-relaxed border-t border-slate-100 pt-2">
                    {step.detail}
                  </p>
                </details>
              </div>
            ))}
          </div>

          {/* Row 2: connectors between rows */}
          <div className="hidden md:flex justify-around px-4">
            {[0, 1, 2].map(i => (
              <div key={i} className="h-6 w-px bg-gradient-to-b from-cyan-300/40 to-transparent mx-auto" />
            ))}
          </div>
        </div>

        {/* ── Live System Preview ── */}
        <div className="glass-panel p-6 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-emerald-600" />
                <h2 className="text-sm font-black text-slate-900 uppercase tracking-wide">Live System Telemetry Preview</h2>
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
              </div>
              <p className="text-[10px] text-slate-400 font-mono uppercase tracking-wider">RIT_NODE_01 · REAL_MOCK_TELEMETRY</p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-[11px]">
              {[
                { label: 'Power', value: `${liveData.p.toFixed(1)} W`, color: 'text-amber-600' },
                { label: 'Voltage', value: `${liveData.v.toFixed(1)} V`, color: 'text-cyan-600' },
                { label: 'Current', value: `${liveData.i.toFixed(2)} A`, color: 'text-blue-600' },
                { label: 'Temp', value: `${liveData.temp.toFixed(1)} °C`, color: liveData.temp > 60 ? 'text-rose-600' : 'text-slate-700' },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-center shadow-sm">
                  <p className="text-[9px] text-slate-400 uppercase tracking-wider mb-0.5">{label}</p>
                  <p className={`font-black ${color}`}>{value}</p>
                </div>
              ))}
            </div>

            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-black border uppercase tracking-wider font-mono ${
              liveData.status === 'online' ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
              : 'bg-amber-50 text-amber-600 border-amber-200'
            }`}>
              <Wifi className="h-3 w-3" />
              {liveData.fault === 0 ? 'NOMINAL' : `FAULT_${liveData.fault}`}
            </div>
          </div>
        </div>

        {/* ── Technical Specifications: Accordion ── */}
        <div className="space-y-6">
          <div className="border-b border-slate-200 pb-4">
            <h2 className="text-2xl md:text-3xl font-black text-slate-900 text-left uppercase tracking-tight">
              Granular Specifications
            </h2>
            <p className="text-xs text-slate-500 text-left font-mono mt-0.5">HARDWARE_TOPOLOGY_CORE_LOGIC — click to expand each section</p>
          </div>

          <div className="space-y-3">
            {specs.map(spec => (
              <div key={spec.id} className="glass-card rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                <button
                  onClick={() => setExpandedSpec(expandedSpec === spec.id ? null : spec.id)}
                  className="w-full flex items-center justify-between p-5 text-left group cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className={`inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border ${spec.color}`}>
                      {spec.icon} {spec.label}
                    </div>
                  </div>
                  <ChevronDown className={`h-4 w-4 text-slate-400 accordion-icon transition-transform duration-300 ${expandedSpec === spec.id ? 'rotate-180' : ''}`} />
                </button>

                {expandedSpec === spec.id && (
                  <div className="px-5 pb-5 space-y-3 border-t border-slate-100 animate-fade-in-up">
                    {spec.items.map(item => (
                      <div key={item.name} className="flex gap-3 p-3 bg-slate-50/70 rounded-xl border border-slate-100">
                        <div className="h-1.5 w-1.5 rounded-full bg-cyan-500 mt-1.5 shrink-0" />
                        <div>
                          <p className="text-xs font-black text-slate-800 font-mono uppercase tracking-wide mb-0.5">{item.name}</p>
                          <p className="text-[11px] text-slate-500 leading-relaxed">{item.detail}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
