// src/pages/Home.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { mockDb } from '../services/mockDb';
import { Sun, ShieldAlert, Cpu, Sparkles, TrendingUp, Play, ArrowRight, CheckCircle, Zap, Brain, Cloud, Activity, X } from 'lucide-react';

/* ─── Animated Counter Hook ─── */
function useCountUp(target: number, duration = 1800, trigger: boolean = true) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!trigger) return;
    let start: number | null = null;
    const step = (ts: number) => {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration, trigger]);
  return value;
}

/* ─── IntersectionObserver hook ─── */
function useInView(threshold = 0.3) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setInView(true); obs.disconnect(); }
    }, { threshold });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, inView };
}

/* ─── Stat Card (top-level component so hook is legal) ─── */
function StatCard({ icon, label, value, suffix, prefix, detail, color, delay, inView }: {
  icon: React.ReactNode; label: string; value: number; suffix: string;
  prefix: string; detail: string; color: string; delay: number; inView: boolean;
}) {
  const displayed = useCountUp(value, 1800 + delay, inView);
  return (
    <div className={`glass-panel p-6 rounded-2xl relative overflow-hidden hover:shadow-md transition group border-l-2 border border-slate-200 bg-white shadow-sm ${color}`}>
      <div className="absolute top-0 right-0 h-20 w-20 opacity-[0.04] rounded-full blur-xl bg-current" />
      {icon}
      <p className="text-3xl font-black text-slate-900 mt-3 tracking-tighter">
        {prefix}{inView ? displayed.toLocaleString('en-IN') : 0}{suffix}
      </p>
      <p className="text-[10px] text-slate-500 uppercase font-black tracking-wider mt-1">{label}</p>
      <p className="text-[11px] text-slate-500 mt-1.5 leading-normal">{detail}</p>
    </div>
  );
}

/* ─── Live Radar Panel ─── */

function LiveRadarPanel({ onClose }: { onClose: () => void }) {
  const [radarData, setRadarData] = useState({ azimuth: 12.4, elevation: 45.2, power: 0, ldr: [0, 0, 0, 0] });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const syncData = () => {
      const devices = mockDb.getDevices();
      if (devices.length > 0) {
        const tel = mockDb.getTelemetry(devices[0].id);
        const latest = tel[tel.length - 1];
        if (latest) {
          const ldr = Array.isArray(latest.ldr) ? latest.ldr : [0, 0, 0, 0];
          const leftAvg = (ldr[0] + ldr[1]) / 2;
          const rightAvg = (ldr[2] + ldr[3]) / 2;
          const az = Math.max(-180, Math.min(180, (leftAvg - rightAvg) * 0.03));
          setRadarData({
            azimuth: parseFloat(az.toFixed(1)),
            elevation: 45.2 + (Math.random() - 0.5) * 2,
            power: latest.p || 0,
            ldr,
          });
        }
      }
      setTick(t => t + 1);
    };
    syncData();
    const unsub = mockDb.subscribe(syncData);
    return () => unsub();
  }, []);

  return (
    <div className="glass-card aspect-square w-full rounded-3xl overflow-hidden flex flex-col items-center justify-center border border-cyan-300/60 p-6 relative shadow-lg animate-glow-ring">
      {/* Scanline decoration */}
      <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-cyan-400/30 to-transparent animate-scanline pointer-events-none" />

      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-3 right-3 text-[10px] font-mono tracking-widest text-slate-400 hover:text-cyan-600 bg-white border border-slate-200 rounded-lg px-2 py-0.5 cursor-pointer shadow-sm transition"
      >
        <X className="h-3 w-3" />
      </button>

      {/* Radar Circle */}
      <div className="relative h-44 w-44 mx-auto flex items-center justify-center mb-4">
        <div className="absolute inset-0 rounded-full border border-cyan-200/60" />
        <div className="absolute inset-4 rounded-full border border-cyan-200/40 border-dashed" />
        <div className="absolute inset-10 rounded-full border border-cyan-300/60" />
        <div className="absolute top-0 bottom-0 left-1/2 w-px bg-cyan-200/40" />
        <div className="absolute left-0 right-0 top-1/2 h-px bg-cyan-200/40" />

        {/* Rotating sweep beam */}
        <div
          className="absolute h-full w-full rounded-full"
          style={{
            background: 'conic-gradient(from 0deg, transparent 0deg, rgba(6,182,212,0.12) 30deg, transparent 31deg)',
            animation: 'spin-slow 6s linear infinite',
          }}
        />

        {/* Sun position node (dynamic) */}
        <div
          className="absolute h-3 w-3 rounded-full bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.6)] animate-pulse"
          style={{ top: `${30 + Math.sin(tick * 0.1) * 8}%`, left: `${65 + Math.cos(tick * 0.1) * 5}%` }}
        />
        {/* Tracker node (center) */}
        <div className="absolute h-3 w-3 rounded-full bg-cyan-500 shadow-[0_0_12px_rgba(6,182,212,0.7)]"
          style={{ top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }} />
        {/* Tracker to Sun line */}
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100">
          <line
            x1="50" y1="50"
            x2={`${65 + Math.cos(tick * 0.1) * 5}`}
            y2={`${30 + Math.sin(tick * 0.1) * 8}`}
            stroke="rgba(6,182,212,0.4)" strokeWidth="1" strokeDasharray="3,2"
          />
        </svg>
      </div>

      {/* Live metrics */}
      <div className="space-y-2 w-full font-mono text-[10px]">
        <div className="flex justify-between items-center bg-slate-50/80 px-3 py-1.5 rounded-lg border border-slate-100">
          <span className="text-slate-500 uppercase tracking-wider">Azimuth</span>
          <span className="text-cyan-600 font-black">{radarData.azimuth}°</span>
        </div>
        <div className="flex justify-between items-center bg-slate-50/80 px-3 py-1.5 rounded-lg border border-slate-100">
          <span className="text-slate-500 uppercase tracking-wider">Elevation</span>
          <span className="text-amber-600 font-black">{radarData.elevation.toFixed(1)}°</span>
        </div>
        <div className="flex justify-between items-center bg-slate-50/80 px-3 py-1.5 rounded-lg border border-slate-100">
          <span className="text-slate-500 uppercase tracking-wider">Power Out</span>
          <span className="text-emerald-600 font-black">{radarData.power.toFixed(1)} W</span>
        </div>
      </div>

      <div className="flex items-center gap-1.5 mt-3">
        <span className="h-1.5 w-1.5 rounded-full bg-cyan-500 animate-ping" />
        <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest">SIM_ACTUATION_LIVE</span>
      </div>
    </div>
  );
}

/* ─── Main Home Component ─── */
export default function Home() {
  const [formData, setFormData] = useState({ name: '', email: '', capacity: '10kW', note: '' });
  const [submitted, setSubmitted] = useState(false);
  const [showRadar, setShowRadar] = useState(false);
  const navigate = useNavigate();

  const { ref: statsRef, inView: statsInView } = useInView(0.2);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email) return;
    setSubmitted(true);
  };

  const features = [
    {
      icon: <TrendingUp className="h-5 w-5" />,
      color: 'text-amber-600 bg-amber-50 border-amber-200',
      title: 'Dual-Axis Tracking',
      desc: 'LDR differential vectoring continuously steers panels to the optimal sun angle, boosting yield by 25–30%.',
    },
    {
      icon: <Brain className="h-5 w-5" />,
      color: 'text-purple-600 bg-purple-50 border-purple-200',
      title: 'Edge AI Inference',
      desc: 'INT8-quantized 1D CNN running in <1ms on-chip — no cloud round-trip for fault classification.',
    },
    {
      icon: <ShieldAlert className="h-5 w-5" />,
      color: 'text-rose-600 bg-rose-50 border-rose-200',
      title: 'Fault Detection',
      desc: '9 fault classes: dust, shading, hotspot, open/short circuit, panel failure, and more — all auto-classified.',
    },
    {
      icon: <Cloud className="h-5 w-5" />,
      color: 'text-cyan-600 bg-cyan-50 border-cyan-200',
      title: 'Realtime Cloud Dashboard',
      desc: 'HiveMQ MQTT + Supabase CDC ensures telemetry arrives in the dashboard in under 500ms.',
    },
    {
      icon: <Zap className="h-5 w-5" />,
      color: 'text-emerald-600 bg-emerald-50 border-emerald-200',
      title: 'OTA Firmware Deploy',
      desc: 'Push firmware updates to every node in the fleet remotely from the Admin cockpit — no physical access needed.',
    },
    {
      icon: <Activity className="h-5 w-5" />,
      color: 'text-blue-600 bg-blue-50 border-blue-200',
      title: 'RBAC Security',
      desc: 'Strict role-based access — Visitors, End-Users, Technicians, and Admins each get scoped permissions.',
    },
  ];

  return (
    <div className="relative min-h-screen bg-slate-50 overflow-hidden">
      {/* Ambient glows */}
      <div className="absolute top-0 left-1/4 h-[600px] w-[600px] bg-amber-500/8 rounded-full blur-3xl -z-10" />
      <div className="absolute bottom-10 right-1/4 h-[500px] w-[500px] bg-cyan-500/8 rounded-full blur-3xl -z-10" />
      <div className="absolute top-1/3 right-0 h-[400px] w-[400px] bg-purple-500/5 rounded-full blur-3xl -z-10" />

      {/* ══════════════════════════════════
          HERO SECTION
      ══════════════════════════════════ */}
      <section className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10 items-center py-20 px-6">

        {/* Left: Text + CTA */}
        <div className="lg:col-span-7 space-y-7 text-left">
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-cyan-50 border border-cyan-200 text-cyan-700 text-xs font-bold uppercase tracking-wider font-mono shadow-sm">
            <Sparkles className="h-3.5 w-3.5" />
            SYSTEM_STATUS: OPERATIONAL &nbsp;·&nbsp; LIVE_TELEMETRY_ACTIVE
          </div>

          <div className="space-y-3">
            <h1 className="text-5xl md:text-7xl font-black text-slate-900 leading-none tracking-tighter">
              AADHAVAN<span className="text-amber-500 text-glow-solar">AI</span>
            </h1>
            <p className="text-lg md:text-2xl font-extrabold uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-cyan-600 via-teal-600 to-amber-600 animate-gradient-text">
              Autonomous AI Solar Tracker
            </p>
          </div>

          <p className="text-base text-slate-600 max-w-xl leading-relaxed">
            Maximize photovoltaic generation by up to <strong className="text-slate-800">30%</strong> through dual-axis hardware tracking
            driven by localized LDR differential vectoring and INT8-quantized edge neural inference.
            Engineered for India's smart-grid micro-generation ecosystem.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-wrap gap-4 pt-2">
            <a
              href="#demo-form"
              className="flex items-center gap-2 px-6 py-3.5 bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white font-extrabold text-xs uppercase tracking-widest rounded-xl transition duration-300 shadow-lg shadow-cyan-600/15 group"
            >
              Request Demo <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition" />
            </a>
            <button
              onClick={() => setShowRadar(true)}
              className="flex items-center gap-2 px-6 py-3.5 bg-white hover:bg-slate-50 border border-slate-200 hover:border-cyan-300 text-slate-700 text-xs font-bold uppercase tracking-wider rounded-xl transition shadow-sm cursor-pointer"
            >
              <Play className="h-3.5 w-3.5 text-cyan-600 fill-cyan-600" /> Launch Simulation Radar
            </button>
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-2 px-6 py-3.5 bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 text-slate-700 hover:text-emerald-700 text-xs font-bold uppercase tracking-wider rounded-xl transition shadow-sm cursor-pointer"
            >
              <Activity className="h-3.5 w-3.5 text-emerald-600" /> Live Dashboard
            </button>
          </div>

          {/* Deployment Badges */}
          <div className="flex flex-wrap gap-2 pt-1">
            {['Rajalakshmi Institute of Technology', 'Chennai Grid Node', 'Pune Tech Farm'].map(loc => (
              <span key={loc} className="inline-flex items-center gap-1 text-[10px] text-slate-500 bg-white border border-slate-200 px-2.5 py-1 rounded-full font-mono">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                {loc}
              </span>
            ))}
          </div>
        </div>

        {/* Right: Simulation Radar / Idle Card */}
        <div className="lg:col-span-5 relative">
          <div className="absolute inset-0 bg-gradient-to-tr from-amber-500/8 to-cyan-500/8 rounded-3xl blur-2xl -z-10" />

          {showRadar ? (
            <LiveRadarPanel onClose={() => setShowRadar(false)} />
          ) : (
            <div
              onClick={() => setShowRadar(true)}
              className="glass-card aspect-square w-full rounded-3xl overflow-hidden flex flex-col items-center justify-center border border-slate-200 hover:border-cyan-300 cursor-pointer relative group transition duration-300 shadow-lg"
            >
              <div className="absolute top-0 left-0 bg-slate-100/80 text-[9px] font-mono uppercase font-black tracking-widest text-amber-600 px-3 py-1.5 rounded-br-2xl border-r border-b border-slate-200">
                INIT_SYS_RADAR_WALKTHROUGH
              </div>

              {/* Idle radar rings */}
              <div className="absolute inset-12 rounded-full border border-slate-200/70 opacity-60 group-hover:opacity-90 group-hover:border-cyan-200 transition duration-500">
                <div className="absolute inset-8 rounded-full border border-slate-200/60 border-dashed" />
                <div className="absolute inset-16 rounded-full border border-slate-300/60" />
                <div className="absolute top-0 bottom-0 left-1/2 w-px bg-slate-200" />
                <div className="absolute left-0 right-0 top-1/2 h-px bg-slate-200" />
              </div>

              {/* Slow idle sweep */}
              <div
                className="absolute inset-12 rounded-full"
                style={{
                  background: 'conic-gradient(from 0deg, transparent 0deg, rgba(6,182,212,0.06) 20deg, transparent 21deg)',
                  animation: 'spin-slow 12s linear infinite',
                }}
              />

              <div className="p-5 bg-white rounded-2xl border border-slate-200 group-hover:scale-110 group-hover:border-cyan-300 text-cyan-600 transition duration-300 shadow-md z-10">
                <Play className="h-7 w-7 fill-cyan-600" />
              </div>
              <span className="text-xs font-black uppercase tracking-wider text-slate-500 mt-6 group-hover:text-cyan-600 transition z-10">
                Activate Live Simulation HUD
              </span>
              <span className="text-[10px] text-slate-400 mt-1 font-mono z-10">Powered by real mockDb telemetry</span>
            </div>
          )}
        </div>
      </section>

      {/* ══════════════════════════════════
          ANIMATED METRICS BANNER
      ══════════════════════════════════ */}
      <div ref={statsRef} className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-5 px-6 mb-20">
        <StatCard icon={<TrendingUp className="h-5 w-5 text-amber-500" />} label="Energy Yield Gain" value={30}    suffix="%" prefix="Up to " detail="Dual-axis vs fixed-tilt panels"          color="border-l-amber-500"  delay={0}   inView={statsInView} />
        <StatCard icon={<ShieldAlert className="h-5 w-5 text-rose-500" />} label="AI Fault Classes"  value={9}     suffix=""  prefix=""        detail="Dust, shading, hotspot, circuit faults" color="border-l-rose-500"   delay={150} inView={statsInView} />
        <StatCard icon={<Cpu className="h-5 w-5 text-blue-500" />}          label="Edge Inference"    value={1}     suffix="ms" prefix="<"      detail="INT8 CNN on-chip, no cloud round-trip"  color="border-l-blue-500"   delay={300} inView={statsInView} />
        <StatCard icon={<Sun className="h-5 w-5 text-emerald-500" />}       label="Target Cost / kW" value={15000} suffix=""  prefix="₹"       detail="Locally sourced, fast deployment"       color="border-l-emerald-500" delay={450} inView={statsInView} />
      </div>

      {/* ══════════════════════════════════
          FEATURE HIGHLIGHTS GRID
      ══════════════════════════════════ */}
      <section className="max-w-7xl mx-auto px-6 mb-24">
        <div className="text-center mb-10 space-y-2">
          <div className="inline-block text-[10px] font-mono font-black uppercase tracking-widest text-cyan-600 bg-cyan-50 border border-cyan-200 px-3 py-1 rounded-full">
            Why AadhavanAI
          </div>
          <h2 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tighter">
            Built for India's Energy Future
          </h2>
          <p className="text-slate-500 text-sm max-w-xl mx-auto">
            Every feature engineered for reliability, efficiency, and scale — from a single rooftop to a 5MW utility farm.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map(({ icon, color, title, desc }) => (
            <div key={title} className="glass-card p-6 rounded-2xl group hover:shadow-lg transition duration-300">
              <div className={`inline-flex items-center justify-center p-2.5 rounded-xl border mb-4 ${color} transition duration-300`}>
                {icon}
              </div>
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide mb-2">{title}</h3>
              <p className="text-xs text-slate-500 leading-relaxed">{desc}</p>
              <div className="mt-4 h-0.5 w-0 group-hover:w-full bg-gradient-to-r from-cyan-500/40 to-transparent rounded-full transition-all duration-500" />
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════
          DEPLOYMENT INQUIRY FORM
      ══════════════════════════════════ */}
      <section id="demo-form" className="max-w-3xl mx-auto px-6 pb-24">
        <div className="glass-card border border-slate-200 p-8 md:p-12 rounded-3xl relative overflow-hidden shadow-lg">
          <div className="absolute top-0 right-0 h-48 w-48 bg-amber-500/5 rounded-full blur-3xl -z-10" />
          <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-amber-500/50" />
          <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-amber-500/50" />
          <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-amber-500/50" />
          <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-amber-500/50" />

          {submitted ? (
            <div className="text-center py-8 space-y-5 animate-fade-in-up">
              <div className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl inline-block border border-emerald-200">
                <CheckCircle className="h-10 w-10" />
              </div>
              <h3 className="text-2xl font-black text-slate-900">Inquiry Received!</h3>
              <p className="text-slate-500 text-sm max-w-sm mx-auto leading-relaxed">
                Thank you for reaching out! An IoT specialist will contact{' '}
                <strong className="text-slate-800">{formData.email}</strong> within 24 hours with a custom generation simulation report.
              </p>
              <div className="flex justify-center gap-3 pt-2">
                <button
                  onClick={() => { setSubmitted(false); setFormData({ name: '', email: '', capacity: '10kW', note: '' }); }}
                  className="px-5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-xs text-slate-700 font-bold rounded-xl transition shadow-sm cursor-pointer"
                >
                  Submit Another
                </button>
                <button
                  onClick={() => navigate('/dashboard')}
                  className="px-5 py-2 bg-gradient-to-r from-cyan-600 to-emerald-600 text-white text-xs font-bold rounded-xl transition shadow-sm cursor-pointer hover:opacity-90"
                >
                  View Live Dashboard →
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <h2 className="text-3xl font-black text-slate-900">Request Deployment Inquiry</h2>
                <p className="text-slate-500 text-sm">
                  Partner with AadhavanAI. Fill out the form to receive a custom generation simulation report.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-5 text-left">
                <div>
                  <label htmlFor="name-input" className="block text-xs uppercase font-extrabold text-slate-500 mb-1.5 tracking-wider">Full Name</label>
                  <input
                    type="text" id="name-input"
                    value={formData.name}
                    onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                    placeholder="e.g. Ramesh Kumar"
                    required
                    className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none glass-input"
                  />
                </div>

                <div>
                  <label htmlFor="email-input" className="block text-xs uppercase font-extrabold text-slate-500 mb-1.5 tracking-wider">Business Email</label>
                  <input
                    type="email" id="email-input"
                    value={formData.email}
                    onChange={e => setFormData(p => ({ ...p, email: e.target.value }))}
                    placeholder="e.g. ramesh@farm-energy.in"
                    required
                    className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none glass-input"
                  />
                </div>

                <div className="md:col-span-2">
                  <label htmlFor="capacity-input" className="block text-xs uppercase font-extrabold text-slate-500 mb-1.5 tracking-wider">Target Deployment Scale</label>
                  <select
                    id="capacity-input"
                    value={formData.capacity}
                    onChange={e => setFormData(p => ({ ...p, capacity: e.target.value }))}
                    className="w-full rounded-xl px-4 py-3 text-sm cursor-pointer focus:outline-none glass-input"
                  >
                    <option value="10kW">Micro-Grid (10kW – 50kW)</option>
                    <option value="100kW">Medium Farm (50kW – 500kW)</option>
                    <option value="1MW">Utility Scale (500kW – 5MW)</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label htmlFor="note-input" className="block text-xs uppercase font-extrabold text-slate-500 mb-1.5 tracking-wider">Additional Requirements</label>
                  <textarea
                    id="note-input" rows={3}
                    value={formData.note}
                    onChange={e => setFormData(p => ({ ...p, note: e.target.value }))}
                    placeholder="Describe your location, grid constraints, or project goals..."
                    className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none resize-none glass-input"
                  />
                </div>

                <button
                  type="submit"
                  className="md:col-span-2 w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-sm rounded-xl transition duration-300 shadow-md shadow-emerald-600/10 cursor-pointer"
                >
                  Submit Inquiry →
                </button>
              </form>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
