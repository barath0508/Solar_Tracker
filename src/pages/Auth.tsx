// src/pages/Auth.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Shield, Sparkles, LogIn, Lock, Mail, User } from 'lucide-react';

interface AuthProps {
  userRole: 'Visitor' | 'End-User' | 'Technician' | 'Admin';
  onRoleChange: (role: 'Visitor' | 'End-User' | 'Technician' | 'Admin') => void;
}

export default function Auth({ userRole, onRoleChange }: AuthProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('aditya.sen@aadhavan.ai');
  const [password, setPassword] = useState('password123');
  const [fullName, setFullName] = useState('Aditya Sen');
  const navigate = useNavigate();

  const handleAuthSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // In our mock fallback, authentication is always successful!
    // Simply navigate to dashboard
    navigate('/dashboard');
  };

  const handleRoleQuickSelect = (role: typeof userRole) => {
    onRoleChange(role);
  };

  return (
    <div className="relative min-h-screen bg-slate-50 flex items-center justify-center py-16 px-6">
      {/* Dynamic light glows */}
      <div className="absolute top-1/4 left-1/4 h-[350px] w-[350px] bg-cyan-500/10 rounded-full blur-3xl -z-10 animate-pulse" style={{ animationDuration: '8s' }} />
      <div className="absolute bottom-1/4 right-1/4 h-[350px] w-[350px] bg-amber-500/10 rounded-full blur-3xl -z-10 animate-pulse" style={{ animationDuration: '6s' }} />

      <div className="w-full max-w-md space-y-8">
        
        {/* Header Title */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-1 px-3 py-1.5 bg-cyan-50 border border-cyan-200 text-cyan-600 text-[10px] font-black uppercase rounded-full tracking-widest font-mono">
            <Sparkles className="h-3 w-3 animate-pulse" /> AadhavanAI Control Portal
          </div>
          <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">
            {isLogin ? 'Sign In to HUD Cockpit' : 'Create Operator Account'}
          </h2>
          <p className="text-slate-600 text-xs">
            Enter your credentials or use the role simulator below to test specific permissions.
          </p>
        </div>

        {/* Auth Box */}
        <div className="glass-panel p-8 rounded-3xl relative overflow-hidden border border-slate-200 shadow-xl bg-white/80">
          <div className="absolute top-0 left-0 w-2.5 h-2.5 border-t border-l border-cyan-500" />
          <div className="absolute top-0 right-0 w-2.5 h-2.5 border-t border-r border-cyan-500" />
          <div className="absolute bottom-0 left-0 w-2.5 h-2.5 border-b border-l border-cyan-500" />
          <div className="absolute bottom-0 right-0 w-2.5 h-2.5 border-b border-r border-cyan-500" />
          
          <form onSubmit={handleAuthSubmit} className="space-y-5 text-left">
            {!isLogin && (
              <div>
                <label htmlFor="auth-name-input" className="block text-[10px] uppercase font-black tracking-wider font-mono text-slate-500 mb-1.5">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                  <input 
                     type="text" 
                     id="auth-name-input"
                     value={fullName}
                     onChange={(e) => setFullName(e.target.value)}
                     required
                     placeholder="Aditya Sen"
                     className="w-full pl-10 pr-4 py-3 text-xs text-slate-800 rounded-xl focus:outline-none glass-input"
                  />
                </div>
              </div>
            )}

            <div>
              <label htmlFor="auth-email-input" className="block text-[10px] uppercase font-black tracking-wider font-mono text-slate-500 mb-1.5">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                <input 
                  type="email" 
                  id="auth-email-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="name@aadhavan.ai"
                  className="w-full pl-10 pr-4 py-3 text-xs text-slate-800 rounded-xl focus:outline-none glass-input"
                />
              </div>
            </div>

            <div>
              <label htmlFor="auth-password-input" className="block text-[10px] uppercase font-black tracking-wider font-mono text-slate-500 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                <input 
                  type="password" 
                  id="auth-password-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-3 text-xs text-slate-800 rounded-xl focus:outline-none glass-input"
                />
              </div>
            </div>

            <button 
              type="submit"
              className="w-full py-3.5 bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-700 hover:to-emerald-700 text-white font-black text-xs uppercase tracking-widest rounded-xl transition duration-300 shadow-md shadow-cyan-100 cursor-pointer flex items-center justify-center gap-2"
            >
              <LogIn className="h-4 w-4 stroke-[3]" />
              <span>{isLogin ? 'Access Dashboard' : 'Register Account'}</span>
            </button>
          </form>

          {/* Toggle login/signup */}
          <div className="mt-5 text-center">
            <button 
              onClick={() => setIsLogin(!isLogin)}
              className="text-[10px] text-slate-500 hover:text-cyan-600 underline font-mono uppercase tracking-wider cursor-pointer"
            >
              {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
            </button>
          </div>
        </div>

        {/* 🛠️ Mock Role Simulator Panel */}
        <div className="glass-panel p-6 rounded-3xl relative overflow-hidden border border-slate-200 text-left bg-white/80">
          <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-amber-500" />
          <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-amber-500" />
          <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-amber-500" />
          <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-amber-500" />

          <div className="flex items-center gap-2 mb-3 border-b border-slate-200 pb-2">
            <Shield className="h-4 w-4 text-amber-600" />
            <h3 className="text-xs uppercase font-black tracking-widest font-mono text-slate-800">Sandbox RBAC Simulator</h3>
          </div>
          
          <p className="text-[10px] text-slate-500 mb-4 leading-relaxed font-mono">
            AadhavanAI utilizes strict Role-Based Access Control (RBAC). Select a simulation privilege state below.
          </p>

          <div className="grid grid-cols-2 gap-3">
            {[
              { role: 'Visitor', desc: 'Read-only values view.' },
              { role: 'End-User', desc: 'Tracker node monitoring.' },
              { role: 'Technician', desc: 'Manual steering controls.' },
              { role: 'Admin', desc: 'Full OTA firmware uploads.' }
            ].map(item => (
              <button
                key={item.role}
                onClick={() => handleRoleQuickSelect(item.role as any)}
                className={`p-3 rounded-xl border text-left transition duration-200 cursor-pointer ${
                  userRole === item.role
                    ? 'bg-cyan-50 text-cyan-600 border-cyan-300 shadow-sm'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className={`text-xs font-black uppercase tracking-wider ${userRole === item.role ? 'text-cyan-600' : 'text-slate-800'}`}>{item.role}</div>
                <div className="text-[9px] text-slate-550 font-mono mt-1 leading-normal">{item.desc}</div>
              </button>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
