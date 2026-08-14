import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Leaf, Menu, X, Shield, PhoneCall, LogIn } from 'lucide-react';
import { useAuth } from '../../lib/AuthContext';
import { ProfileMenu } from '../common/ProfileMenu';
import { ThemeToggle } from '../common/ThemeToggle';

const LOGO_URL = 'https://media.base44.com/images/public/6a41d19b1eb6cd6bf679b527/c2b37abf0_ChatGPTImageJul28202601_07_19AM.png';

export const Navbar: React.FC = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const location = useLocation();
  const { isAuthenticated, user } = useAuth();

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 30) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { name: 'Home', path: '/' },
    { name: 'About', path: '/about' },
    { name: 'Services', path: '/services' },
    { name: 'Projects', path: '/projects' },
    { name: 'Contact', path: '/contact' },
    { name: 'Check Status', path: '/check-status' },
  ];

  const isActive = (path: string) => {
    if (path === '/' && location.pathname === '/') return true;
    if (path !== '/' && location.pathname.startsWith(path)) return true;
    return false;
  };

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? 'bg-[#0A2E24]/95 backdrop-blur-md shadow-lg border-b border-[#D4AF37]/30 py-3'
          : 'bg-gradient-to-b from-[#0A2E24]/90 via-[#0A2E24]/60 to-transparent py-5'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            {!logoError ? (
              <img
                src={LOGO_URL}
                alt="Ansumana Environmental Consultancy Inc."
                className="h-10 sm:h-12 w-auto object-contain transition-transform group-hover:scale-105"
                onError={() => setLogoError(true)}
              />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#D4AF37] to-[#B8941F] flex items-center justify-center text-[#0A2E24] shadow-md">
                <Leaf className="w-6 h-6 stroke-[2.5]" />
              </div>
            )}
            <div className="flex flex-col">
              <span className="font-heading font-extrabold text-white text-base sm:text-lg tracking-tight leading-none group-hover:text-[#D4AF37] transition-colors">
                ANSUMANA
              </span>
              <span className="text-[10px] sm:text-xs text-[#D4AF37] font-mono tracking-widest uppercase mt-0.5">
                Environmental Consultancy Inc.
              </span>
            </div>
          </Link>

          {/* Desktop Links */}
          <nav className="hidden md:flex items-center space-x-1 lg:space-x-2">
            {navLinks.map((link) => {
              const active = isActive(link.path);
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`px-3 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                    active
                      ? 'text-[#D4AF37] bg-[#1A4A3A]/60 font-semibold shadow-sm border border-[#D4AF37]/30'
                      : 'text-gray-200 hover:text-[#D4AF37] hover:bg-white/5'
                  }`}
                >
                  {link.name}
                </Link>
              );
            })}
          </nav>

          {/* Desktop Right CTA Buttons */}
          <div className="hidden md:flex items-center gap-3">
            <ThemeToggle variant="dark" />

            <Link
              to="/book"
              className="px-4 py-2 text-xs lg:text-sm font-semibold rounded-lg bg-gradient-to-r from-[#D4AF37] to-[#E5C964] text-[#0A2E24] hover:from-[#E5C964] hover:to-[#D4AF37] shadow-md transition-all flex items-center gap-2 hover:scale-105 active:scale-95"
            >
              <PhoneCall className="w-3.5 h-3.5" />
              Book a Session
            </Link>

            {isAuthenticated ? (
              <ProfileMenu variant="dark" />
            ) : (
              <Link
                to="/login"
                className="px-4 py-2 text-xs lg:text-sm font-medium rounded-lg border border-[#D4AF37]/60 text-gray-200 hover:text-[#D4AF37] hover:border-[#D4AF37] hover:bg-white/5 transition-all flex items-center gap-2"
              >
                <LogIn className="w-3.5 h-3.5" />
                Portal Login
              </Link>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="flex md:hidden items-center gap-2">
            <ThemeToggle variant="dark" />
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-gray-200 hover:text-[#D4AF37] hover:bg-white/10 focus:outline-none"
              aria-label="Toggle Navigation Menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-[#0A2E24] border-b border-[#D4AF37]/30 px-4 pt-3 pb-6 space-y-3 animate-fadeIn">
          <div className="flex flex-col space-y-1">
            {navLinks.map((link) => {
              const active = isActive(link.path);
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`px-4 py-2.5 rounded-lg text-sm font-medium ${
                    active
                      ? 'bg-[#1A4A3A] text-[#D4AF37] font-semibold border-l-4 border-[#D4AF37]'
                      : 'text-gray-200 hover:bg-white/5 hover:text-[#D4AF37]'
                  }`}
                >
                  {link.name}
                </Link>
              );
            })}
          </div>

          <div className="pt-3 border-t border-white/10 flex flex-col gap-2">
            <Link
              to="/book"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full text-center px-4 py-2.5 text-sm font-semibold rounded-lg bg-[#D4AF37] text-[#0A2E24] flex items-center justify-center gap-2 shadow-md"
            >
              <PhoneCall className="w-4 h-4" />
              Book a Session
            </Link>

            {isAuthenticated ? (
              <Link
                to={user?.role === 'admin' ? '/admin' : '/portal'}
                onClick={() => setMobileMenuOpen(false)}
                className="w-full text-center px-4 py-2.5 text-sm font-medium rounded-lg border border-[#D4AF37] text-[#D4AF37] flex items-center justify-center gap-2"
              >
                <Shield className="w-4 h-4" />
                Go to Portal ({user?.role === 'admin' ? 'Admin' : 'Client'})
              </Link>
            ) : (
              <Link
                to="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full text-center px-4 py-2.5 text-sm font-medium rounded-lg border border-gray-600 text-gray-200 flex items-center justify-center gap-2"
              >
                <LogIn className="w-4 h-4" />
                Portal Login
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
