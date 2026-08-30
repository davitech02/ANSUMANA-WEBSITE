import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Award, Users, Target, CheckCircle2, PhoneCall, ArrowRight, MapPin, Compass } from 'lucide-react';

export const About: React.FC = () => {
  const leadership = [
    {
      name: 'Mr. Charles S. Dagoseh Sr.',
      role: 'CEO- Ansumana Environmental Consultancy Inc. Mining Engineer | Rock Mechanics Specialist | EPA-Accredited Environmental Consultant',
      bio: 'A Mining Engineer, Rock Mechanics Specialist, and Environmental Consultant with over 22 years of practical and professional experience in the mining, environmental, and natural resources sectors.He earned his Bachelor of Science degree from the University of Liberia in 1980 and obtained professional training and certification from the Colorado School of Mines, USA, in 1979.',
      image: 'https://images.unsplash.com/photo-1788121167108-c02cad584864?q=80&w=3234&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
    },
    {
      name: 'Charles S. Dagoseh Jr.',
      role: 'General Manager Environmental Consultant | ESIA Evaluator, BBA In Management | M.Sc. Candidate in Environmental Science',
      bio: 'A Certified Environmental Consultant and ESIA Evaluator with 8 years of practical experience in environmental assessment, environmental auditing, compliance monitoring, environmental management planning, field inspections, regulatory reporting, and environmental permitting support.',
      image: 'https://images.unsplash.com/photo-1788121081777-0898b62b5251?q=80&w=2244&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
    },
    {
      name: 'CLLR. URIAS S. GOLL',
      role: 'Director, Legal & Environmental Affairs, Counsellor-at-Law | Environmental & Natural Resources Specialist',
      bio: ' A Liberian lawyer, environmental specialist, and natural resources management practitioner with over 18 years of professional experience spanning environmental and natural resources law, environmental policy, regulatory compliance, project management, conservation, sustainable resource management, and institutional governance.',
      image: 'https://images.unsplash.com/photo-1788120549906-9bc4f2a86bcf?q=80&w=2244&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
    },
    {
      name: 'CHARLENE H. DAGOSEH-SUAH, MPH, MS',
      role: 'Director, Environmental Health, WASH & Social Safeguards',
      bio: ' Charlene H. Dagoseh-Suah, MPH, MS is a Public Health, Epidemiology, Sanitation and WASH professional with multidisciplinary training in biology, public health, sanitation, and gender-responsive development planning.',
      image: 'https://images.unsplash.com/photo-1788121167117-5ccd4d3b2287?q=80&w=2244&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
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
            Regulatory Compliance In Liberia
          </h1>
          <p className="text-gray-300 text-sm sm:text-base max-w-3xl mx-auto leading-relaxed">
            Ansumana Environmental Consultancy Inc. was founded to address the growing need for practical, professional environmental and Mining consulting services in Liberia. We have been operational for over 12 years, and we understand the challenges businesses face in obtaining mining licenses and complying with Mining and Environmental regulations.

            We help our clients achieve and maintain regulatory compliance by applying our professional judgment, local knowledge, and international standards, and by delivering solutions that enable effective operations throughout the project life cycle. Today, we're proud to be a trusted partner for businesses across multiple sectors, providing audits, impact assessments, monitoring reports, and training that support regulatory compliance and genuine environmental stewardship.
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
              To provide accessible, practical consulting services that help Liberian businesses operate responsibly and meet regulatory requirements.
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
                Our Compliance Approach
              </h2>
              <p className="text-gray-600 text-sm sm:text-base leading-relaxed">
                AEC maintains direct technical familiarity with Liberia Environmental Protection and Management Law, Mineral and Mining Law, forestry laws, and international IFC Performance Standards.
              </p>

              <div className="space-y-3 pt-2">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-[#D4AF37] shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-sm text-[#0A2E24]">Accredited EPA Lead Environmental Consultants</h4>
                    <p className="text-xs text-gray-600">Authorized to submit environmental reports directly to the EPA and Mines and Energy.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-[#D4AF37] shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-sm text-[#0A2E24]">Partnership with Certified Laboratories and other Industry Experts</h4>
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
                  <p className="text-[11px] text-gray-400 mt-2">Across Liberia</p>
                </div>
                <div className="bg-[#1A4A3A] text-white p-6 rounded-2xl shadow-md border border-[#D4AF37]/30">
                  <p className="font-heading font-extrabold text-3xl text-white">120+</p>
                  <p className="text-xs text-[#D4AF37] font-mono mt-1">REPORTS FILED</p>
                  <p className="text-[11px] text-gray-300 mt-2">EPA Audits, Biannual & Quarterly Reports, Technical Workplan and Budget, Annual Audits, RAPs, EMPs</p>
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
            Meet Our Management
          </h2>
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
          <h2 className="font-heading font-bold text-2xl sm:text-3xl">Partner with AEC’s Team</h2>
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
