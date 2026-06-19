// src/pages/Analytics.tsx
import { useState, useEffect } from 'react';
import { mockDb } from '../services/mockDb';
import type { Alert } from '../services/mockDb';
import { supabase, isLiveMode } from '../services/supabase';

import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { TrendingUp, ShieldAlert, FileText, CheckCircle, PieChart as PieIcon, BarChart2 } from 'lucide-react';

export default function Analytics() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [devices, setDevices] = useState<any[]>([]);

  useEffect(() => {
    if (!isLiveMode) {
      setAlerts([...mockDb.getAlerts()]);
      setDevices([...mockDb.getDevices()]);
      const unsubscribe = mockDb.subscribe(() => {
        setAlerts([...mockDb.getAlerts()]);
        setDevices([...mockDb.getDevices()]);
      });
      return () => unsubscribe();
    } else {
      const fetchData = async () => {
        const { data: alertsData } = await supabase.from('alerts').select('*').order('created_at', { ascending: false });
        const { data: devicesData } = await supabase.from('devices').select('*');
        if (alertsData) setAlerts(alertsData as any);
        if (devicesData) setDevices(devicesData as any);
      };
      
      fetchData();

      const channel = supabase.channel('analytics-alerts-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'alerts' }, () => {
          fetchData();
        })
        .subscribe();
        
      return () => { supabase.removeChannel(channel); };
    }
  }, []);

  // 1. Grouped Yield Data: Tracker vs Fixed-Axis
  const yieldData = [
    { name: 'Mon', Tracker: 42.4, Fixed: 31.2 },
    { name: 'Tue', Tracker: 48.6, Fixed: 35.1 },
    { name: 'Wed', Tracker: 45.1, Fixed: 33.4 },
    { name: 'Thu', Tracker: 52.8, Fixed: 38.0 },
    { name: 'Fri', Tracker: 49.3, Fixed: 36.5 },
    { name: 'Sat', Tracker: 55.0, Fixed: 40.2 },
    { name: 'Sun', Tracker: 58.7, Fixed: 42.1 }
  ];

  // Calculate overall increase
  const totalTracker = yieldData.reduce((sum, d) => sum + d.Tracker, 0);
  const totalFixed = yieldData.reduce((sum, d) => sum + d.Fixed, 0);
  const percentGain = ((totalTracker - totalFixed) / totalFixed) * 100;

  // 2. Anomaly Fault Distribution Pie Chart
  const anomalyData = [
    { name: 'Dust Cover', value: 35, color: '#d97706' },     // Amber 600
    { name: 'Shading', value: 15, color: '#2563eb' },        // Blue 600
    { name: 'Hotspots', value: 10, color: '#e11d48' },       // Rose 600
    { name: 'Motor Blocks', value: 12, color: '#7c3aed' },   // Purple 600
    { name: 'Sensor Fault', value: 6, color: '#475569' },    // Slate 600
    { name: 'Wind Stow', value: 4, color: '#059669' },       // Emerald 600
    { name: 'Open Circuit', value: 8, color: '#db2777' },    // Pink 600
    { name: 'Closed Circuit', value: 5, color: '#be123c' },  // Rose 700
    { name: 'Panel Failure', value: 5, color: '#dc2626' }    // Red 600
  ];

  return (
    <div className="relative min-h-screen bg-slate-50 p-8 font-sans">
      {/* Background radial glows */}
      <div className="absolute top-20 right-20 h-[320px] w-[320px] bg-cyan-500/10 rounded-full blur-3xl -z-10 animate-pulse" style={{ animationDuration: '7s' }} />
      <div className="absolute bottom-20 left-20 h-[320px] w-[320px] bg-amber-500/10 rounded-full blur-3xl -z-10 animate-pulse" style={{ animationDuration: '9s' }} />

      {/* 🔝 Title */}
      <div className="mb-8 pb-6 border-b border-slate-200 relative">
        <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase">Analytics Studio</h1>
        <p className="text-cyan-600 font-mono text-[10px] tracking-widest mt-1.5 uppercase">SYS_ANALYTICS_YIELD_AND_FAULT_METRIC_ENGINE</p>
      </div>

      {/* 📊 Aggregates Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="glass-panel p-6 rounded-2xl flex items-center justify-between hover:border-cyan-500/20 transition relative group">
          <div className="space-y-1">
            <span className="text-[9px] text-slate-500 uppercase font-black tracking-wider font-mono">Net Fleet Generation (Weekly)</span>
            <p className="text-3xl font-black text-slate-900 tracking-tighter">351.9 <span className="text-xs text-slate-500 font-normal font-sans">kWh</span></p>
          </div>
          <TrendingUp className="h-8 w-8 text-emerald-600 opacity-80" />
        </div>
        <div className="glass-panel p-6 rounded-2xl flex items-center justify-between hover:border-cyan-500/20 transition relative group">
          <div className="space-y-1">
            <span className="text-[9px] text-slate-500 uppercase font-black tracking-wider font-mono">Tracking Efficiency Lift</span>
            <p className="text-3xl font-black text-emerald-600 tracking-tighter">+{percentGain.toFixed(1)}%</p>
          </div>
          <BarChart2 className="h-8 w-8 text-cyan-600 opacity-80" />
        </div>
        <div className="glass-panel p-6 rounded-2xl flex items-center justify-between hover:border-rose-500/20 transition relative group border-l-2 border-l-rose-500">
          <div className="space-y-1">
            <span className="text-[9px] text-slate-500 uppercase font-black tracking-wider font-mono">Total Anomalies Handled</span>
            <p className="text-3xl font-black text-rose-600 tracking-tighter">{alerts.length}</p>
          </div>
          <ShieldAlert className="h-8 w-8 text-rose-600 opacity-80" />
        </div>
      </div>

      {/* 📊 Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        
        {/* Weekly Comparative Yield (Bar Chart) */}
        <div className="glass-panel p-6 rounded-3xl relative overflow-hidden hover:border-cyan-500/20 transition duration-300">
          <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-cyan-500" />
          <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-cyan-500" />
          <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-cyan-500" />
          <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-cyan-500" />

          <div className="mb-6">
            <h2 className="text-base font-black text-slate-900 flex items-center gap-2 uppercase tracking-wide">
              <BarChart2 className="text-cyan-600 h-4.5 w-4.5" /> Energy Yield Comparison
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">Yield comparisons between dual-axis tracking and fixed tilt setups (kWh).</p>
          </div>
          
          <div className="h-72 w-full font-mono text-xs">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <BarChart data={yieldData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                <XAxis dataKey="name" stroke="#64748b" style={{ fontSize: '10px' }} />
                <YAxis stroke="#64748b" style={{ fontSize: '10px' }} />
                <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderColor: '#cbd5e1', color: '#0f172a', fontSize: '11px', borderRadius: '12px' }} />
                <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                <Bar dataKey="Tracker" fill="#0891b2" radius={[4, 4, 0, 0]} name="Dynamic Tracker" />
                <Bar dataKey="Fixed" fill="#2563eb" radius={[4, 4, 0, 0]} name="Fixed-Axis Plane" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* AI Anomaly Distributions (Pie Chart) */}
        <div className="glass-panel p-6 rounded-3xl relative overflow-hidden hover:border-amber-500/20 transition duration-300 flex flex-col justify-between">
          <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-amber-500" />
          <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-amber-500" />
          <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-amber-500" />
          <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-amber-500" />

          <div className="mb-6">
            <h2 className="text-base font-black text-slate-900 flex items-center gap-2 uppercase tracking-wide">
              <PieIcon className="text-amber-600 h-4.5 w-4.5" /> AI-Classified Anomaly Ratios
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">Distributions of fault anomalies identified by our 1D CNN model.</p>
          </div>

          <div className="flex flex-col md:flex-row items-center gap-4 justify-around py-4">
            <div className="h-48 w-48 shrink-0">
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <PieChart>
                  <Pie
                    data={anomalyData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {anomalyData.map((entry, idx) => (
                      <Cell key={`cell-${idx}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Legends List Grid */}
            <div className="grid grid-cols-2 gap-x-5 gap-y-3.5 text-left w-full md:w-auto">
              {anomalyData.map((entry, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-slate-100 p-2 rounded-xl border border-slate-200 min-w-36">
                  <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                  <div>
                    <span className="text-[9px] text-slate-500 block font-black uppercase font-mono tracking-wider leading-none">{entry.name}</span>
                    <strong className="text-xs text-slate-800 mt-1 block font-mono">{entry.value}%</strong>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>

      {/* 📜 Detailed Historic Alerts Log */}
      <div className="glass-panel p-6 rounded-3xl relative overflow-hidden hover:border-cyan-500/25 transition duration-300 text-left">
        <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-cyan-500" />
        <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-cyan-500" />
        <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-cyan-500" />
        <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-cyan-500" />

        <div className="mb-6">
          <h2 className="text-base font-black text-slate-900 flex items-center gap-2 uppercase tracking-wide">
            <FileText className="text-cyan-600 h-4.5 w-4.5" /> Diagnostic Incident Log
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">Trace historic warning and critical anomalies logs triggered by AI classifiers.</p>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-2xl bg-white shadow-sm">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-100 text-slate-655 font-black uppercase text-[9px] border-b border-slate-200 tracking-widest font-mono">
              <tr>
                <th className="p-4">Alert ID</th>
                <th className="p-4">Device</th>
                <th className="p-4">Severity</th>
                <th className="p-4">Diagnostic Message</th>
                <th className="p-4">Triggered Time</th>
                <th className="p-4">State</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-medium font-sans">
              {alerts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500 font-mono uppercase tracking-wider text-[10px]">No warnings or critical alerts registered in this simulation session.</td>
                </tr>
              ) : (
                alerts.map(a => {
                  const dev = devices.find(d => d.id === a.device_id);
                  return (
                    <tr key={a.id} className="hover:bg-slate-50 transition duration-150">
                      <td className="p-4 font-mono text-slate-500">{a.id.substring(0, 10)}...</td>
                      <td className="p-4 text-slate-900 font-black uppercase tracking-wider">{dev?.name || 'Unknown Node'}</td>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-md text-[9px] font-black uppercase font-mono border ${
                          a.severity === 'critical' ? 'bg-rose-50 text-rose-700 border-rose-100' : 'bg-amber-50 text-amber-700 border-amber-100'
                        }`}>
                          {a.severity}
                        </span>
                      </td>
                      <td className="p-4 text-slate-700 leading-normal">{a.message}</td>
                      <td className="p-4 text-slate-500 font-mono">{new Date(a.created_at).toLocaleString()}</td>
                      <td className="p-4">
                        {a.is_resolved ? (
                          <span className="flex items-center gap-1.5 text-emerald-600 text-[10px] font-black font-mono uppercase">
                            <CheckCircle className="h-3.5 w-3.5" /> Resolved
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5 text-amber-600 text-[10px] font-black font-mono uppercase animate-pulse">
                            <ShieldAlert className="h-3.5 w-3.5" /> Active
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
