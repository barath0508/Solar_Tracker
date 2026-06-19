// src/pages/HowItWorks.tsx
import { Compass, Cpu, Zap, Cloud, Database, Brain } from 'lucide-react';


export default function HowItWorks() {
  const pipelineSteps = [
    {
      icon: <Compass className="h-6 w-6 text-amber-500" />,
      title: "1. Sun Position & LDRs",
      desc: "LDR photodiode sensors track light differentials to measure sun vectors."
    },
    {
      icon: <Cpu className="h-6 w-6 text-blue-500" />,
      title: "2. ESP32-C6 Microcontroller",
      desc: "RISC-V core reads sensor inputs and coordinates motor tilt actions."
    },
    {
      icon: <Zap className="h-6 w-6 text-emerald-500" />,
      title: "3. High-Torque Actuators",
      desc: "Dual-axis motors rotate panel to align with maximum light coordinates."
    },
    {
      icon: <Brain className="h-6 w-6 text-purple-500" />,
      title: "4. Edge AI 1D-CNN Model",
      desc: "INT8-quantized neural net checks electrical/temp anomalies in 1ms."
    },
    {
      icon: <Cloud className="h-6 w-6 text-cyan-500" />,
      title: "5. HiveMQ Cloud Gateway",
      desc: "Real-time MQTT telemetry packet dispatched to cloud broker securely."
    },
    {
      icon: <Database className="h-6 w-6 text-indigo-500" />,
      title: "6. Supabase Dashboard",
      desc: "CDC triggers live updates, alerting technicians immediately via Telegram."
    }
  ];

  return (
    <div className="relative min-h-screen bg-slate-55 py-16 px-6">
      <div className="absolute top-0 right-0 h-[400px] w-[400px] bg-emerald-500/10 rounded-full blur-3xl -z-10" />
      <div className="absolute bottom-0 left-0 h-[400px] w-[400px] bg-blue-500/10 rounded-full blur-3xl -z-10" />

      <div className="max-w-6xl mx-auto space-y-16">
        
        {/* Title */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl md:text-5xl font-black text-slate-900 uppercase tracking-tighter">System Pipeline & Architecture</h1>
          <p className="text-cyan-600 font-mono text-[10px] tracking-widest uppercase">NODE_VECTOR_INGESTION_PIPELINE</p>
        </div>

        {/* 🗺️ Pipeline Flow Steps Map */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
          {pipelineSteps.map((step, idx) => (
            <div key={idx} className="glass-card p-6 rounded-2xl border border-slate-200 bg-white relative group hover:border-cyan-300 transition duration-300 shadow-sm">
              {/* Connector dots for desktop */}
              {idx < 5 && (
                <div className="hidden md:block absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-px border-t border-dashed border-slate-300 group-hover:border-cyan-350 z-10" />
              )}
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-slate-50 rounded-xl border border-slate-150">
                  {step.icon}
                </div>
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">{step.title}</h3>
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed text-left">{step.desc}</p>
            </div>
          ))}
        </div>

        {/* 🛠️ Technical Specifications Grid Breakdown */}
        <div className="space-y-8 pt-8">
          <div className="border-b border-slate-200 pb-4">
            <h2 className="text-2xl md:text-3xl font-black text-slate-900 text-left uppercase tracking-tight">Granular Specifications</h2>
            <p className="text-xs text-slate-500 text-left font-mono mt-0.5">HARDWARE_TOPOLOGY_CORE_LOGIC</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
            
            {/* Specs Block: Hardware */}
            <div className="glass-card p-8 rounded-3xl space-y-4 border border-slate-200 bg-white hover:border-cyan-300 shadow-sm">
              <div className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-cyan-700 bg-cyan-50 px-3 py-1 rounded-full border border-cyan-200 shadow-sm">
                <Cpu className="h-3.5 w-3.5" /> Hardware Stack
              </div>
              <ul className="space-y-4 text-xs text-slate-600">
                <li className="leading-relaxed">
                  <strong className="text-slate-805 font-black block mb-0.5 font-mono uppercase tracking-wide text-[10.5px]">ESP32-C6 Core Unit</strong>
                  Single-core 32-bit RISC-V clocking up to 160MHz. Active radio supporting Wi-Fi 6, BLE 5, and Thread meshes.
                </li>
                <li className="leading-relaxed">
                  <strong className="text-slate-805 font-black block mb-0.5 font-mono uppercase tracking-wide text-[10.5px]">INA219 I2C Sensor</strong>
                  High-side power monitor interface tracking shunt voltage levels and dynamic module load current draws.
                </li>
                <li className="leading-relaxed">
                  <strong className="text-slate-805 font-black block mb-0.5 font-mono uppercase tracking-wide text-[10.5px]">High-Torque Servos</strong>
                  Dual-axis metal gear steering with 15kg/cm load thresholds, executing micro-adjustments relative to light vectors.
                </li>
              </ul>
            </div>

            {/* Specs Block: AI Edge Model */}
            <div className="glass-card p-8 rounded-3xl space-y-4 border border-slate-200 bg-white hover:border-purple-300 shadow-sm">
              <div className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-purple-700 bg-purple-50 px-3 py-1 rounded-full border border-purple-200 shadow-sm">
                <Brain className="h-3.5 w-3.5" /> Edge Intelligence
              </div>
              <ul className="space-y-4 text-xs text-slate-600">
                <li className="leading-relaxed">
                  <strong className="text-slate-805 font-black block mb-0.5 font-mono uppercase tracking-wide text-[10.5px]">1D CNN Topology</strong>
                  Deep learning 1D Convolutional Neural Network execution processing 100Hz LDR time-series telemetry streams.
                </li>
                <li className="leading-relaxed">
                  <strong className="text-slate-850 font-black block mb-0.5 font-mono uppercase tracking-wide text-[10.5px]">INT8 Quantization</strong>
                  Model layers compiled with Post-Training Quantization (PTQ) to fit within strict 180KB RAM hardware memory boundaries.
                </li>
                <li className="leading-relaxed">
                  <strong className="text-slate-850 font-black block mb-0.5 font-mono uppercase tracking-wide text-[10.5px]">Softmax Classifier</strong>
                  Generates classification probabilities across 6 distinct states including shading, dust cover, and motor jams.
                </li>
              </ul>
            </div>

            {/* Specs Block: Cloud & Realtime */}
            <div className="glass-card p-8 rounded-3xl space-y-4 border border-slate-200 bg-white hover:border-emerald-350 shadow-sm">
              <div className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200 shadow-sm">
                <Database className="h-3.5 w-3.5" /> Cloud Platform
              </div>
              <ul className="space-y-4 text-xs text-slate-600">
                <li className="leading-relaxed">
                  <strong className="text-slate-850 font-black block mb-0.5 font-mono uppercase tracking-wide text-[10.5px]">HiveMQ MQTT Gateway</strong>
                  Secured ingestion broker using TLS 1.3 encryption, client credential validation, and telemetry buffering.
                </li>
                <li className="leading-relaxed">
                  <strong className="text-slate-850 font-black block mb-0.5 font-mono uppercase tracking-wide text-[10.5px]">Supabase PostgreSQL</strong>
                  Database layer implementing strict Row Level Security (RLS) policies isolating owners, tech, and visitors.
                </li>
                <li className="leading-relaxed">
                  <strong className="text-slate-850 font-black block mb-0.5 font-mono uppercase tracking-wide text-[10.5px]">CDC WebSocket Feeds</strong>
                  Real-time database triggers dispatching live telemetry updates and automatic alarms via Telegram bots.
                </li>
              </ul>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
