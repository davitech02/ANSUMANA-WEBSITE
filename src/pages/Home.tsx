import React from 'react';
import { Link } from 'react-router-dom';
import {
  FileCheck2,
  Activity,
  FileText,
  Pickaxe,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Building2,
  Factory,
  Hotel,
  Boxes,
  Compass,
  TreePine,
  Layers,
  Award,
  Users,
  PhoneCall,
  Calendar,
  Lock,
  ChevronRight,
} from 'lucide-react';

export const Home: React.FC = () => {
  const services = [
    {
      title: 'Environmental Audit Reports',
      desc: 'Comprehensive facility & mine operational auditing required annually by EPA Liberia.',
      icon: FileCheck2,
      link: '/services#audit',
    },
    {
      title: 'Biannual & Quarterly Monitoring',
      desc: 'Regular field sampling of water, air, noise, and effluent discharge with digital reporting.',
      icon: Activity,
      link: '/services#monitoring',
    },
    {
      title: 'ESIA / EMP / EPB Studies',
      desc: 'Full Environmental and Social Impact Assessments and Management Plans for new projects.',
      icon: FileText,
      link: '/services#esia',
    },
    {
      title: 'Mining License Support',
      desc: 'End-to-end regulatory compliance and environmental documentation for mining licenses.',
      icon: Pickaxe,
      link: '/services#mining',
    },
  ];

  const reasons = [
    'EPA Liberia Accredited Lead Environmental Consultants',
    'Full-Cycle Environmental Permit Acquisition & Renewal Management',
    'Real-Time Compliance Tracking & Automatic 30/14/7-Day Reminder Engine',
    'Digital Corrective Action & Photo/Document Evidence Verification',
    'Multi-Sector Field Experience: Gold Mining, Aggregates, Ports, Industry & Eco-Resorts',
    'Dedicated Compliance Specialists in Monrovia, Paynesville, Buchanan & Gbarnga',
  ];

  const sectors = [
    { title: 'Gold Mining & Processing', icon: Pickaxe, count: '12+ Active Sites' },
    { title: 'Mining & Granite Quarrying', icon: Layers, count: '8 Sites' },
    { title: 'Cold Storage & Logistics', icon: Boxes, count: '6 Facilities' },
    { title: 'Hotels & Eco-Resorts', icon: Hotel, count: '15 Locations' },
    { title: 'Commercial Construction', icon: Building2, count: '20+ Projects' },
    { title: 'Industrial Factories', icon: Factory, count: '9 Plants' },
    { title: 'Sand Mining Operations', icon: Activity, count: '14 Dredges' },
    { title: 'Port Warehouses', icon: Boxes, count: '10 Hubs' },
    { title: 'Exploration Drilling', icon: Compass, count: '5 Concessions' },
    { title: 'Sustainable Forestry', icon: TreePine, count: '4 Reserves' },
  ];

  return (
    <div className="space-y-0">
      {/* HERO SECTION */}
      <section className="relative min-h-[90vh] flex items-center bg-[#0A2E24] text-white overflow-hidden pt-12 pb-20">
        {/* Background Image Overlay */}
        <div
          className="absolute inset-0 bg-cover bg-center opacity-25 mix-blend-overlay scale-105 transition-transform duration-1000"
          style={{
            backgroundImage:
              'url("https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=2000&q=80")',
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0A2E24] via-[#0A2E24]/90 to-transparent" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 w-full py-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#1A4A3A] border border-[#D4AF37]/50 shadow-inner">
                <ShieldCheck className="w-4 h-4 text-[#D4AF37]" />
                <span className="text-[#D4AF37] font-mono text-xs font-semibold tracking-widest uppercase">
                  Ansumana Environmental Consultancy Inc.
                </span>
              </div>

              <h1 className="font-heading font-extrabold text-3xl sm:text-5xl lg:text-6xl text-white tracking-tight leading-tight">
                Precision Stewardship for a{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#D4AF37] via-[#E5C964] to-[#D4AF37]">
                  Sustainable Future
                </span>
              </h1>

              <p className="text-gray-300 text-base sm:text-lg leading-relaxed max-w-2xl">
                Liberia’s premier environmental compliance advisory. We partner with project proponents to secure EPA environmental permits, conduct biannual monitoring audits, manage corrective findings, and guarantee environmental compliance.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <Link
                  to="/book"
                  className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#E5C964] text-[#0A2E24] font-heading font-bold text-sm sm:text-base hover:from-[#E5C964] hover:to-[#D4AF37] shadow-xl hover:shadow-[#D4AF37]/20 transition-all flex items-center justify-center gap-2 group"
                >
                  <PhoneCall className="w-4 h-4" />
                  Book a Call
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>

                <Link
                  to="/contact"
                  className="px-6 py-3.5 rounded-xl border-2 border-[#D4AF37] text-[#D4AF37] font-heading font-bold text-sm sm:text-base hover:bg-[#D4AF37]/10 transition-all flex items-center justify-center gap-2"
                >
                  <FileText className="w-4 h-4" />
                  Request Environmental Service
                </Link>
              </div>

              {/* Stats pill */}
              <div className="pt-8 border-t border-white/10 grid grid-cols-3 gap-4 text-center sm:text-left">
                <div>
                  <p className="font-heading font-extrabold text-2xl sm:text-3xl text-[#D4AF37]">100%</p>
                  <p className="text-xs text-gray-400 font-mono">EPA Approval Rate</p>
                </div>
                <div>
                  <p className="font-heading font-extrabold text-2xl sm:text-3xl text-white">85+</p>
                  <p className="text-xs text-gray-400 font-mono">Proponents Managed</p>
                </div>
                <div>
                  <p className="font-heading font-extrabold text-2xl sm:text-3xl text-[#D4AF37]">24/7</p>
                  <p className="text-xs text-gray-400 font-mono">Portal Reminders</p>
                </div>
              </div>
            </div>

            {/* Right Card: Live Public Status Quick Card */}
            <div className="lg:col-span-5">
              <div className="glass-card-dark p-6 sm:p-8 rounded-2xl shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-[#D4AF37]/10 rounded-full blur-2xl pointer-events-none" />
                <div className="flex items-center justify-between pb-4 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-[#D4AF37]" />
                    <span className="font-heading font-bold text-sm text-white">
                      Instant Permit Lookup
                    </span>
                  </div>
                  <span className="text-[10px] bg-[#1A4A3A] text-[#D4AF37] font-mono px-2 py-0.5 rounded">
                    Public Portal
                  </span>
                </div>

                <p className="text-xs text-gray-300 my-4 leading-relaxed">
                  Already a project proponent in Liberia? Check your EPA permit expiry and upcoming report submission schedule instantly.
                </p>

                <div className="space-y-3">
                  <Link
                    to="/check-status"
                    className="w-full py-3 px-4 rounded-xl bg-[#1A4A3A] hover:bg-[#2A6A52] text-white font-medium text-xs sm:text-sm flex items-center justify-between border border-[#D4AF37]/30 transition-all group"
                  >
                    <span className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-[#D4AF37]" /> Check EPA Permit Expiry
                    </span>
                    <ChevronRight className="w-4 h-4 text-[#D4AF37] group-hover:translate-x-1 transition-transform" />
                  </Link>

                  <Link
                    to="/login"
                    className="w-full py-3 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-gray-200 font-medium text-xs sm:text-sm flex items-center justify-between border border-white/10 transition-all group"
                  >
                    <span className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-[#D4AF37]" /> Client Portal Login
                    </span>
                    <ChevronRight className="w-4 h-4 text-gray-400 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </div>

                <div className="mt-6 pt-4 border-t border-white/10 flex items-center gap-3 text-[11px] text-gray-400">
                  <Award className="w-4 h-4 text-[#D4AF37] shrink-0" />
                  <span>Licensed under Liberia EPA Environmental Impact Assessment Regulations.</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SERVICES SUMMARY */}
      <section className="py-20 bg-[#F9FBF9]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <span className="text-[#D4AF37] font-mono text-xs tracking-widest uppercase font-bold">
              Core Technical Offerings
            </span>
            <h2 className="font-heading font-extrabold text-2xl sm:text-4xl text-[#0A2E24]">
              Liberia EPA Compliance Services
            </h2>
            <p className="text-gray-600 text-sm sm:text-base">
              End-to-end environmental consulting designed to keep your business operating in full compliance with EPA standards and national legislation.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {services.map((s, idx) => {
              const Icon = s.icon;
              return (
                <div
                  key={idx}
                  className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl hover:border-[#D4AF37]/50 transition-all duration-300 flex flex-col justify-between group"
                >
                  <div className="space-y-4">
                    <div className="w-12 h-12 rounded-xl bg-[#0A2E24] text-[#D4AF37] flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Icon className="w-6 h-6" />
                    </div>
                    <h3 className="font-heading font-bold text-lg text-[#0A2E24] group-hover:text-[#2A6A52] transition-colors">
                      {s.title}
                    </h3>
                    <p className="text-gray-600 text-xs sm:text-sm leading-relaxed">{s.desc}</p>
                  </div>
                  <div className="pt-6">
                    <Link
                      to="/services"
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0A2E24] group-hover:text-[#D4AF37] transition-colors"
                    >
                      Learn More <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="text-center pt-4">
            <Link
              to="/services"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#0A2E24] text-white font-heading font-bold text-sm hover:bg-[#1A4A3A] transition-colors shadow-md"
            >
              Explore All 10 Consulting Services
              <ArrowRight className="w-4 h-4 text-[#D4AF37]" />
            </Link>
          </div>
        </div>
      </section>

      {/* COMPLIANCE PORTAL PREVIEW */}
      <section className="py-20 bg-[#0A2E24] text-white relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 space-y-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-5 space-y-6">
              <span className="text-[#D4AF37] font-mono text-xs tracking-widest uppercase font-bold">
                Digital Compliance Portal
              </span>
              <h2 className="font-heading font-extrabold text-2xl sm:text-4xl text-white leading-tight">
                Real-Time Permit Tracking & Audit Reminders
              </h2>
              <p className="text-gray-300 text-sm sm:text-base leading-relaxed">
                AEC’s internal portal automatically calculates report deadlines, dispatches 30, 14, 7, and 1-day email & WhatsApp notifications, tracks non-compliance findings, and manages corrective action evidence uploads.
              </p>

              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-[#D4AF37] shrink-0 mt-0.5" />
                  <p className="text-xs sm:text-sm text-gray-200">
                    <strong>Proponent Dashboard:</strong> Clients view active permits, countdowns to audit due dates, and open findings in one unified dashboard.
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-[#D4AF37] shrink-0 mt-0.5" />
                  <p className="text-xs sm:text-sm text-gray-200">
                    <strong>Evidence Upload Workflow:</strong> Submit photo and PDF proof of corrected findings directly for AEC specialist verification.
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-[#D4AF37] shrink-0 mt-0.5" />
                  <p className="text-xs sm:text-sm text-gray-200">
                    <strong>Multi-Channel Alerts:</strong> Automated reminders sent via Email and WhatsApp to prevent costly EPA overdue fines.
                  </p>
                </div>
              </div>

              <div className="pt-4 flex flex-wrap gap-4">
                <Link
                  to="/login"
                  className="px-6 py-3 rounded-xl bg-[#D4AF37] text-[#0A2E24] font-heading font-bold text-sm hover:bg-[#E5C964] transition-colors shadow-lg"
                >
                  Access Client Portal
                </Link>
                <Link
                  to="/check-status"
                  className="px-6 py-3 rounded-xl border border-white/20 hover:border-[#D4AF37] text-white text-sm font-semibold transition-colors"
                >
                  Try Public Status Search
                </Link>
              </div>
            </div>

            {/* Visual Portal Mockup */}
            <div className="lg:col-span-7">
              <div className="glass-card-dark rounded-2xl p-6 border border-[#D4AF37]/30 shadow-2xl space-y-6">
                {/* Header Mock */}
                <div className="flex items-center justify-between pb-4 border-b border-white/10">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500" />
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                    <span className="text-xs font-mono text-gray-300 ml-2">aec-portal.ansumanaenv.com</span>
                  </div>
                  <span className="text-[10px] font-mono bg-[#D4AF37] text-[#0A2E24] px-2 py-0.5 rounded font-bold">
                    PREVIEW
                  </span>
                </div>

                {/* Simulated Portal Content */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-[#1A4A3A]/80 p-3 rounded-xl border border-white/5">
                    <p className="text-[10px] text-gray-300 font-mono">ACTIVE PERMITS</p>
                    <p className="text-xl font-bold text-white mt-1">4 Active</p>
                  </div>
                  <div className="bg-[#1A4A3A]/80 p-3 rounded-xl border border-white/5">
                    <p className="text-[10px] text-[#D4AF37] font-mono">NEXT DUE</p>
                    <p className="text-xl font-bold text-[#D4AF37] mt-1">14 Days</p>
                  </div>
                  <div className="bg-[#1A4A3A]/80 p-3 rounded-xl border border-white/5">
                    <p className="text-[10px] text-amber-300 font-mono">OPEN FINDINGS</p>
                    <p className="text-xl font-bold text-amber-300 mt-1">2 Pending</p>
                  </div>
                  <div className="bg-[#1A4A3A]/80 p-3 rounded-xl border border-white/5">
                    <p className="text-[10px] text-emerald-300 font-mono">VERIFIED</p>
                    <p className="text-xl font-bold text-emerald-300 mt-1">98%</p>
                  </div>
                </div>

                {/* Simulated Deadline Item */}
                <div className="bg-[#1A4A3A]/60 p-4 rounded-xl border border-[#D4AF37]/20 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-white">Biannual Monitoring Report Q2 2026</span>
                    <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono text-[10px]">
                      DUE IN 14 DAYS
                    </span>
                  </div>
                  <p className="text-xs text-gray-300">
                    Proponent: Liberia Gold Mining Ltd. • Permit: EPA-LR-MIN-2025-089
                  </p>
                  <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-[#D4AF37] h-full w-[70%]" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* WHY AEC */}
      <section className="py-20 bg-[#F9FBF9]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-6 relative">
              <div className="rounded-3xl overflow-hidden shadow-2xl border-4 border-white relative z-10">
                <img
                  src="https://images.unsplash.com/photo-1578575437130-527eed3abbec?auto=format&fit=crop&w=1200&q=80"
                  alt="AEC Environmental Field Inspection in Liberia"
                  className="w-full h-[450px] object-cover"
                />
              </div>
              <div className="absolute -bottom-6 -right-6 w-64 p-6 bg-[#0A2E24] text-white rounded-2xl shadow-xl z-20 border border-[#D4AF37]">
                <p className="font-heading font-bold text-2xl text-[#D4AF37]">15+ Years</p>
                <p className="text-xs text-gray-300">Combined Environmental Engineering Leadership in West Africa</p>
              </div>
            </div>

            <div className="lg:col-span-6 space-y-6">
              <span className="text-[#D4AF37] font-mono text-xs tracking-widest uppercase font-bold">
                Why Work With AEC
              </span>
              <h2 className="font-heading font-extrabold text-2xl sm:text-4xl text-[#0A2E24]">
                Trusted Partner for Regulatory Approval in Liberia
              </h2>
              <p className="text-gray-600 text-sm sm:text-base leading-relaxed">
                Navigating Environmental Protection Agency (EPA) Liberia regulations requires deep local expertise, rigorous sampling methodologies, and clear documentation. AEC delivers uncompromising quality.
              </p>

              <div className="space-y-3 pt-2">
                {reasons.map((r, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-[#D4AF37] shrink-0 mt-0.5" />
                    <span className="text-xs sm:text-sm text-gray-700 font-medium">{r}</span>
                  </div>
                ))}
              </div>

              <div className="pt-4">
                <Link
                  to="/about"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#0A2E24] text-white font-heading font-bold text-sm hover:bg-[#1A4A3A] transition-colors"
                >
                  Meet Our Lead Consultants
                  <ArrowRight className="w-4 h-4 text-[#D4AF37]" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PROJECT SECTORS */}
      <section className="py-20 bg-gray-50 border-t border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <span className="text-[#D4AF37] font-mono text-xs tracking-widest uppercase font-bold">
              Industries Served
            </span>
            <h2 className="font-heading font-extrabold text-2xl sm:text-4xl text-[#0A2E24]">
              Comprehensive Environmental Support Across All Sectors
            </h2>
            <p className="text-gray-600 text-sm sm:text-base">
              From heavy gold mining and aggregate quarrying to coastal hotel developments and commercial cold stores, AEC provides specialized compliance solutions tailored to each industry.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {sectors.map((sec, idx) => {
              const Icon = sec.icon;
              return (
                <Link
                  key={idx}
                  to="/projects"
                  className="bg-white p-5 rounded-xl border border-gray-200 hover:border-[#D4AF37] shadow-sm hover:shadow-md transition-all text-center group flex flex-col items-center space-y-2"
                >
                  <div className="w-10 h-10 rounded-lg bg-[#0A2E24]/5 group-hover:bg-[#0A2E24] text-[#0A2E24] group-hover:text-[#D4AF37] flex items-center justify-center transition-colors">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h4 className="font-heading font-bold text-xs sm:text-sm text-[#0A2E24] group-hover:text-[#2A6A52] transition-colors">
                    {sec.title}
                  </h4>
                  <span className="text-[10px] font-mono text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                    {sec.count}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="py-16 bg-[#0A2E24] text-white text-center relative overflow-hidden">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 space-y-6">
          <span className="text-[#D4AF37] font-mono text-xs tracking-widest uppercase font-bold">
            Get Compliant Today
          </span>
          <h2 className="font-heading font-extrabold text-3xl sm:text-5xl text-white">
            Need an Environmental Audit or EPA Permit Renewal?
          </h2>
          <p className="text-gray-300 text-sm sm:text-base max-w-2xl mx-auto leading-relaxed">
            Speak directly with AEC senior environmental advisors. Book a planning call or request an official proposal today.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4 pt-4">
            <Link
              to="/book"
              className="px-8 py-3.5 rounded-xl bg-[#D4AF37] text-[#0A2E24] font-heading font-bold text-base hover:bg-[#E5C964] transition-all shadow-lg flex items-center justify-center gap-2"
            >
              <Calendar className="w-4 h-4" /> Book a Consultation
            </Link>
            <Link
              to="/contact"
              className="px-8 py-3.5 rounded-xl border border-white/30 text-white font-heading font-bold text-base hover:bg-white/10 transition-all flex items-center justify-center gap-2"
            >
              <FileText className="w-4 h-4" /> Submit Service Request
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};
