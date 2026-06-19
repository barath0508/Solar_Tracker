// src/components/Navbar.tsx
import React, { useState, useEffect, useRef } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { mockDb } from '../services/mockDb';
import type { Alert } from '../services/mockDb';
import { Sun, Bell, Shield, Check, Menu, X, User, CheckCheck, ChevronRight } from 'lucide-react';

interface NavbarProps {
  userRole: 'Visitor' | 'End-User' | 'Technician' | 'Admin';
  onRoleChange: (role: 'Visitor' | 'End-User' | 'Technician' | 'Admin') => void;
}

export default function Navbar({ userRole, onRoleChange }: NavbarProps) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [showAlertsMenu, setShowAlertsMenu] = useState(false);
  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const navigate = useNavigate();

  // Refs for outside-click detection
  const alertsRef = useRef<HTMLDivElement>(null);
  const roleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const syncAlerts = () => {
      setAlerts(mockDb.getAlerts().filter(a => !a.is_resolved));
    };
    syncAlerts();
    const unsubscribe = mockDb.subscribe(syncAlerts);
    return () => unsubscribe();
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (alertsRef.current && !alertsRef.current.contains(e.target as Node)) {
        setShowAlertsMenu(false);
      }
      if (roleRef.current && !roleRef.current.contains(e.target as Node)) {
        setShowRoleMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleResolveAlert = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    mockDb.resolveAlert(id);
  };

  const handleMarkAllRead = () => {
    setMarkingAll(true);
    const active = mockDb.getAlerts().filter(a => !a.is_resolved);
    active.forEach(a => mockDb.resolveAlert(a.id));
    setTimeout(() => setMarkingAll(false), 600);
  };

  const handleRoleSelect = (role: typeof userRole) => {
    onRoleChange(role);
    setShowRoleMenu(false);
  };

  const activeAlertCount = alerts.length;
  const ALERT_DISPLAY_LIMIT = 8;
  const displayedAlerts = alerts.slice(0, ALERT_DISPLAY_LIMIT);
  const hiddenCount = Math.max(0, alerts.length - ALERT_DISPLAY_LIMIT);

  const roleColors: Record<string, string> = {
    Visitor:    'text-slate-600 bg-slate-50 border-slate-200',
    'End-User': 'text-blue-600 bg-blue-50 border-blue-200',
    Technician: 'text-amber-600 bg-amber-50 border-amber-200',
    Admin:      'text-cyan-600 bg-cyan-50 border-cyan-200',
  };

  return (
    <nav className="sticky top-0 z-50 glass-panel border-b border-slate-200/60 bg-white/75 backdrop-blur-xl px-6 py-3 transition-all shadow-sm shadow-slate-100/80">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">

        {/* ── Brand Logo ── */}
        <Link to="/" className="flex items-center gap-2.5 group shrink-0">
          <div className="relative flex items-center justify-center p-1.5 bg-amber-500/10 rounded-xl group-hover:bg-amber-500/18 transition duration-300 border border-amber-500/20">
            <Sun className="h-5 w-5 text-amber-500 animate-spin-slow text-glow-gold" />
            <div className="absolute inset-0 rounded-xl border border-amber-400/30 scale-90 opacity-0 group-hover:scale-110 group-hover:opacity-100 transition duration-300" />
          </div>
          <span className="text-lg font-black tracking-widest text-slate-800">
            AADHAVAN<span className="text-amber-500 text-glow-solar">AI</span>
            <span className="hidden lg:inline-block ml-2 text-[9px] text-cyan-600 bg-cyan-50 border border-cyan-200 rounded px-1.5 py-0.5 tracking-wider font-mono font-bold">SYS_v2.4</span>
          </span>
        </Link>

        {/* ── Desktop Navigation Links ── */}
        <div className="hidden md:flex items-center gap-1">
          {[
            { to: '/',            label: 'Home' },
            { to: '/how-it-works', label: 'Pipeline' },
            { to: '/research',    label: 'Research' },
          ].map(({ to, label }) => (
            <NavLink key={to} to={to} end={to === '/'}
              className={({ isActive }) =>
                `px-3.5 py-1.5 rounded-xl text-xs uppercase font-extrabold tracking-wider transition-all duration-200 ${isActive
                  ? 'bg-cyan-50 text-cyan-600 border border-cyan-200 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 border border-transparent hover:bg-slate-50'}`
              }
            >{label}</NavLink>
          ))}

          <span className="h-4 w-px bg-slate-200 mx-1" />

          {[
            { to: '/dashboard', label: 'Dashboard' },
            { to: '/analytics', label: 'Analytics' },
          ].map(({ to, label }) => (
            <NavLink key={to} to={to}
              className={({ isActive }) =>
                `px-3.5 py-1.5 rounded-xl text-xs uppercase font-extrabold tracking-wider transition-all duration-200 ${isActive
                  ? 'bg-emerald-50 text-emerald-600 border border-emerald-200 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 border border-transparent hover:bg-slate-50'}`
              }
            >{label}</NavLink>
          ))}
        </div>

        {/* ── Right Controls ── */}
        <div className="hidden md:flex items-center gap-2.5">

          {/* Active Alerts Bell */}
          <div className="relative" ref={alertsRef}>
            <button
              onClick={() => { setShowAlertsMenu(v => !v); setShowRoleMenu(false); }}
              className="relative p-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 hover:text-slate-800 rounded-xl transition duration-200 focus:outline-none shadow-sm"
              aria-label="View alerts"
            >
              <Bell className="h-4 w-4" />
              {activeAlertCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-black text-white ring-2 ring-white animate-bounce">
                  {activeAlertCount > 9 ? '9+' : activeAlertCount}
                </span>
              )}
            </button>

            {showAlertsMenu && (
              <div className="absolute right-0 mt-3 w-88 w-[340px] bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 animate-fade-in-up overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
                  <div className="flex items-center gap-2">
                    <h3 className="text-[10px] uppercase font-black tracking-widest text-slate-600">
                      Anomaly Alerts
                    </h3>
                    {activeAlertCount > 0 && (
                      <span className="px-1.5 py-0.5 bg-rose-100 text-rose-600 text-[9px] font-black rounded-full border border-rose-200">
                        {activeAlertCount}
                      </span>
                    )}
                  </div>
                  {activeAlertCount > 0 && (
                    <button
                      onClick={handleMarkAllRead}
                      className="flex items-center gap-1 text-[10px] text-emerald-600 hover:text-emerald-700 font-black uppercase tracking-wider transition cursor-pointer"
                    >
                      <CheckCheck className="h-3 w-3" />
                      {markingAll ? 'Clearing...' : 'Clear All'}
                    </button>
                  )}
                </div>

                {/* Alert List */}
                <div className="max-h-72 overflow-y-auto p-2 space-y-1.5">
                  {displayedAlerts.length === 0 ? (
                    <div className="py-8 text-center">
                      <div className="h-8 w-8 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-2">
                        <Check className="h-4 w-4 text-emerald-500" />
                      </div>
                      <p className="text-xs text-slate-400 font-medium">Fleet nominal. No active anomalies.</p>
                    </div>
                  ) : (
                    displayedAlerts.map(a => (
                      <div key={a.id}
                        className="p-3 bg-slate-50 hover:bg-white border border-slate-100 hover:border-slate-200 rounded-xl flex items-start gap-2.5 justify-between transition duration-150">
                        <div className="space-y-1 min-w-0">
                          <span className={`inline-block text-[8px] font-black uppercase px-1.5 py-0.5 rounded border ${
                            a.severity === 'critical'
                              ? 'bg-rose-50 text-rose-600 border-rose-100'
                              : 'bg-amber-50 text-amber-600 border-amber-100'
                          }`}>
                            {a.severity}
                          </span>
                          <p className="text-xs text-slate-700 leading-relaxed line-clamp-2">{a.message}</p>
                          <span className="text-[9px] text-slate-400 font-mono block">
                            {new Date(a.created_at).toLocaleTimeString()}
                          </span>
                        </div>
                        <button
                          onClick={(e) => handleResolveAlert(a.id, e)}
                          title="Resolve anomaly"
                          className="p-1 hover:bg-emerald-50 text-slate-300 hover:text-emerald-600 rounded-lg transition shrink-0 mt-0.5"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))
                  )}

                  {hiddenCount > 0 && (
                    <button
                      onClick={() => { setShowAlertsMenu(false); navigate('/analytics'); }}
                      className="w-full py-2 text-[10px] text-cyan-600 hover:text-cyan-700 font-black uppercase tracking-wider flex items-center justify-center gap-1 hover:bg-cyan-50 rounded-xl transition"
                    >
                      +{hiddenCount} more alerts <ChevronRight className="h-3 w-3" />
                    </button>
                  )}
                </div>

                {/* Footer */}
                <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50">
                  <button
                    onClick={() => { setShowAlertsMenu(false); navigate('/analytics'); }}
                    className="text-[10px] text-slate-500 hover:text-cyan-600 font-mono uppercase tracking-wider transition"
                  >
                    View full alert log →
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Role Selector */}
          <div className="relative" ref={roleRef}>
            <button
              onClick={() => { setShowRoleMenu(v => !v); setShowAlertsMenu(false); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-xl text-xs font-black uppercase tracking-wider transition duration-200 shadow-sm ${roleColors[userRole] || roleColors['Visitor']}`}
            >
              <Shield className="h-3.5 w-3.5" />
              {userRole}
            </button>

            {showRoleMenu && (
              <div className="absolute right-0 mt-3 w-52 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden z-50 animate-fade-in-up">
                <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 text-[9px] uppercase font-black tracking-wider text-slate-500 font-mono">
                  Select Permission Level
                </div>
                {[
                  { role: 'Visitor',    desc: 'Read-only view' },
                  { role: 'End-User',   desc: 'Node monitoring' },
                  { role: 'Technician', desc: 'Manual controls' },
                  { role: 'Admin',      desc: 'OTA + full access' },
                ].map(({ role, desc }) => (
                  <button
                    key={role}
                    onClick={() => handleRoleSelect(role as typeof userRole)}
                    className={`w-full text-left px-4 py-2.5 text-xs hover:bg-slate-50 transition flex items-center justify-between ${
                      userRole === role ? 'text-cyan-600 bg-cyan-50/60 font-black' : 'text-slate-600 hover:text-slate-800 font-bold'
                    }`}
                  >
                    <div>
                      <div className="uppercase tracking-wider">{role}</div>
                      <div className="text-[9px] text-slate-400 font-mono mt-0.5">{desc}</div>
                    </div>
                    {userRole === role && <Check className="h-3.5 w-3.5 text-cyan-600 shrink-0" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Account */}
          <button
            onClick={() => navigate('/auth')}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-white border border-slate-200 hover:border-slate-300 text-xs font-black uppercase tracking-wider text-slate-700 rounded-xl transition duration-200 shadow-sm hover:bg-slate-50"
          >
            <User className="h-3.5 w-3.5 text-slate-500" /> Account
          </button>
        </div>

        {/* ── Mobile Hamburger ── */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="md:hidden p-2 bg-white border border-slate-200 rounded-xl text-slate-500 hover:text-slate-800 transition shadow-sm"
          aria-label="Toggle mobile menu"
        >
          {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* ── Mobile Drawer ── */}
      {isOpen && (
        <div className="md:hidden mt-3 mx-0 bg-white border border-slate-200 p-4 rounded-2xl flex flex-col gap-2 shadow-xl animate-fade-in-up">
          {[
            { to: '/',             label: 'Home',      color: '' },
            { to: '/how-it-works', label: 'Pipeline',  color: '' },
            { to: '/research',     label: 'Research',  color: '' },
          ].map(({ to, label }) => (
            <Link key={to} to={to} onClick={() => setIsOpen(false)}
              className="text-slate-600 py-1.5 px-2 hover:text-slate-900 hover:bg-slate-50 rounded-lg text-xs uppercase font-extrabold tracking-wider transition">
              {label}
            </Link>
          ))}
          <hr className="border-slate-100 my-1" />
          {[
            { to: '/dashboard', label: 'Dashboard' },
            { to: '/analytics', label: 'Analytics' },
          ].map(({ to, label }) => (
            <Link key={to} to={to} onClick={() => setIsOpen(false)}
              className="text-emerald-600 py-1.5 px-2 hover:bg-emerald-50 rounded-lg uppercase font-extrabold text-xs tracking-wider transition">
              {label}
            </Link>
          ))}
          <hr className="border-slate-100 my-1" />
          <p className="text-[9px] text-slate-500 font-black uppercase tracking-wider font-mono px-1">Permission Level</p>
          <div className="grid grid-cols-2 gap-2 mt-1">
            {(['Visitor', 'End-User', 'Technician', 'Admin'] as const).map(r => (
              <button key={r}
                onClick={() => { handleRoleSelect(r); setIsOpen(false); }}
                className={`px-3 py-2 text-[10px] rounded-xl border text-center font-bold uppercase tracking-wider transition ${
                  userRole === r ? 'bg-cyan-50 text-cyan-600 border-cyan-200' : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                }`}
              >{r}</button>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
}
