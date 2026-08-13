import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UserPlus, Building2, Mail, Lock, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';

const LOGO_URL = 'https://media.base44.com/images/public/6a41d19b1eb6cd6bf679b527/c2b37abf0_ChatGPTImageJul28202601_07_19AM.png';

export const Register: React.FC = () => {
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    setTimeout(() => {
      const res = register(fullName, email, companyName);
      setLoading(false);
      if (res.success) {
        navigate('/portal');
      } else {
        setError(res.error || 'Registration failed.');
      }
    }, 500);
  };

  return (
    <div className="min-h-screen bg-[#0A2E24] flex items-center justify-center p-4 relative overflow-hidden font-sans">
      <div className="max-w-md w-full glass-card-dark p-8 rounded-2xl shadow-2xl space-y-6 relative z-10 border border-[#D4AF37]/30">
        <div className="text-center space-y-2">
          <Link to="/">
            <img
              src={LOGO_URL}
              alt="AEC Logo"
              className="h-10 w-auto mx-auto object-contain"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </Link>
          <h2 className="font-heading font-extrabold text-2xl text-white">Proponent Registration</h2>
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

        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1">Contact Person Name *</label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Mohamed Sesay"
              className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-[#D4AF37]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1">Company / Proponent Name *</label>
            <div className="relative">
              <Building2 className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
              <input
                type="text"
                required
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="e.g. Liberia Gold Mining Ltd."
                className="w-full pl-9 pr-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-[#D4AF37]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1">Company Email Address *</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="compliance@company.lr"
                className="w-full pl-9 pr-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-[#D4AF37]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1">Password *</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-[#D4AF37]"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-[#D4AF37] to-[#E5C964] text-[#0A2E24] font-heading font-bold text-xs uppercase tracking-wider rounded-xl hover:from-[#E5C964] hover:to-[#D4AF37] shadow-lg transition-all"
          >
            {loading ? 'Creating Account...' : 'Register Client Account'}
          </button>
        </form>

        <div className="text-center pt-2 text-xs text-gray-400">
          Already registered?{' '}
          <Link to="/login" className="text-[#D4AF37] font-semibold hover:underline">
            Sign In Here
          </Link>
        </div>
      </div>
    </div>
  );
};
