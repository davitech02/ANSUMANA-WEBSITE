import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Award, Users, Target, CheckCircle2, PhoneCall, ArrowRight, MapPin, Compass } from 'lucide-react';

export const About: React.FC = () => {
  const leadership = [
    {
      name: 'Dr. Ansumana Kamara',
      role: 'Founder & Principal Environmental Specialist',
      bio: 'Ph.D. in Environmental Engineering with over 18 years of advisory experience with EPA Liberia, mining conglomerates, and international infrastructure projects.',
      image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80',
    },
    {
      name: 'Ing. Mohamed Bangura',
      role: 'Lead EIA & Mining Compliance Engineer',
      bio: 'Former EPA Senior Inspector specializing in mine tailings management, effluent discharge analysis, and ESIA environmental management plans.',
      image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=600&q=80',
    },
    {
      name: 'Fatu Jalloh-Sankoh',
      role: 'Head of Monitoring & Field GIS Analytics',
      bio: 'Expert in satellite spatial mapping, water quality sampling, and biodiversity impact monitoring across Liberia coastal and inland ecosystems.',
      image: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=600&q=80',
    },
  ];

  return (
    <div className="space-y-16 py-10">
      {/* HERO BANNER */}
      <section className="bg-[#0A2E24] text-white py-16 relative overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-20"
          style={{
            backgroundImage:
              'url("https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=2000&q=80")',
          }}
        />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center space-y-4">
          <span className="text-[#D4AF37] font-mono text-xs tracking-widest uppercase font-bold">
            About Ansumana Environmental Consultancy Inc.
          </span>
          <h1 className="font-heading font-extrabold text-3xl sm:text-5xl text-white">
            Pioneering Environmental Compliance in Liberia
          </h1>
          <p className="text-gray-300 text-sm sm:text-base max-w-3xl mx-auto leading-relaxed">
            Founded with a vision to bridge industrial development and ecological conservation, AEC provides accredited environmental consulting, EPA licensing, and digital compliance tracking for proponents nationwide.
          </p>
        </div>
      </section>

      {/* MISSION & VISION */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-white p-8 rounded-2xl border border-gray-200 shadow-sm space-y-4 border-t-4 border-t-[#D4AF37]">
            <div className="w-12 h-12 rounded-xl bg-[#0A2E24] text-[#D4AF37] flex items-center justify-center">
              <Target className="w-6 h-6" />
            </div>
            <h3 className="font-heading font-bold text-xl text-[#0A2E24]">Our Mission</h3>
            <p className="text-gray-600 text-sm sm:text-base leading-relaxed">
              To empower commercial proponents and industrial operators across Liberia with rigorous, transparent, and actionable environmental compliance solutions. We ensure smooth regulatory approvals while safeguarding local air, water, and soil ecosystems.
            </p>
          </div>

          <div className="bg-white p-8 rounded-2xl border border-gray-200 shadow-sm space-y-4 border-t-4 border-t-[#0A2E24]">
            <div className="w-12 h-12 rounded-xl bg-[#1A4A3A] text-[#D4AF37] flex items-center justify-center">
              <Compass className="w-6 h-6" />
            </div>
            <h3 className="font-heading font-bold text-xl text-[#0A2E24]">Our Vision</h3>
            <p className="text-gray-600 text-sm sm:text-base leading-relaxed">
              To be West Africa’s most trusted environmental consultancy firm, setting national benchmarks for environmental impact assessments, automated audit reminder engines, and proactive environmental stewardship.
            </p>
          </div>
        </div>
      </section>

      {/* CONSULTING EXPERIENCE & VALUES */}
      <section className="bg-gray-50 py-16 border-t border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-6 space-y-6">
              <span className="text-[#D4AF37] font-mono text-xs tracking-widest uppercase font-bold">
                Proven Track Record
              </span>
              <h2 className="font-heading font-extrabold text-2xl sm:text-4xl text-[#0A2E24]">
                Deep Institutional & Regulatory Expertise
              </h2>
              <p className="text-gray-600 text-sm sm:text-base leading-relaxed">
                AEC maintains direct technical familiarity with Liberia Environmental Protection Agency Act regulations, mining codes, forestry laws, and international IFC Performance Standards.
              </p>

              <div className="space-y-3 pt-2">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-[#D4AF37] shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-sm text-[#0A2E24]">Accredited EPA Lead Environmental Consultants</h4>
                    <p className="text-xs text-gray-600">Authorized to submit EIA, ESIA, and EPB reports directly to the EPA Board.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-[#D4AF37] shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-sm text-[#0A2E24]">Field Equipment & Certified Laboratories</h4>
                    <p className="text-xs text-gray-600">Equipped for water turbidity, heavy metal testing, particulate PM10 dust, and acoustic noise sampling.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-[#D4AF37] shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-sm text-[#0A2E24]">Digital Compliance Portal Infrastructure</h4>
                    <p className="text-xs text-gray-600">Pioneered Liberia’s first automated compliance reminder and evidence review portal.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#0A2E24] text-white p-6 rounded-2xl shadow-md border border-[#D4AF37]/30">
                  <p className="font-heading font-extrabold text-3xl text-[#D4AF37]">85+</p>
                  <p className="text-xs text-gray-300 font-mono mt-1">PROPONENTS SERVED</p>
                  <p className="text-[11px] text-gray-400 mt-2">Across Montserrado, Nimba, Grand Bassa & Margibi Counties</p>
                </div>
                <div className="bg-[#1A4A3A] text-white p-6 rounded-2xl shadow-md border border-[#D4AF37]/30">
                  <p className="font-heading font-extrabold text-3xl text-white">120+</p>
                  <p className="text-xs text-[#D4AF37] font-mono mt-1">REPORTS FILED</p>
                  <p className="text-[11px] text-gray-300 mt-2">EPA Audits, Biannual & Quarterly Reports</p>
                </div>
                <div className="bg-[#1A4A3A] text-white p-6 rounded-2xl shadow-md border border-[#D4AF37]/30">
                  <p className="font-heading font-extrabold text-3xl text-white">100%</p>
                  <p className="text-xs text-[#D4AF37] font-mono mt-1">COMPLIANCE RATE</p>
                  <p className="text-[11px] text-gray-300 mt-2">Zero EPA permit suspensions for managed clients</p>
                </div>
                <div className="bg-[#0A2E24] text-white p-6 rounded-2xl shadow-md border border-[#D4AF37]/30">
                  <p className="font-heading font-extrabold text-3xl text-[#D4AF37]">10</p>
                  <p className="text-xs text-gray-300 font-mono mt-1">SECTOR SPECIALTIES</p>
                  <p className="text-[11px] text-gray-400 mt-2">From gold mining to hospitality & ports</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* LEADERSHIP TEAM */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="text-center max-w-3xl mx-auto space-y-2">
          <span className="text-[#D4AF37] font-mono text-xs tracking-widest uppercase font-bold">
            Leadership Team
          </span>
          <h2 className="font-heading font-extrabold text-2xl sm:text-4xl text-[#0A2E24]">
            Expert Consultants Behind AEC
          </h2>
          <p className="text-gray-600 text-sm">
            Our multi-disciplinary team brings senior environmental engineering, hydro-geology, legal advisory, and field GIS experience.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {leadership.map((member, idx) => (
            <div key={idx} className="bg-white rounded-2xl overflow-hidden border border-gray-200 shadow-sm hover:shadow-lg transition-all group">
              <div className="h-64 overflow-hidden relative">
                <img
                  src={member.image}
                  alt={member.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0A2E24] via-transparent to-transparent opacity-80" />
                <div className="absolute bottom-4 left-4 right-4 text-white">
                  <h3 className="font-heading font-bold text-lg leading-tight">{member.name}</h3>
                  <p className="text-xs text-[#D4AF37] font-mono mt-0.5">{member.role}</p>
                </div>
              </div>
              <div className="p-6">
                <p className="text-gray-600 text-xs sm:text-sm leading-relaxed">{member.bio}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-[#0A2E24] text-white py-12 text-center">
        <div className="max-w-4xl mx-auto px-4 space-y-4">
          <h2 className="font-heading font-bold text-2xl sm:text-3xl">Partner with Liberia’s Premier Compliance Team</h2>
          <p className="text-gray-300 text-sm">Speak with our environmental specialists to arrange a site evaluation or report planning session.</p>
          <div className="pt-2">
            <Link
              to="/book"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#D4AF37] text-[#0A2E24] font-bold text-sm hover:bg-[#E5C964] transition-colors"
            >
              <PhoneCall className="w-4 h-4" /> Schedule Advisory Session
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};
