// src/pages/Analytics.tsx
import { useState, useEffect, useCallback } from 'react';
import { mockDb } from '../services/mockDb';
import type { Alert } from '../services/mockDb';
import { supabase, isLiveMode } from '../services/supabase';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, Sector
} from 'recharts';
import {
  TrendingUp, ShieldAlert, FileText, CheckCircle, PieChart as PieIcon, BarChart2,
  Download, Search, X, Filter
} from 'lucide-react';

/* ─── Custom Recharts Tooltip ─── */
const CustomBarTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="recharts-custom-tooltip">
        <p className="font-black text-slate-800 mb-2 uppercase tracking-wide text-[10px]">{label}</p>
        {payload.map((p: any) => (
          <div key={p.name} className="flex items-center gap-2 text-[10px]">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.fill }} />
            <span className="text-slate-500">{p.name}:</span>
            <span className="font-black" style={{ color: p.fill }}>{p.value.toFixed(1)} kWh</span>
          </div>
        ))}
        <div className="mt-1.5 pt-1.5 border-t border-slate-100 text-[9px] text-emerald-600 font-black">
          Gain: +{payload[0] && payload[1] ? ((payload[0].value - payload[1].value) / payload[1].value * 100).toFixed(1) : 0}%
        </div>
      </div>
    );
  }
  return null;
};

/* ─── Active Pie Sector ─── */
const renderActiveShape = (props: any) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload, percent } = props;
  return (
    <g>
      <text x={cx} y={cy - 12} textAnchor="middle" fill="#1e293b" className="font-black" style={{ fontSize: '12px', fontWeight: 900 }}>
        {payload.name}
      </text>
      <text x={cx} y={cy + 10} textAnchor="middle" fill={fill} style={{ fontSize: '18px', fontWeight: 900 }}>
        {payload.value}%
      </text>
      <text x={cx} y={cy + 28} textAnchor="middle" fill="#64748b" style={{ fontSize: '10px' }}>
        {(percent * 100).toFixed(1)}% of total
      </text>
      <Sector cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={outerRadius + 8}
        startAngle={startAngle} endAngle={endAngle} fill={fill} />
      <Sector cx={cx} cy={cy} innerRadius={outerRadius + 10} outerRadius={outerRadius + 14}
        startAngle={startAngle} endAngle={endAngle} fill={fill} />
    </g>
  );
};

export default function Analytics() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [devices, setDevices] = useState<any[]>([]);
  const [filterDevice, setFilterDevice] = useState<string>('all');
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activePieIdx, setActivePieIdx] = useState(0);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [exportSuccess, setExportSuccess] = useState(false);

  useEffect(() => {
    if (!isLiveMode) {
      const sync = () => {
        setAlerts([...mockDb.getAlerts()]);
        setDevices([...mockDb.getDevices()]);
      };
      sync();
      return mockDb.subscribe(sync);
    } else {
      const fetchData = async () => {
        const { data: alertsData } = await supabase.from('alerts').select('*').order('created_at', { ascending: false });
        const { data: devicesData } = await supabase.from('devices').select('*');
        if (alertsData) setAlerts(alertsData as any);
        if (devicesData) setDevices(devicesData as any);
      };
      fetchData();
      const channel = supabase.channel('analytics-alerts-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'alerts' }, fetchData)
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    }
  }, []);

  // Filtered alerts
  const filteredAlerts = alerts.filter(a => {
    const devMatch = filterDevice === 'all' || a.device_id === filterDevice;
    const sevMatch = filterSeverity === 'all' || a.severity === filterSeverity;
    const searchMatch = !searchQuery || a.message.toLowerCase().includes(searchQuery.toLowerCase());
    return devMatch && sevMatch && searchMatch;
  });

  const activeCount = alerts.filter(a => !a.is_resolved).length;

  // Resolve a single alert
  const handleResolve = (id: string) => {
    setResolvingId(id);
    setTimeout(() => {
      mockDb.resolveAlert(id);
      setResolvingId(null);
    }, 400);
  };

  // CSV Export
  const exportCSV = useCallback(() => {
    const rows = [
      ['Alert ID', 'Device', 'Severity', 'Message', 'Triggered At', 'Status'],
      ...filteredAlerts.map(a => {
        const dev = devices.find(d => d.id === a.device_id);
        return [
          a.id,
          dev?.name || 'Unknown',
          a.severity,
          `"${a.message.replace(/"/g, '""')}"`,
          new Date(a.created_at).toLocaleString(),
          a.is_resolved ? 'Resolved' : 'Active',
        ];
      }),
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `aadhavan_alerts_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setExportSuccess(true);
    setTimeout(() => setExportSuccess(false), 3000);
  }, [filteredAlerts, devices]);

  // Weekly yield data
  const yieldData = [
    { name: 'Mon', Tracker: 42.4, Fixed: 31.2 },
    { name: 'Tue', Tracker: 48.6, Fixed: 35.1 },
    { name: 'Wed', Tracker: 45.1, Fixed: 33.4 },
    { name: 'Thu', Tracker: 52.8, Fixed: 38.0 },
    { name: 'Fri', Tracker: 49.3, Fixed: 36.5 },
    { name: 'Sat', Tracker: 55.0, Fixed: 40.2 },
    { name: 'Sun', Tracker: 58.7, Fixed: 42.1 },
  ];
  const totalTracker = yieldData.reduce((s, d) => s + d.Tracker, 0);
  const totalFixed   = yieldData.reduce((s, d) => s + d.Fixed, 0);
  const percentGain  = ((totalTracker - totalFixed) / totalFixed) * 100;

  const anomalyData = [
    { name: 'Dust Cover',      value: 35, color: '#d97706' },
    { name: 'Shading',         value: 15, color: '#2563eb' },
    { name: 'Hotspots',        value: 10, color: '#e11d48' },
    { name: 'Motor Blocks',    value: 12, color: '#7c3aed' },
    { name: 'Sensor Fault',    value: 6,  color: '#475569' },
    { name: 'Wind Stow',       value: 4,  color: '#059669' },
    { name: 'Open Circuit',    value: 8,  color: '#db2777' },
    { name: 'Closed Circuit',  value: 5,  color: '#be123c' },
    { name: 'Panel Failure',   value: 5,  color: '#dc2626' },
  ];

  return (
    <div className="relative min-h-screen bg-slate-50 p-6 md:p-8 font-sans">
      <div className="absolute top-20 right-20 h-[320px] w-[320px] bg-cyan-500/8 rounded-full blur-3xl -z-10 animate-pulse" style={{ animationDuration: '7s' }} />
      <div className="absolute bottom-20 left-20 h-[320px] w-[320px] bg-amber-500/8 rounded-full blur-3xl -z-10 animate-pulse" style={{ animationDuration: '9s' }} />

      {/* Export success toast */}
      {exportSuccess && (
        <div className="fixed bottom-6 right-6 z-50 glass-toast px-4 py-3 rounded-2xl flex items-center gap-3 text-emerald-700 border border-emerald-200 animate-slide-in-bottom shadow-xl">
          <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
          <span className="text-xs font-bold">CSV exported successfully!</span>
        </div>
      )}

      {/* ── Title ── */}
      <div className="mb-8 pb-6 border-b border-slate-200 relative flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase">Analytics Studio</h1>
          <p className="text-cyan-600 font-mono text-[10px] tracking-widest mt-1 uppercase">SYS_ANALYTICS_YIELD_AND_FAULT_METRIC_ENGINE</p>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-mono text-slate-500 bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-sm">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
          Last 7 days · Updated live
        </div>
      </div>

      {/* ── Aggregates Banner ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
        <div className="glass-panel p-6 rounded-2xl flex items-center justify-between hover:border-cyan-300 transition group border border-slate-200 shadow-sm">
          <div className="space-y-1">
            <span className="text-[9px] text-slate-500 uppercase font-black tracking-wider font-mono">Net Fleet Generation (Weekly)</span>
            <p className="text-3xl font-black text-slate-900 tracking-tighter">351.9 <span className="text-xs text-slate-400 font-normal">kWh</span></p>
          </div>
          <TrendingUp className="h-8 w-8 text-emerald-500 opacity-70" />
        </div>
        <div className="glass-panel p-6 rounded-2xl flex items-center justify-between hover:border-emerald-300 transition group border border-slate-200 shadow-sm">
          <div className="space-y-1">
            <span className="text-[9px] text-slate-500 uppercase font-black tracking-wider font-mono">Tracking Efficiency Lift</span>
            <p className="text-3xl font-black text-emerald-600 tracking-tighter">+{percentGain.toFixed(1)}%</p>
          </div>
          <BarChart2 className="h-8 w-8 text-cyan-500 opacity-70" />
        </div>
        <div className="glass-panel p-6 rounded-2xl flex items-center justify-between border-l-2 border-l-rose-500 hover:border-rose-300 transition group border border-slate-200 shadow-sm">
          <div className="space-y-1">
            <span className="text-[9px] text-slate-500 uppercase font-black tracking-wider font-mono">Total Anomalies Logged</span>
            <div className="flex items-baseline gap-2">
              <p className="text-3xl font-black text-rose-600 tracking-tighter">{alerts.length}</p>
              {activeCount > 0 && (
                <span className="text-xs text-amber-600 font-bold font-mono">{activeCount} active</span>
              )}
            </div>
          </div>
          <ShieldAlert className="h-8 w-8 text-rose-500 opacity-70" />
        </div>
      </div>

      {/* ── Charts Section ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">

        {/* Weekly Yield Bar Chart */}
        <div className="glass-panel p-6 rounded-3xl border border-slate-200 relative overflow-hidden hover:border-cyan-300 transition duration-300 shadow-sm">
          <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-cyan-500" />
          <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-cyan-500" />
          <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-cyan-500" />
          <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-cyan-500" />
          <div className="mb-5">
            <h2 className="text-sm font-black text-slate-900 flex items-center gap-2 uppercase tracking-wide">
              <BarChart2 className="text-cyan-600 h-4 w-4" /> Energy Yield Comparison
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">Dual-axis tracking vs. fixed tilt (kWh/day)</p>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <BarChart data={yieldData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" vertical={false} />
                <XAxis dataKey="name" stroke="#94a3b8" style={{ fontSize: '10px' }} axisLine={false} tickLine={false} />
                <YAxis stroke="#94a3b8" style={{ fontSize: '10px' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomBarTooltip />} cursor={{ fill: 'rgba(6,182,212,0.04)' }} />
                <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '12px' }} />
                <Bar dataKey="Tracker" fill="#0891b2" radius={[5, 5, 0, 0]} name="Dynamic Tracker" />
                <Bar dataKey="Fixed"   fill="#93c5fd" radius={[5, 5, 0, 0]} name="Fixed-Axis Plane" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Interactive Pie Chart */}
        <div className="glass-panel p-6 rounded-3xl border border-slate-200 relative overflow-hidden hover:border-amber-300 transition duration-300 shadow-sm flex flex-col">
          <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-amber-500" />
          <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-amber-500" />
          <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-amber-500" />
          <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-amber-500" />
          <div className="mb-4">
            <h2 className="text-sm font-black text-slate-900 flex items-center gap-2 uppercase tracking-wide">
              <PieIcon className="text-amber-600 h-4 w-4" /> AI-Classified Anomaly Ratios
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">Click a segment to inspect — hover for details</p>
          </div>
          <div className="flex flex-col md:flex-row items-center gap-4 justify-around flex-1">
            <div className="h-52 w-52 shrink-0">
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <PieChart>
                  <Pie
                    activeIndex={activePieIdx}
                    activeShape={renderActiveShape}
                    data={anomalyData}
                    cx="50%" cy="50%"
                    innerRadius={50} outerRadius={72}
                    paddingAngle={3} dataKey="value"
                    onMouseEnter={(_, idx) => setActivePieIdx(idx)}
                    onClick={(_, idx) => setActivePieIdx(idx)}
                  >
                    {anomalyData.map((entry, idx) => (
                      <Cell key={`cell-${idx}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-2 text-left w-full md:w-auto">
              {anomalyData.map((entry, idx) => (
                <button
                  key={idx}
                  onClick={() => setActivePieIdx(idx)}
                  className={`flex items-center gap-2 p-2 rounded-xl border transition cursor-pointer text-left ${
                    activePieIdx === idx ? 'border-current bg-slate-100' : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                  }`}
                  style={{ borderColor: activePieIdx === idx ? entry.color : undefined }}
                >
                  <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                  <div>
                    <span className="text-[9px] text-slate-500 block font-black uppercase font-mono tracking-wider leading-none">{entry.name}</span>
                    <strong className="text-xs mt-0.5 block font-mono" style={{ color: entry.color }}>{entry.value}%</strong>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Detailed Alert Log ── */}
      <div className="glass-panel p-6 rounded-3xl border border-slate-200 relative overflow-hidden shadow-sm">
        <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-cyan-500" />
        <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-cyan-500" />
        <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-cyan-500" />
        <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-cyan-500" />

        {/* Header + Controls */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
          <div>
            <h2 className="text-sm font-black text-slate-900 flex items-center gap-2 uppercase tracking-wide">
              <FileText className="text-cyan-600 h-4 w-4" /> Diagnostic Incident Log
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {filteredAlerts.length} of {alerts.length} entries shown
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search alerts..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-2 text-xs rounded-xl glass-input w-44 focus:outline-none"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-2.5 text-slate-300 hover:text-slate-600">
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            {/* Device Filter */}
            <div className="relative flex items-center gap-1">
              <Filter className="h-3 w-3 text-slate-400" />
              <select
                value={filterDevice}
                onChange={e => setFilterDevice(e.target.value)}
                className="text-xs rounded-xl glass-input py-2 pl-2 pr-6 focus:outline-none cursor-pointer"
              >
                <option value="all">All Devices</option>
                {devices.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>

            {/* Severity Filter */}
            <select
              value={filterSeverity}
              onChange={e => setFilterSeverity(e.target.value)}
              className="text-xs rounded-xl glass-input py-2 pl-2 pr-6 focus:outline-none cursor-pointer"
            >
              <option value="all">All Severities</option>
              <option value="critical">Critical</option>
              <option value="warning">Warning</option>
              <option value="info">Info</option>
            </select>

            {/* CSV Export */}
            <button
              onClick={exportCSV}
              className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50 text-xs font-black uppercase tracking-wider text-slate-700 hover:text-emerald-700 rounded-xl transition shadow-sm cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" /> Export CSV
            </button>
          </div>
        </div>

        {/* Alert Table */}
        <div className="overflow-x-auto border border-slate-200 rounded-2xl bg-white shadow-sm">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-500 font-black uppercase text-[9px] border-b border-slate-200 tracking-widest font-mono">
              <tr>
                <th className="p-4">Alert ID</th>
                <th className="p-4">Device</th>
                <th className="p-4">Severity</th>
                <th className="p-4">Diagnostic Message</th>
                <th className="p-4">Triggered</th>
                <th className="p-4">State</th>
                <th className="p-4">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredAlerts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-10 text-center">
                    <div className="flex flex-col items-center gap-2 text-slate-400">
                      <CheckCircle className="h-8 w-8 text-emerald-400/50" />
                      <p className="text-[10px] font-mono uppercase tracking-wider">
                        {searchQuery || filterDevice !== 'all' || filterSeverity !== 'all'
                          ? 'No alerts match your filters.'
                          : 'No warnings or critical alerts registered in this session.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredAlerts.map(a => {
                  const dev = devices.find(d => d.id === a.device_id);
                  const isResolving = resolvingId === a.id;
                  return (
                    <tr key={a.id} className={`data-row transition-all duration-300 ${isResolving ? 'opacity-40' : ''}`}>
                      <td className="p-4 font-mono text-slate-400 text-[10px]">{a.id.substring(0, 12)}…</td>
                      <td className="p-4 text-slate-800 font-black text-[10px] uppercase tracking-wider">{dev?.name || 'Unknown Node'}</td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase font-mono border ${
                          a.severity === 'critical' ? 'bg-rose-50 text-rose-700 border-rose-100'
                          : a.severity === 'warning' ? 'bg-amber-50 text-amber-700 border-amber-100'
                          : 'bg-blue-50 text-blue-700 border-blue-100'
                        }`}>
                          {a.severity}
                        </span>
                      </td>
                      <td className="p-4 text-slate-600 leading-relaxed max-w-xs">{a.message}</td>
                      <td className="p-4 text-slate-400 font-mono text-[10px] whitespace-nowrap">{new Date(a.created_at).toLocaleString()}</td>
                      <td className="p-4">
                        {a.is_resolved ? (
                          <span className="flex items-center gap-1 text-emerald-600 text-[10px] font-black font-mono uppercase">
                            <CheckCircle className="h-3.5 w-3.5" /> Resolved
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-amber-500 text-[10px] font-black font-mono uppercase animate-pulse">
                            <ShieldAlert className="h-3.5 w-3.5" /> Active
                          </span>
                        )}
                      </td>
                      <td className="p-4">
                        {!a.is_resolved && (
                          <button
                            onClick={() => handleResolve(a.id)}
                            disabled={isResolving}
                            className="px-3 py-1.5 text-[9px] font-black uppercase tracking-wider bg-white border border-emerald-200 text-emerald-600 hover:bg-emerald-50 hover:border-emerald-400 rounded-lg transition cursor-pointer disabled:opacity-50"
                          >
                            {isResolving ? 'Resolving…' : 'Resolve'}
                          </button>
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
