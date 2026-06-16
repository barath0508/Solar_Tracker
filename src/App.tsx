// src/App.tsx
import { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import HowItWorks from './pages/HowItWorks';
import Research from './pages/Research';
import Dashboard from './pages/Dashboard';
import DeviceDetail from './pages/DeviceDetail';
import Analytics from './pages/Analytics';
import Auth from './pages/Auth';
import { mockDb } from './services/mockDb';

function App() {
  const [userRole, setUserRole] = useState<'Visitor' | 'End-User' | 'Technician' | 'Admin'>('Admin');

  // Sync role state on boot
  useEffect(() => {
    const profile = mockDb.getProfile();
    if (profile) {
      setUserRole(profile.role);
    }
  }, []);

  const handleRoleChange = (role: typeof userRole) => {
    mockDb.setRole(role);
    setUserRole(role);
  };

  return (
    <HashRouter>
      <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100">
        
        {/* Navbar */}
        <Navbar userRole={userRole} onRoleChange={handleRoleChange} />

        {/* Page Content */}
        <main className="flex-grow">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/how-it-works" element={<HowItWorks />} />
            <Route path="/research" element={<Research />} />
            <Route path="/dashboard" element={<Dashboard userRole={userRole} />} />
            <Route path="/devices/:deviceId" element={<DeviceDetail userRole={userRole} />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/auth" element={<Auth userRole={userRole} onRoleChange={handleRoleChange} />} />
            {/* Fallback redirect */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>

        {/* 📋 Footer */}
        <footer className="bg-slate-950 border-t border-slate-900 py-12 px-6 text-slate-500 text-xs">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-1.5 text-center md:text-left">
              <p className="font-extrabold text-slate-400">SURYAMITRA AI SOLAR TRACKER SYSTEM</p>
              <p>Designed and engineered in India. Solar yield lift of up to 30% via dual-axis embedded calculations.</p>
            </div>

            <div className="flex gap-6 text-slate-400 font-medium">
              <a href="#/" className="hover:text-amber-400 transition">Disclaimer</a>
              <a href="#/" className="hover:text-amber-400 transition">Privacy Policy</a>
              <a href="#/" className="hover:text-amber-400 transition">Terms of Service</a>
            </div>

            <p>© {new Date().getFullYear()} SuryaMitra Inc. All rights reserved.</p>
          </div>
        </footer>

      </div>
    </HashRouter>
  );
}

export default App;
