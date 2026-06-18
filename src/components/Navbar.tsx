// src/components/Navbar.tsx
import React, { useState, useEffect } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { mockDb } from '../services/mockDb';
import type { Alert } from '../services/mockDb';
import { Sun, Bell, Shield, Check, Menu, X, User } from 'lucide-react';


interface NavbarProps {
  userRole: 'Visitor' | 'End-User' | 'Technician' | 'Admin';
  onRoleChange: (role: 'Visitor' | 'End-User' | 'Technician' | 'Admin') => void;
}

export default function Navbar({ userRole, onRoleChange }: NavbarProps) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [showAlertsMenu, setShowAlertsMenu] = useState(false);
  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Sync alerts from mock db
    const syncAlerts = () => {
      setAlerts(mockDb.getAlerts().filter(a => !a.is_resolved));
    };

    syncAlerts();
    const unsubscribe = mockDb.subscribe(syncAlerts);
    return () => unsubscribe();
  }, []);

  const handleResolveAlert = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    mockDb.resolveAlert(id);
  };

  const handleRoleSelect = (role: typeof userRole) => {
    onRoleChange(role);
    setShowRoleMenu(false);
  };

  const activeAlertCount = alerts.length;

  return (
    <nav className="sticky top-0 z-50 glass-panel border-b border-slate-800/50 bg-slate-950/70 backdrop-blur-xl px-6 py-3.5 transition-all shadow-lg shadow-black/30">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        
        {/* Brand Logo */}
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="relative flex items-center justify-center p-1.5 bg-amber-500/10 rounded-xl group-hover:bg-amber-500/15 transition duration-300 border border-amber-500/20">
            <Sun className="h-5.5 w-5.5 text-amber-400 animate-spin-slow text-glow-gold" />
            <div className="absolute inset-0 rounded-xl border border-amber-400/30 scale-90 opacity-0 group-hover:scale-110 group-hover:opacity-100 transition duration-300" />
          </div>
          <span className="text-lg font-black tracking-widest text-white">
            AADHAVAN<span className="text-amber-500 text-glow-solar">AI</span>
            <span className="hidden lg:inline-block ml-2 text-[9px] text-cyan-400 bg-cyan-950/40 border border-cyan-500/25 rounded px-1.5 py-0.5 tracking-wider font-mono font-bold">SYS_v2.4</span>
          </span>
        </Link>

        {/* Desktop Navigation Links */}
        <div className="hidden md:flex items-center gap-2">
          <NavLink 
            to="/" 
            className={({ isActive }) => 
              `px-3.5 py-1.5 rounded-xl text-xs uppercase font-extrabold tracking-wider transition-all duration-300 ${isActive ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/25 shadow-[0_0_10px_rgba(6,182,212,0.05)]' : 'text-slate-400 hover:text-white border border-transparent'}`
            }
          >
            Home
          </NavLink>
          <NavLink 
            to="/how-it-works" 
            className={({ isActive }) => 
              `px-3.5 py-1.5 rounded-xl text-xs uppercase font-extrabold tracking-wider transition-all duration-300 ${isActive ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/25 shadow-[0_0_10px_rgba(6,182,212,0.05)]' : 'text-slate-400 hover:text-white border border-transparent'}`
            }
          >
            Pipeline
          </NavLink>
          <NavLink 
            to="/research" 
            className={({ isActive }) => 
              `px-3.5 py-1.5 rounded-xl text-xs uppercase font-extrabold tracking-wider transition-all duration-300 ${isActive ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/25 shadow-[0_0_10px_rgba(6,182,212,0.05)]' : 'text-slate-400 hover:text-white border border-transparent'}`
            }
          >
            Research
          </NavLink>

          <span className="h-4 w-px bg-slate-800/80 mx-1" />

          {/* Authenticated routes */}
          <NavLink 
            to="/dashboard" 
            className={({ isActive }) => 
              `px-3.5 py-1.5 rounded-xl text-xs uppercase font-extrabold tracking-wider transition-all duration-300 ${isActive ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 shadow-[0_0_10px_rgba(16,185,129,0.05)]' : 'text-slate-400 hover:text-white border border-transparent'}`
            }
          >
            Dashboard
          </NavLink>
          <NavLink 
            to="/analytics" 
            className={({ isActive }) => 
              `px-3.5 py-1.5 rounded-xl text-xs uppercase font-extrabold tracking-wider transition-all duration-300 ${isActive ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 shadow-[0_0_10px_rgba(16,185,129,0.05)]' : 'text-slate-400 hover:text-white border border-transparent'}`
            }
          >
            Analytics
          </NavLink>
        </div>

        {/* Control Actions (Alerts Bell, Role Selector, Simulation Badges) */}
        <div className="hidden md:flex items-center gap-3">
          
          {/* Active Alerts Bell */}
          <div className="relative">
            <button 
              onClick={() => setShowAlertsMenu(!showAlertsMenu)}
              className="relative p-2 bg-slate-900/60 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 text-slate-300 rounded-xl transition duration-300 focus:outline-none"
            >
              <Bell className="h-4.5 w-4.5" />
              {activeAlertCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-rose-500 text-[9px] font-black text-white ring-2 ring-slate-950 animate-bounce">
                  {activeAlertCount}
                </span>
              )}
            </button>

            {showAlertsMenu && (
              <div className="absolute right-0 mt-3 w-80 bg-slate-900/95 border border-slate-800 rounded-2xl shadow-2xl p-4 backdrop-blur-xl z-50">
                <div className="flex items-center justify-between mb-3 border-b border-slate-800/80 pb-2">
                  <h3 className="text-[10px] uppercase font-black tracking-widest text-slate-400">Telemetry Anomalies ({activeAlertCount})</h3>
                  {activeAlertCount > 0 && <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-ping" />}
                </div>
                {alerts.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-4 font-medium">No active anomalies. Fleet nominal.</p>
                ) : (
                  <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                    {alerts.map(a => (
                      <div key={a.id} className="p-3 bg-slate-950/80 border border-slate-850 rounded-xl flex items-start gap-2.5 justify-between hover:border-slate-800 transition">
                        <div className="space-y-1">
                          <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded border ${
                            a.severity === 'critical' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          }`}>
                            {a.severity}
                          </span>
                          <p className="text-xs text-slate-300 leading-normal">{a.message}</p>
                          <span className="text-[9px] text-slate-500 font-mono block">{new Date(a.created_at).toLocaleTimeString()}</span>
                        </div>
                        <button 
                          onClick={(e) => handleResolveAlert(a.id, e)}
                          title="Resolve anomaly"
                          className="p-1 hover:bg-emerald-500/10 text-slate-500 hover:text-emerald-400 rounded transition"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Interactive Role Selector Dropdown (RBAC Simulator) */}
          <div className="relative">
            <button 
              onClick={() => setShowRoleMenu(!showRoleMenu)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500/10 text-cyan-400 border border-cyan-500/25 hover:border-cyan-500/40 rounded-xl text-xs font-black uppercase tracking-wider transition duration-300"
            >
              <Shield className="h-3.5 w-3.5" />
              HUD: {userRole}
            </button>
            
            {showRoleMenu && (
              <div className="absolute right-0 mt-3 w-48 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden z-50">
                <div className="bg-slate-950 p-3 border-b border-slate-800 text-[9px] uppercase font-black tracking-wider text-slate-500 font-mono">
                  Permissions level
                </div>
                {['Visitor', 'End-User', 'Technician', 'Admin'].map((role) => (
                  <button
                    key={role}
                    onClick={() => handleRoleSelect(role as any)}
                    className={`w-full text-left px-4 py-2.5 text-xs hover:bg-slate-800 transition flex items-center justify-between font-bold uppercase tracking-wider ${
                      userRole === role ? 'text-cyan-400 bg-slate-800/40' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {role}
                    {userRole === role && <Check className="h-3.5 w-3.5" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button 
            onClick={() => navigate('/auth')} 
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-900/60 border border-slate-800 hover:border-slate-700 text-xs font-black uppercase tracking-wider text-white rounded-xl transition duration-300"
          >
            <User className="h-3.5 w-3.5 text-slate-400" /> Account
          </button>
        </div>

        {/* Mobile Menu Toggler */}
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className="md:hidden p-2 bg-slate-900/60 rounded-xl text-slate-400 hover:text-white transition"
        >
          {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>

      </div>

      {/* Mobile Drawer menu */}
      {isOpen && (
        <div className="md:hidden mt-4 bg-slate-950/95 border border-slate-800/80 p-4 rounded-2xl flex flex-col gap-3">
          <Link to="/" onClick={() => setIsOpen(false)} className="text-slate-300 py-1 hover:text-white text-xs uppercase font-extrabold tracking-wider">Home</Link>
          <Link to="/how-it-works" onClick={() => setIsOpen(false)} className="text-slate-300 py-1 hover:text-white text-xs uppercase font-extrabold tracking-wider">Pipeline</Link>
          <Link to="/research" onClick={() => setIsOpen(false)} className="text-slate-300 py-1 hover:text-white text-xs uppercase font-extrabold tracking-wider">Research</Link>
          <hr className="border-slate-900 my-1" />
          <Link to="/dashboard" onClick={() => setIsOpen(false)} className="text-emerald-400 py-1 uppercase font-extrabold text-xs tracking-wider">Dashboard</Link>
          <Link to="/analytics" onClick={() => setIsOpen(false)} className="text-emerald-400 py-1 uppercase font-extrabold text-xs tracking-wider">Analytics</Link>
          <hr className="border-slate-900 my-1" />
          <div className="flex flex-col gap-2 pt-1">
            <p className="text-[9px] text-slate-500 font-black uppercase tracking-wider font-mono">Permissions Level</p>
            <div className="grid grid-cols-2 gap-2 mt-1">
              {['Visitor', 'End-User', 'Technician', 'Admin'].map(r => (
                <button
                  key={r}
                  onClick={() => { handleRoleSelect(r as any); setIsOpen(false); }}
                  className={`px-3 py-1.5 text-[10px] rounded-lg border text-center font-bold uppercase tracking-wider transition ${
                    userRole === r ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' : 'bg-slate-900 text-slate-400 border-slate-850'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
