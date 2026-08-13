import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, CheckCircle2 } from 'lucide-react';

export const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSent(true);
  };

  return (
    <div className="min-h-screen bg-[#0A2E24] flex items-center justify-center p-4 font-sans">
      <div className="max-w-md w-full glass-card-dark p-8 rounded-2xl shadow-2xl space-y-6 border border-[#D4AF37]/30">
        <div className="text-center space-y-2">
          <h2 className="font-heading font-extrabold text-2xl text-white">Password Recovery</h2>
          <p className="text-xs text-gray-300">Enter your registered company email to receive reset instructions.</p>
        </div>

        {sent ? (
          <div className="text-center space-y-4 py-4">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-[#D4AF37] flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <p className="text-xs text-gray-200">
              Reset link dispatched to <strong className="text-[#D4AF37]">{email}</strong>. Check your inbox or click below to simulate password reset.
            </p>
            <Link
              to={`/reset-password?token=demo-token-123&email=${encodeURIComponent(email)}`}
              className="inline-block py-2 px-4 bg-[#D4AF37] text-[#0A2E24] font-bold text-xs rounded-lg"
            >
              Open Reset Password Screen
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">Company Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.sl"
                  className="w-full pl-9 pr-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-[#D4AF37]"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-[#D4AF37] text-[#0A2E24] font-bold text-xs uppercase rounded-xl hover:bg-[#E5C964]"
            >
              Send Password Reset Link
            </button>
          </form>
        )}

        <div className="text-center pt-2">
          <Link to="/login" className="text-xs text-gray-400 hover:text-[#D4AF37] inline-flex items-center gap-1">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
};
