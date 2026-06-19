// src/pages/Auth.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Sparkles, LogIn, Lock, Mail, User, Eye, EyeOff, CheckCircle } from 'lucide-react';

interface AuthProps {
  userRole: 'Visitor' | 'End-User' | 'Technician' | 'Admin';
  onRoleChange: (role: 'Visitor' | 'End-User' | 'Technician' | 'Admin') => void;
}

export default function Auth({ userRole, onRoleChange }: AuthProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('aditya.sen@aadhavan.ai');
  const [password, setPassword] = useState('password123');
  const [fullName, setFullName] = useState('Aditya Sen');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const navigate = useNavigate();

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!isLogin && !fullName.trim()) errs.name = 'Full name is required.';
    if (!email.trim()) errs.email = 'Email is required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = 'Enter a valid email address.';
    if (!password) errs.password = 'Password is required.';
    else if (password.length < 6) errs.password = 'Password must be at least 6 characters.';
    return errs;
  };

  const handleAuthSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setLoading(true);
    // Simulate async auth with mock delay
    setTimeout(() => {
      setLoading(false);
      setSuccess(true);
      setTimeout(() => navigate('/dashboard'), 1200);
    }, 1200);
  };

  const handleRoleQuickSelect = (role: typeof userRole) => {
    onRoleChange(role);
  };

  const roleInfo: Record<string, { color: string; desc: string }> = {
    Visitor:    { color: 'border-slate-200 text-slate-600 bg-white hover:bg-slate-50',         desc: 'Read-only values view.' },
    'End-User': { color: 'border-blue-200 text-blue-600 bg-blue-50 hover:bg-blue-100/60',       desc: 'Tracker node monitoring.' },
    Technician: { color: 'border-amber-200 text-amber-600 bg-amber-50 hover:bg-amber-100/60',   desc: 'Manual steering controls.' },
    Admin:      { color: 'border-cyan-200 text-cyan-600 bg-cyan-50 hover:bg-cyan-100/60',       desc: 'Full OTA firmware uploads.' },
  };

  return (
    <div className="relative min-h-screen bg-slate-50 flex items-center justify-center py-16 px-6">
      {/* Glows */}
      <div className="absolute top-1/4 left-1/4 h-[350px] w-[350px] bg-cyan-500/8 rounded-full blur-3xl -z-10 animate-pulse" style={{ animationDuration: '8s' }} />
      <div className="absolute bottom-1/4 right-1/4 h-[350px] w-[350px] bg-amber-500/8 rounded-full blur-3xl -z-10 animate-pulse" style={{ animationDuration: '6s' }} />

      <div className="w-full max-w-md space-y-6">

        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-cyan-50 border border-cyan-200 text-cyan-600 text-[10px] font-black uppercase rounded-full tracking-widest font-mono">
            <Sparkles className="h-3 w-3" />
            AadhavanAI Control Portal
          </div>
          <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">
            {isLogin ? 'Sign In to HUD Cockpit' : 'Create Operator Account'}
          </h1>
          <p className="text-slate-500 text-xs">
            Use credentials or the role simulator below to test specific permissions.
          </p>
        </div>

        {/* Auth Box */}
        <div className="glass-panel p-8 rounded-3xl border border-slate-200 shadow-xl bg-white/85 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-2.5 h-2.5 border-t border-l border-cyan-500" />
          <div className="absolute top-0 right-0 w-2.5 h-2.5 border-t border-r border-cyan-500" />
          <div className="absolute bottom-0 left-0 w-2.5 h-2.5 border-b border-l border-cyan-500" />
          <div className="absolute bottom-0 right-0 w-2.5 h-2.5 border-b border-r border-cyan-500" />

          {/* Success state */}
          {success ? (
            <div className="text-center py-4 space-y-4 animate-fade-in-up">
              <div className="p-4 bg-emerald-50 rounded-2xl inline-block border border-emerald-200">
                <CheckCircle className="h-10 w-10 text-emerald-500" />
              </div>
              <p className="text-slate-700 font-black text-sm">Authentication successful!</p>
              <p className="text-slate-400 text-xs font-mono">Redirecting to dashboard…</p>
            </div>
          ) : (
            <form onSubmit={handleAuthSubmit} className="space-y-4 text-left" noValidate>
              {/* Full Name (register only) */}
              {!isLogin && (
                <div>
                  <label htmlFor="auth-name-input" className="block text-[10px] uppercase font-black tracking-wider font-mono text-slate-500 mb-1.5">Full Name</label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                    <input
                      type="text" id="auth-name-input"
                      value={fullName} onChange={e => setFullName(e.target.value)}
                      placeholder="Aditya Sen"
                      className={`w-full pl-10 pr-4 py-3 text-xs rounded-xl focus:outline-none glass-input ${errors.name ? 'error' : ''}`}
                    />
                  </div>
                  {errors.name && <p className="text-[10px] text-rose-500 mt-1 font-mono">{errors.name}</p>}
                </div>
              )}

              {/* Email */}
              <div>
                <label htmlFor="auth-email-input" className="block text-[10px] uppercase font-black tracking-wider font-mono text-slate-500 mb-1.5">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                  <input
                    type="email" id="auth-email-input"
                    value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="name@aadhavan.ai"
                    className={`w-full pl-10 pr-4 py-3 text-xs rounded-xl focus:outline-none glass-input ${errors.email ? 'error' : ''}`}
                  />
                </div>
                {errors.email && <p className="text-[10px] text-rose-500 mt-1 font-mono">{errors.email}</p>}
              </div>

              {/* Password */}
              <div>
                <label htmlFor="auth-password-input" className="block text-[10px] uppercase font-black tracking-wider font-mono text-slate-500 mb-1.5">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'} id="auth-password-input"
                    value={password} onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className={`w-full pl-10 pr-11 py-3 text-xs rounded-xl focus:outline-none glass-input ${errors.password ? 'error' : ''}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-700 transition cursor-pointer"
                    tabIndex={-1}
                    aria-label="Toggle password visibility"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password && <p className="text-[10px] text-rose-500 mt-1 font-mono">{errors.password}</p>}
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 mt-2 bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 text-white font-black text-xs uppercase tracking-widest rounded-xl transition duration-300 shadow-md cursor-pointer flex items-center justify-center gap-2 disabled:opacity-70"
              >
                {loading ? (
                  <>
                    <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Authenticating…
                  </>
                ) : (
                  <>
                    <LogIn className="h-4 w-4 stroke-[2.5]" />
                    {isLogin ? 'Access Dashboard' : 'Register Account'}
                  </>
                )}
              </button>
            </form>
          )}

          {/* Toggle login/signup */}
          {!success && (
            <div className="mt-5 text-center">
              <button
                onClick={() => { setIsLogin(!isLogin); setErrors({}); }}
                className="text-[10px] text-slate-400 hover:text-cyan-600 font-mono uppercase tracking-wider cursor-pointer transition"
              >
                {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
              </button>
            </div>
          )}
        </div>

        {/* RBAC Simulator */}
        <div className="glass-panel p-6 rounded-3xl border border-slate-200 text-left bg-white/85 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-amber-500" />
          <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-amber-500" />
          <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-amber-500" />
          <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-amber-500" />

          <div className="flex items-center gap-2 mb-3 border-b border-slate-200 pb-2">
            <Shield className="h-4 w-4 text-amber-500" />
            <h3 className="text-xs uppercase font-black tracking-widest font-mono text-slate-800">Sandbox RBAC Simulator</h3>
          </div>
          <p className="text-[10px] text-slate-400 mb-4 leading-relaxed font-mono">
            AadhavanAI uses strict Role-Based Access Control. Click a role to switch permissions globally.
          </p>

          <div className="grid grid-cols-2 gap-2.5">
            {(Object.entries(roleInfo) as [string, { color: string; desc: string }][]).map(([role, info]) => (
              <button
                key={role}
                onClick={() => handleRoleQuickSelect(role as typeof userRole)}
                className={`p-3 rounded-xl border text-left transition duration-200 cursor-pointer ${
                  userRole === role
                    ? info.color + ' shadow-sm font-black'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 font-bold'
                }`}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-xs uppercase tracking-wider">{role}</span>
                  {userRole === role && <CheckCircle className="h-3 w-3" />}
                </div>
                <div className="text-[9px] text-slate-400 font-mono leading-normal">{info.desc}</div>
              </button>
            ))}
          </div>

          <div className="mt-4 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-mono text-slate-500 text-center">
            Currently active: <strong className="text-cyan-600">{userRole}</strong>
          </div>
        </div>

      </div>
    </div>
  );
}
