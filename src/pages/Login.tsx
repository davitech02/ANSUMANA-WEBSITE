import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogIn, Lock, Mail, Shield, AlertCircle, ArrowRight } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { getStorageData } from '../lib/storage';

const LOGO_URL = 'https://media.base44.com/images/public/6a41d19b1eb6cd6bf679b527/c2b37abf0_ChatGPTImageJul28202601_07_19AM.png';

export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, switchRole } = useAuth();
  const navigate = useNavigate();

  const navigateByActiveRole = () => {
    const activeId = localStorage.getItem('aec_active_user_id');
    const activeUser = getStorageData().users.find((u) => u.id === activeId);
    if (activeUser?.role === 'admin') {
      navigate('/admin');
    } else {
      navigate('/portal');
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    setTimeout(() => {
      const res = login(email, password);
      setLoading(false);
      if (res.success) {
        navigateByActiveRole();
      } else {
        setError(res.error || 'Login failed.');
      }
    }, 400);
  };

  const quickDemoLogin = (type: 'admin' | 'client') => {
    if (type === 'admin') {
      switchRole('admin');
    } else {
      switchRole('client', 'compliance@liberiagold.lr');
    }
    navigateByActiveRole();
  };

  return (
    <div className="min-h-screen bg-[#0A2E24] flex items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Background Orbs */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-[#2A6A52]/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-[#D4AF37]/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full glass-card-dark p-8 rounded-2xl shadow-2xl space-y-6 relative z-10 border border-[#D4AF37]/30">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <Link to="/" className="inline-block">
            <img
              src={LOGO_URL}
              alt="AEC Logo"
              className="h-12 w-auto mx-auto object-contain"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </Link>
          <h2 className="font-heading font-extrabold text-2xl text-white">AEC Compliance Portal</h2>
          <p className="text-xs text-[#D4AF37] font-mono tracking-wider uppercase">
            Ansumana Environmental Consultancy Inc.
          </p>
        </div>

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-300 text-xs rounded-lg flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1">Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@ansumanaenv.com or client@company.sl"
                className="w-full pl-9 pr-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#D4AF37]"
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-xs font-medium text-gray-300">Password</label>
              <Link to="/forgot-password" className="text-[11px] text-[#D4AF37] hover:underline">
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#D4AF37]"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-[#D4AF37] to-[#E5C964] text-[#0A2E24] font-heading font-bold text-xs uppercase tracking-wider rounded-xl hover:from-[#E5C964] hover:to-[#D4AF37] shadow-lg transition-all flex items-center justify-center gap-2"
          >
            {loading ? 'Authenticating...' : 'Sign In to Portal'}
          </button>
        </form>

        {/* Quick Demo Credentials Switcher */}
        <div className="pt-4 border-t border-white/10 space-y-2 text-center">
          <p className="text-[11px] text-gray-400 font-mono">DEMO ONE-CLICK LOGIN:</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => quickDemoLogin('admin')}
              className="py-2 px-3 bg-[#1A4A3A] hover:bg-[#2A6A52] text-[#D4AF37] border border-[#D4AF37]/30 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
            >
              <Shield className="w-3.5 h-3.5" /> Admin Demo
            </button>
            <button
              onClick={() => quickDemoLogin('client')}
              className="py-2 px-3 bg-white/10 hover:bg-white/20 text-gray-200 border border-white/20 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
            >
              <LogIn className="w-3.5 h-3.5 text-[#D4AF37]" /> Client Demo
            </button>
          </div>
        </div>

        <div className="text-center pt-2 text-xs text-gray-400">
          New proponent company?{' '}
          <Link to="/register" className="text-[#D4AF37] font-semibold hover:underline">
            Register Proponent Account
          </Link>
        </div>

        <div className="text-center pt-2 border-t border-white/10">
          <Link to="/" className="text-xs text-gray-400 hover:text-[#D4AF37] inline-flex items-center gap-1">
            ← Back to Public Website
          </Link>
        </div>
      </div>
    </div>
  );
};
