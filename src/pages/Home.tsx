// src/pages/Home.tsx
import React, { useState } from 'react';
import { Sun, ShieldAlert, Cpu, Sparkles, TrendingUp, Play, ArrowRight, CheckCircle } from 'lucide-react';

export default function Home() {
  const [formData, setFormData] = useState({ name: '', email: '', capacity: '10kW', note: '' });
  const [submitted, setSubmitted] = useState(false);
  const [showVideo, setShowVideo] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email) return;
    setSubmitted(true);
  };

  return (
    <div className="relative min-h-screen bg-slate-950 overflow-hidden py-16 px-6">
      {/* Decorative background radial glows */}
      <div className="absolute top-0 left-1/4 h-[500px] w-[500px] bg-amber-500/5 rounded-full blur-3xl" />
      <div className="absolute bottom-10 right-1/4 h-[500px] w-[500px] bg-cyan-500/5 rounded-full blur-3xl" />

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        
        {/* Left Column: Text & CTA */}
        <div className="lg:col-span-7 space-y-6 text-left">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-bold uppercase tracking-wider font-mono">
            <Sparkles className="h-3.5 w-3.5" /> SYSTEM_STATUS: OPERATIONAL
          </div>

          <div className="space-y-2">
            <h1 className="text-5xl md:text-7xl font-black text-white leading-none tracking-tighter">
              SURYA<span className="text-amber-400 text-glow-gold">MITRA</span>
            </h1>
            <p className="text-lg md:text-2xl font-extrabold uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-teal-300 to-amber-400 text-glow-cyan">
              Autonomous AI Solar HUD
            </p>
          </div>

          <p className="text-base text-slate-400 max-w-xl leading-relaxed">
            Maximize photovoltaic generation by up to 30% through dual-axis hardware tracking driven by localized LDR differential vectoring and INT8-quantized edge neural inference. Optimized for smart-grid micro-generation.
          </p>

          {/* Action triggers */}
          <div className="flex flex-wrap gap-4 pt-2">
            <a 
              href="#demo-form"
              className="flex items-center gap-2 px-6 py-3.5 bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-slate-950 font-extrabold text-xs uppercase tracking-widest rounded-xl transition duration-300 shadow-lg shadow-cyan-500/15 group"
            >
              Request HUD Demo <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition" />
            </a>
            <button 
              onClick={() => setShowVideo(true)}
              className="flex items-center gap-2 px-6 py-3.5 bg-slate-900/60 hover:bg-slate-800 border border-slate-850 hover:border-slate-750 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition"
            >
              <Play className="h-3.5 w-3.5 text-cyan-400 text-glow-cyan" /> Launch Simulation Radar
            </button>
          </div>
        </div>

        {/* Right Column: Embedded Dynamic Video/Dashboard Mockup */}
        <div className="lg:col-span-5 relative">
          <div className="absolute inset-0 bg-gradient-to-tr from-amber-500/10 to-cyan-500/10 rounded-3xl blur-2xl -z-10" />
          
          {showVideo ? (
            <div className="glass-card aspect-square w-full rounded-3xl overflow-hidden flex flex-col items-center justify-center border-2 border-cyan-500/35 neon-border-cyan p-8 relative">
              {/* Scanline decoration */}
              <div className="absolute inset-x-0 top-0 h-0.5 bg-cyan-500/20 shadow-[0_0_10px_rgba(6,182,212,0.5)] animate-scanline pointer-events-none" />
              <button 
                onClick={() => setShowVideo(false)}
                className="absolute top-4 right-4 text-[10px] font-mono tracking-widest text-slate-500 hover:text-cyan-400 border border-slate-800 rounded px-2 py-0.5"
              >
                DISCONNECT_SIM
              </button>
              
              {/* Cockpit radar graphics */}
              <div className="text-center space-y-5 w-full relative">
                {/* SVG radar overlay */}
                <div className="relative h-48 w-48 mx-auto flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full border border-cyan-500/15" />
                  <div className="absolute inset-4 rounded-full border border-cyan-500/20 border-dashed" />
                  <div className="absolute inset-12 rounded-full border border-cyan-500/30" />
                  <div className="absolute top-0 bottom-0 left-1/2 w-px bg-cyan-500/15" />
                  <div className="absolute left-0 right-0 top-1/2 h-px bg-cyan-500/15" />
                  
                  {/* Rotating beam */}
                  <div className="absolute h-full w-full rounded-full border-r-2 border-cyan-400/40 animate-spin" style={{ animationDuration: '6s' }} />
                  
                  {/* Glowing sun node */}
                  <div className="absolute h-3 w-3 rounded-full bg-amber-400 shadow-[0_0_15px_#fbbf24] animate-pulse" style={{ top: '25%', left: '70%' }} />
                  {/* Glowing tracker node */}
                  <div className="absolute h-2.5 w-2.5 rounded-full bg-cyan-400 shadow-[0_0_15px_#06b6d4] animate-ping" style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }} />
                </div>

                <div className="space-y-1">
                  <h3 className="text-sm uppercase font-mono font-black tracking-widest text-white flex items-center justify-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-ping" />
                    SIM_ACTUATION_ONLINE
                  </h3>
                  <p className="text-[10px] text-slate-500 font-mono">
                    Azimuth: 12.4°E | Elevation: 45.2° | Deviation: 0.04°
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div 
              onClick={() => setShowVideo(true)}
              className="glass-card aspect-square w-full rounded-3xl overflow-hidden flex flex-col items-center justify-center border border-slate-800 hover:border-cyan-500/35 cursor-pointer relative group transition duration-300"
            >
              {/* Radar vector mock background */}
              <div className="absolute inset-12 rounded-full border border-slate-850 opacity-40 group-hover:opacity-70 group-hover:border-cyan-500/25 transition duration-500 flex items-center justify-center">
                <div className="absolute inset-8 rounded-full border border-slate-850 border-dashed" />
                <div className="absolute inset-16 rounded-full border border-slate-800" />
                <div className="absolute top-0 bottom-0 left-1/2 w-px bg-slate-850" />
                <div className="absolute left-0 right-0 top-1/2 h-px bg-slate-850" />
              </div>
              <div className="absolute top-0 left-0 bg-slate-950/90 text-[9px] font-mono uppercase font-black tracking-widest text-amber-400 px-3 py-1.5 rounded-br-2xl border-r border-b border-slate-800">
                INIT_SYS_RADAR_WALKTHROUGH
              </div>
              <div className="p-5 bg-slate-950/90 rounded-2xl border border-slate-800 group-hover:scale-110 group-hover:border-cyan-400/40 text-cyan-400 transition duration-300 shadow-2xl z-10">
                <Play className="h-7 w-7 fill-cyan-400 text-glow-cyan" />
              </div>
              <span className="text-xs font-black uppercase tracking-wider text-slate-400 mt-6 group-hover:text-cyan-400 transition z-10">Activate Interactive HUD Demo</span>
            </div>
          )}
        </div>

      </div>

      {/* 📊 Core Metrics Banner Matrix */}
      <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 mt-20">
        
        <div className="glass-panel p-6 rounded-2xl relative overflow-hidden transition hover:border-slate-700">
          <div className="absolute top-0 right-0 h-16 w-16 bg-amber-500/5 rounded-full blur-xl" />
          <TrendingUp className="h-5 w-5 text-amber-400 mb-3" />
          <p className="text-3xl font-extrabold text-white">25–30%</p>
          <p className="text-xs text-slate-500 uppercase font-black tracking-wider mt-1.5">Energy Yield Gain</p>
          <p className="text-xs text-slate-400 mt-1 leading-normal">Optimized dual-axis tracking vs. standard fixed panels.</p>
        </div>

        <div className="glass-panel p-6 rounded-2xl relative overflow-hidden transition hover:border-slate-700">
          <div className="absolute top-0 right-0 h-16 w-16 bg-rose-500/5 rounded-full blur-xl" />
          <ShieldAlert className="h-5 w-5 text-rose-400 mb-3" />
          <p className="text-3xl font-extrabold text-white">6 Classes</p>
          <p className="text-xs text-slate-500 uppercase font-black tracking-wider mt-1.5">AI Fault Detection</p>
          <p className="text-xs text-slate-400 mt-1 leading-normal">Dust, shading, hotspot degradation, motor block detection.</p>
        </div>

        <div className="glass-panel p-6 rounded-2xl relative overflow-hidden transition hover:border-slate-700">
          <div className="absolute top-0 right-0 h-16 w-16 bg-blue-500/5 rounded-full blur-xl" />
          <Cpu className="h-5 w-5 text-blue-400 mb-3" />
          <p className="text-3xl font-extrabold text-white">1 ms</p>
          <p className="text-xs text-slate-500 uppercase font-black tracking-wider mt-1.5">Edge Inference</p>
          <p className="text-xs text-slate-400 mt-1 leading-normal">INT8-quantized CNN execution directly on the ESP32 chip.</p>
        </div>

        <div className="glass-panel p-6 rounded-2xl relative overflow-hidden transition hover:border-slate-700">
          <div className="absolute top-0 right-0 h-16 w-16 bg-emerald-500/5 rounded-full blur-xl" />
          <Sun className="h-5 w-5 text-emerald-400 mb-3" />
          <p className="text-3xl font-extrabold text-white">₹15,000</p>
          <p className="text-xs text-slate-500 uppercase font-black tracking-wider mt-1.5">Target Cost / kW</p>
          <p className="text-xs text-slate-400 mt-1 leading-normal">Locally sourced materials designed for quick deployment.</p>
        </div>

      </div>

      {/* 📋 Lead Generation Form Block */}
      <div id="demo-form" className="max-w-3xl mx-auto mt-28">
        <div className="glass-card border border-slate-800 p-8 md:p-12 rounded-3xl relative overflow-hidden">
          <div className="absolute top-0 right-0 h-48 w-48 bg-amber-500/5 rounded-full blur-3xl -z-10" />

          {submitted ? (
            <div className="text-center py-8 space-y-4">
              <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-full inline-block">
                <CheckCircle className="h-10 w-10 text-glow-emerald" />
              </div>
              <h3 className="text-2xl font-black text-white">Deployment Inquiry Received!</h3>
              <p className="text-slate-400 text-sm max-w-sm mx-auto">
                Thank you for requesting a demo of SuryaMitra. An IoT specialist will contact you at <strong className="text-white">{formData.email}</strong> within 24 hours.
              </p>
              <button 
                onClick={() => { setSubmitted(false); setFormData({ name: '', email: '', capacity: '10kW', note: '' }); }}
                className="mt-4 px-5 py-2 bg-slate-900 border border-slate-850 hover:bg-slate-850 text-xs text-slate-300 font-bold rounded-lg transition"
              >
                Submit another request
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <h2 className="text-3xl font-black text-white">Request Deployment Inquiries</h2>
                <p className="text-slate-400 text-sm">
                  Partner with SuryaMitra. Fill out the form below to receive a custom generation simulation report.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-5 text-left">
                <div>
                  <label htmlFor="name-input" className="block text-xs uppercase font-extrabold text-slate-400 mb-1.5">Full Name</label>
                  <input 
                    type="text" 
                    id="name-input"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g. Ramesh Kumar"
                    required
                    className="w-full rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none glass-input"
                  />
                </div>

                <div>
                  <label htmlFor="email-input" className="block text-xs uppercase font-extrabold text-slate-400 mb-1.5">Business Email</label>
                  <input 
                    type="email" 
                    id="email-input"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="e.g. ramesh@farm-energy.in"
                    required
                    className="w-full rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none glass-input"
                  />
                </div>

                <div className="md:col-span-2">
                  <label htmlFor="capacity-input" className="block text-xs uppercase font-extrabold text-slate-400 mb-1.5">Target Deployment Scale</label>
                  <select 
                    id="capacity-input"
                    value={formData.capacity}
                    onChange={(e) => setFormData(prev => ({ ...prev, capacity: e.target.value }))}
                    className="w-full rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none cursor-pointer glass-input"
                  >
                    <option value="10kW">Micro-Grid (10kW - 50kW)</option>
                    <option value="100kW">Medium Farm (50kW - 500kW)</option>
                    <option value="1MW">Utility Scale Farm (500kW - 5MW)</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label htmlFor="note-input" className="block text-xs uppercase font-extrabold text-slate-400 mb-1.5">Additional Requirements</label>
                  <textarea 
                    id="note-input"
                    rows={3}
                    value={formData.note}
                    onChange={(e) => setFormData(prev => ({ ...prev, note: e.target.value }))}
                    placeholder="Describe your location, grid constraints, or project goals..."
                    className="w-full rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none resize-none glass-input"
                  />
                </div>

                <button 
                  type="submit"
                  className="md:col-span-2 w-full py-3.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-extrabold text-sm rounded-xl transition duration-300 shadow-lg shadow-emerald-500/10"
                >
                  Submit Inquiry
                </button>
              </form>
            </div>
          )}

        </div>
      </div>

    </div>
  );
}
