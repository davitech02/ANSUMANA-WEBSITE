import React from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Phone, Mail, MessageSquare, ShieldCheck, ArrowRight } from 'lucide-react';

const LOGO_URL = 'https://media.base44.com/images/public/6a41d19b1eb6cd6bf679b527/c2b37abf0_ChatGPTImageJul28202601_07_19AM.png';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-[#0A2E24] text-white pt-16 pb-8 border-t border-[#D4AF37]/30 relative overflow-hidden">
      {/* Decorative gradient blur background */}
      <div className="absolute top-0 right-0 -mt-12 -mr-12 w-96 h-96 bg-[#2A6A52]/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 -mb-12 -ml-12 w-96 h-96 bg-[#D4AF37]/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 pb-12 border-b border-white/10">
          {/* Column 1: Brand Info */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <img
                src={LOGO_URL}
                alt="AEC Logo"
                className="h-12 w-auto object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
              <div>
                <h3 className="font-heading font-extrabold text-lg text-white tracking-tight">
                  ANSUMANA
                </h3>
                <p className="text-[#D4AF37] font-mono text-xs tracking-widest uppercase">
                  Environmental Consultancy Inc.
                </p>
              </div>
            </div>
            <p className="text-gray-300 text-sm leading-relaxed">
              Leading environmental compliance and engineering consultancy in Liberia. Providing specialized EPA permitting, monitoring audits, ESIA assessments, and regulatory advisory.
            </p>
            <div className="pt-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#1A4A3A] border border-[#D4AF37]/40 text-[#D4AF37] text-xs font-mono">
                <ShieldCheck className="w-3.5 h-3.5" />
                EPA Liberia Accredited Consultancy
              </span>
            </div>
          </div>

          {/* Column 2: Quick Links */}
          <div className="space-y-4">
            <h4 className="font-heading font-bold text-[#D4AF37] text-base tracking-wide uppercase border-b border-[#D4AF37]/30 pb-2 inline-block">
              Navigation
            </h4>
            <ul className="space-y-2.5 text-sm text-gray-300">
              <li>
                <Link to="/" className="hover:text-[#D4AF37] transition-colors flex items-center gap-1.5">
                  <ArrowRight className="w-3.5 h-3.5 text-[#D4AF37]" /> Home
                </Link>
              </li>
              <li>
                <Link to="/about" className="hover:text-[#D4AF37] transition-colors flex items-center gap-1.5">
                  <ArrowRight className="w-3.5 h-3.5 text-[#D4AF37]" /> About AEC
                </Link>
              </li>
              <li>
                <Link to="/services" className="hover:text-[#D4AF37] transition-colors flex items-center gap-1.5">
                  <ArrowRight className="w-3.5 h-3.5 text-[#D4AF37]" /> Consultancy Services
                </Link>
              </li>
              <li>
                <Link to="/projects" className="hover:text-[#D4AF37] transition-colors flex items-center gap-1.5">
                  <ArrowRight className="w-3.5 h-3.5 text-[#D4AF37]" /> Sector Portfolio
                </Link>
              </li>
              <li>
                <Link to="/check-status" className="hover:text-[#D4AF37] transition-colors flex items-center gap-1.5">
                  <ArrowRight className="w-3.5 h-3.5 text-[#D4AF37]" /> Public Permit Lookup
                </Link>
              </li>
              <li>
                <Link to="/contact" className="hover:text-[#D4AF37] transition-colors flex items-center gap-1.5">
                  <ArrowRight className="w-3.5 h-3.5 text-[#D4AF37]" /> Request Service
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Services */}
          <div className="space-y-4">
            <h4 className="font-heading font-bold text-[#D4AF37] text-base tracking-wide uppercase border-b border-[#D4AF37]/30 pb-2 inline-block">
              Specialized Services
            </h4>
            <ul className="space-y-2 text-sm text-gray-300">
              <li>Environmental Audit Reports</li>
              <li>Biannual & Quarterly Monitoring</li>
              <li>ESIA / EMP / EPB Studies</li>
              <li>Mining License Support</li>
              <li>Corrective Action Tracking</li>
              <li>Hazardous Waste & Effluent Audits</li>
            </ul>
          </div>

          {/* Column 4: Contact Info */}
          <div className="space-y-4">
            <h4 className="font-heading font-bold text-[#D4AF37] text-base tracking-wide uppercase border-b border-[#D4AF37]/30 pb-2 inline-block">
              Paynesville Headquarters
            </h4>
            <ul className="space-y-3 text-sm text-gray-300">
              <li className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-[#D4AF37] shrink-0 mt-0.5" />
                <span>72nd SKD Boulevard, Opposite Praise International Church Paynesville, Liberia</span>
              </li>
              <li className="flex items-center gap-3">
                <Phone className="w-4 h-4 text-[#D4AF37] shrink-0" />
                <span>+231 088 125 2254</span>
              </li>
              <li className="flex items-center gap-3">
                <MessageSquare className="w-4 h-4 text-[#D4AF37] shrink-0" />
                <span>WhatsApp: +231 077 530 1445</span>
              </li>
              <li className="flex items-center gap-3">
                <Mail className="w-4 h-4 text-[#D4AF37] shrink-0" />
                <span>info@ansumana.com</span>
              </li>
            </ul>

            <div className="pt-2">
              <Link
                to="/book"
                className="inline-block px-4 py-2 text-xs font-semibold rounded bg-[#D4AF37] text-[#0A2E24] hover:bg-[#E5C964] transition-colors"
              >
                Schedule Consultation
              </Link>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-gray-400 gap-4">
          <p>© {new Date().getFullYear()} Ansumana Environmental Consultancy Inc. All rights reserved.</p>
          <div className="flex items-center space-x-6">
            <span>Privacy Policy</span>
            <span>Terms of Service</span>
            <Link to="/login" className="text-[#D4AF37] hover:underline">
              Portal Sign In
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};
