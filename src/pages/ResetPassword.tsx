import React, { useState } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { Lock, CheckCircle2 } from 'lucide-react';

export const ResetPassword: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || 'demo-token';
  const email = searchParams.get('email') || 'client@company.sl';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [done, setDone] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      alert('Passwords do not match.');
      return;
    }
    setDone(true);
  };

  return (
    <div className="min-h-screen bg-[#0A2E24] flex items-center justify-center p-4 font-sans">
      <div className="max-w-md w-full glass-card-dark p-8 rounded-2xl shadow-2xl space-y-6 border border-[#D4AF37]/30">
        <div className="text-center space-y-2">
          <h2 className="font-heading font-extrabold text-2xl text-white">Reset Password</h2>
          <p className="text-xs text-gray-300">Set a new password for account: <strong className="text-[#D4AF37]">{email}</strong></p>
        </div>

        {done ? (
          <div className="text-center space-y-4 py-4">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-[#D4AF37] flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <p className="text-xs text-gray-200">Your password has been updated successfully.</p>
            <button
              onClick={() => navigate('/login')}
              className="py-2.5 px-6 bg-[#D4AF37] text-[#0A2E24] font-bold text-xs rounded-lg"
            >
              Sign In with New Password
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">New Password</label>
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

            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">Confirm New Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-[#D4AF37]"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-[#D4AF37] text-[#0A2E24] font-bold text-xs uppercase rounded-xl hover:bg-[#E5C964]"
            >
              Update Password
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
