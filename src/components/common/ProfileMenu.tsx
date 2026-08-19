import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ChevronDown,
  ChevronRight,
  User,
  Settings,
  HelpCircle,
  LogOut,
  LayoutDashboard,
  Building2,
} from 'lucide-react';
import { useAuth } from '../../lib/AuthContext';

interface ProfileMenuProps {
  /** 'dark' matches the public homepage navbar; 'light' matches the portal header. */
  variant?: 'dark' | 'light';
  /** Optional: opens an account details modal (portal header usage). */
  onViewAccount?: () => void;
  /** Optional: custom logout handler (e.g. navigate to /login). Defaults to auth logout. */
  onLogout?: () => void;
}

export const ProfileMenu: React.FC<ProfileMenuProps> = ({
  variant = 'dark',
  onViewAccount,
  onLogout,
}) => {
  const [open, setOpen] = useState(false);
  const { user, proponent, logout } = useAuth();
  const navigate = useNavigate();

  const isAdmin = user?.role === 'admin';
  const isDark = variant === 'dark';
  const dashboardPath = isAdmin ? '/admin' : '/portal';
  const settingsPath = isAdmin ? '/admin/settings' : '/portal/company';
  const supportPath = isAdmin ? '/admin/support' : '/portal/support';

  const handleSignOut = async () => {
    setOpen(false);
    if (onLogout) {
      onLogout();
    } else {
      await logout();
      navigate('/login');
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={
          isDark
            ? 'px-3.5 py-1.5 rounded-xl border border-[#D4AF37] bg-[#1A4A3A]/80 hover:bg-[#1A4A3A] text-white transition-all flex items-center gap-2 shadow-md group'
            : 'px-3 py-1.5 rounded-xl border border-gray-200 hover:border-[#0A2E24] bg-gray-50/80 hover:bg-gray-100 transition-all shadow-2xs flex items-center gap-2 group'
        }
      >
        <div
          className={
            isDark
              ? 'w-6 h-6 rounded-full bg-[#D4AF37] text-[#0A2E24] font-bold text-xs flex items-center justify-center shrink-0'
              : 'w-7 h-7 rounded-full bg-[#0A2E24] text-[#D4AF37] font-bold text-xs flex items-center justify-center shadow-xs border border-[#D4AF37]/30 shrink-0'
          }
        >
          {user?.full_name?.charAt(0) || 'U'}
        </div>
        <div className={isDark ? 'text-left text-xs' : 'text-left hidden sm:block'}>
          <span
            className={
              isDark
                ? 'font-bold text-[#D4AF37] block leading-tight'
                : 'text-xs font-extrabold text-[#0A2E24] truncate max-w-[110px] leading-none block'
            }
          >
            {isDark ? 'Profile' : user?.full_name?.split(' ')[0] || 'Profile'}
          </span>
        </div>
        <ChevronDown
          className={
            isDark
              ? 'w-3.5 h-3.5 text-[#D4AF37] group-hover:translate-y-0.5 transition-transform'
              : 'w-3.5 h-3.5 text-gray-500 group-hover:text-[#0A2E24] transition-transform'
          }
        />
      </button>

      {open && (
        <div
          className={`absolute right-0 mt-2 rounded-2xl shadow-2xl border py-2 z-50 animate-fadeIn ${
            isDark
              ? 'w-64 bg-[#0A2E24] border-[#D4AF37]/30 text-white'
              : 'w-72 bg-white border-gray-200'
          }`}
          onMouseLeave={() => setOpen(false)}
        >
          {/* Account Overview Header */}
          <div
            className={
              isDark
                ? 'px-4 py-2.5 border-b border-white/10 bg-[#08241C]'
                : 'px-4 py-3 bg-gradient-to-br from-[#0A2E24] to-[#1A4A3A] text-white rounded-t-xl -mt-2 border-b border-[#D4AF37]/30'
            }
          >
            <div className="flex items-center gap-3">
              <div
                className={
                  isDark
                    ? 'w-6 h-6 rounded-full bg-[#D4AF37] text-[#0A2E24] font-bold text-[10px] flex items-center justify-center shrink-0'
                    : 'w-10 h-10 rounded-full bg-[#D4AF37] text-[#0A2E24] font-extrabold text-sm flex items-center justify-center shadow-md shrink-0'
                }
              >
                {user?.full_name?.charAt(0) || 'U'}
              </div>
              <div className="overflow-hidden">
                <p className={isDark ? 'text-xs font-bold text-white truncate' : 'text-xs font-extrabold text-white truncate'}>
                  {user?.full_name}
                </p>
                <p className="text-[10px] text-[#D4AF37] font-mono truncate">{user?.email}</p>
                <span
                  className={
                    isDark
                      ? 'inline-block mt-1 px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'inline-block mt-1 px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  }
                >
                  {isAdmin ? 'EPA System Administrator' : proponent?.company_name || 'Licensed Proponent'}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div className="p-1.5 space-y-0.5 border-b border-white/10 text-xs">
            {isDark && (
              <Link
                to={dashboardPath}
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2 text-gray-200 hover:text-[#D4AF37] hover:bg-white/5 rounded-xl transition-colors font-semibold"
              >
                <LayoutDashboard className="w-4 h-4 text-[#D4AF37]" />
                <span>Go to Portal Dashboard</span>
              </Link>
            )}

            {onViewAccount && (
              <button
                onClick={() => {
                  setOpen(false);
                  onViewAccount();
                }}
                className="w-full text-left flex items-center justify-between px-3 py-2 font-medium text-gray-700 hover:bg-emerald-50 hover:text-[#0A2E24] rounded-xl transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <User className="w-4 h-4 text-[#0A2E24]" />
                  <span>View Account Details</span>
                </div>
                <span className="text-[9px] font-mono bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded">Info</span>
              </button>
            )}

            <Link
              to={settingsPath}
              onClick={() => setOpen(false)}
              className={`flex items-center justify-between px-3 py-2 font-medium rounded-xl transition-colors ${
                isDark
                  ? 'text-gray-200 hover:text-[#D4AF37] hover:bg-white/5'
                  : 'text-gray-700 hover:bg-emerald-50 hover:text-[#0A2E24]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Settings className={`w-4 h-4 ${isDark ? 'text-[#D4AF37]' : 'text-[#D4AF37]'}`} />
                <span>{isAdmin ? 'Company Settings' : 'Company Profile'}</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
            </Link>

            <Link
              to={supportPath}
              onClick={() => setOpen(false)}
              className={`flex items-center justify-between px-3 py-2 font-medium rounded-xl transition-colors ${
                isDark
                  ? 'text-gray-200 hover:text-[#D4AF37] hover:bg-white/5'
                  : 'text-gray-700 hover:bg-emerald-50 hover:text-[#0A2E24]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <HelpCircle className="w-4 h-4 text-emerald-600" />
                <span>Support &amp; Assistance</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
            </Link>
          </div>

          {/* Sign Out */}
          <div className="p-1">
            <button
              onClick={handleSignOut}
              className={`w-full text-left flex items-center gap-2.5 px-3 py-2 text-xs font-bold rounded-xl transition-colors ${
                isDark
                  ? 'text-red-400 hover:bg-red-500/10'
                  : 'text-red-600 hover:bg-red-50'
              }`}
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
