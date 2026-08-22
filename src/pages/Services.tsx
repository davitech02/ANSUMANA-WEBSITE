import React from 'react';
import { Link } from 'react-router-dom';
import {
  FileCheck,
  Activity,
  FileText,
  Pickaxe,
  ShieldAlert,
  ClipboardList,
  Compass,
  Building,
  CheckCircle2,
  PhoneCall,
  ArrowRight,
  Layers,
  Award,
} from 'lucide-react';

export const Services: React.FC = () => {
  const servicesList = [
    {
      id: 'audit',
      title: 'Environmental Audit Report',
      bookingValue: 'Environmental audit planning session',
      requestValue: 'Environmental Audit Report',
      icon: FileCheck,
      desc: 'Annual statutory environmental performance audit required by EPA Liberia for active industrial, commercial, and mining facilities.',
      whoNeeds: 'Operating gold mines, quarries, factories, cold stores, ports, and commercial complexes with existing EPA permits.',
      aecSupport: [
        'On-site field inspections and discharge sampling',
        'Verification of Environmental Management Plan compliance',
        'Formal reporting and EPA Liberia board submission',
        'Issuance of official audit compliance endorsement',
      ],
    },
    {
      id: 'biannual',
      title: 'Biannual Monitoring Report',
      bookingValue: 'Biannual monitoring planning session',
      requestValue: 'Biannual Monitoring Report',
      icon: Activity,
      desc: 'Mandatory 6-month compliance monitoring evaluation tracking environmental parameters and community safety measures.',
      whoNeeds: 'Large-scale infrastructure projects, mining concessions, timber harvesting operations, and hotel resorts.',
      aecSupport: [
        'Biannual surface/groundwater laboratory testing',
        'Air particulate PM10 & ambient acoustic noise measurement',
        'Socio-economic community stakeholder interviews',
        'Compilation and upload to AEC compliance portal',
      ],
    },
    {
      id: 'quarterly',
      title: 'Quarterly Monitoring Report',
      bookingValue: 'Quarterly monitoring planning session',
      requestValue: 'Quarterly Monitoring Report',
      icon: ClipboardList,
      desc: 'Detailed 3-month periodic compliance tracking for high-impact industrial or mining operations.',
      whoNeeds: 'Gold processing plants, chemical storage, industrial factories, and coastal dredging operations.',
      aecSupport: [
        'Effluent water quality and heavy metal screening',
        'Hazardous waste disposal manifest audits',
        'Quarterly site findings and corrective action logs',
        'Direct EPA submission and compliance verification',
      ],
    },
    {
      id: 'esia',
      title: 'Environmental & Social Impact Assessment (ESIA)',
      bookingValue: 'ESIA/EMP/EPB consultation',
      requestValue: 'Environmental and Social Impact Assessment',
      icon: FileText,
      desc: 'Comprehensive multi-disciplinary baseline study evaluating physical, biological, and social impacts of proposed new developments.',
      whoNeeds: 'New mining concessions, road highways, power plants, large real estate projects, and marine ports.',
      aecSupport: [
        'Baseline ecological, hydrological, and soil surveys',
        'Public consultation workshops and stakeholder mapping',
        'Impact mitigation modeling and risk matrices',
        'EPA Public Hearing representation & approval support',
      ],
    },
    {
      id: 'emp',
      title: 'Environmental Management Plan (EMP)',
      bookingValue: 'ESIA/EMP/EPB consultation',
      requestValue: 'Environmental Management Plan',
      icon: Compass,
      desc: 'Operational framework outlining concrete mitigation measures, monitoring schedules, emergency response protocols, and budgets.',
      whoNeeds: 'All proponents applying for or renewing an EPA Environmental Impact License.',
      aecSupport: [
        'Customized mitigation matrices and responsible party matrices',
        'Waste management & spill containment protocols',
        'Mine site closure & land reclamation roadmaps',
        'Staff environmental health and safety (HSE) manual',
      ],
    },
    {
      id: 'epb',
      title: 'Environmental Project Brief (EPB)',
      bookingValue: 'ESIA/EMP/EPB consultation',
      requestValue: 'Environmental Project Brief',
      icon: Layers,
      desc: 'Streamlined preliminary environmental assessment for medium or low-risk commercial developments.',
      whoNeeds: 'Cold storage warehouses, small quarry sites, eco-lodges, agricultural processing sheds, and petrol stations.',
      aecSupport: [
        'Rapid site screening and baseline characterization',
        'Identification of key environmental triggers',
        'Preparation and submission of standard EPB dossier',
        'Expedited EPA environmental permit processing',
      ],
    },
    {
      id: 'mining',
      title: 'Mining License Support',
      bookingValue: 'Mining license support session',
      requestValue: 'Mining license support',
      icon: Pickaxe,
      desc: 'End-to-end regulatory environmental documentation for small-scale, large-scale, and artisanal mining license applications.',
      whoNeeds: 'Gold, diamond, bauxite, iron ore, and aggregate mining companies operating in Liberia.',
      aecSupport: [
        'National Minerals Agency (NMA) & EPA license alignment',
        'Mine tailings dam safety and water catchment design review',
        'Community Development Agreement (CDA) environmental inputs',
        'Permit renewal schedule management in AEC portal',
      ],
    },
    {
      id: 'advisory',
      title: 'Compliance Advisory & Legal Defense Support',
      bookingValue: 'Compliance review session',
      requestValue: 'Compliance advisory',
      icon: ShieldAlert,
      desc: 'Retainer consulting for ongoing regulatory guidance, EPA notice responses, and environmental dispute resolution.',
      whoNeeds: 'Corporate entities facing EPA compliance notices, legal scrutiny, or expansion permitting.',
      aecSupport: [
        'Direct representation during EPA site inspections',
        'Drafting official response letters and corrective commitments',
        'Regulatory gap analysis and risk mitigation',
        'Corporate ESG & international compliance alignment',
      ],
    },
    {
      id: 'monitoring',
      title: 'Environmental Field Monitoring (Water, Air, Noise)',
      bookingValue: 'Site visit planning call',
      requestValue: 'Environmental monitoring',
      icon: Activity,
      desc: 'Certified scientific sampling and laboratory analysis using calibrated field testing instruments.',
      whoNeeds: 'Any facility requiring independent environmental laboratory proof of compliance.',
      aecSupport: [
        'In-situ pH, turbidity, dissolved oxygen, and heavy metal testing',
        'Sound level acoustic decibel monitoring',
        'Dust deposition and gas emission screening',
        'Chain-of-custody laboratory certificates',
      ],
    },
    {
      id: 'corrective',
      title: 'Corrective Action Tracking & Evidence Review',
      bookingValue: 'Corrective action support session',
      requestValue: 'Corrective action tracking',
      icon: Award,
      desc: 'Digital finding management and evidence verification system ensuring non-compliance issues are fixed rapidly.',
      whoNeeds: 'All AEC managed proponents seeking seamless audit verification and clean regulatory records.',
      aecSupport: [
        'Detailed finding classification (Compliant, Observation, Minor, Major)',
        'Deadline setting and responsible party assignments',
        'Evidence photo & document review by AEC lead engineer',
        'Official verification certificate issuance',
      ],
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
              'url("https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=2000&q=80")',
          }}
        />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center space-y-4">
          <span className="text-[#D4AF37] font-mono text-xs tracking-widest uppercase font-bold">
            Ansumana Environmental Consultancy Inc.
          </span>
          <h1 className="font-heading font-extrabold text-3xl sm:text-5xl text-white">
            Comprehensive Environmental Services
          </h1>
          <p className="text-gray-300 text-sm sm:text-base max-w-3xl mx-auto leading-relaxed">
            From initial Environmental Impact Assessments to annual statutory EPA audits and real-time digital monitoring, explore our full spectrum of specialized consulting offerings in Liberia.
          </p>
        </div>
      </section>

      {/* SERVICES LIST */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {servicesList.map((service) => {
            const Icon = service.icon;
            return (
              <div
                key={service.id}
                id={service.id}
                className="bg-white p-6 sm:p-8 rounded-2xl border border-gray-200 shadow-sm hover:shadow-xl hover:border-[#D4AF37] transition-all flex flex-col justify-between space-y-6"
              >
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-[#0A2E24] text-[#D4AF37] flex items-center justify-center shrink-0">
                      <Icon className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-heading font-bold text-xl text-[#0A2E24]">
                        {service.title}
                      </h3>
                      <span className="text-[10px] font-mono text-[#2A6A52] bg-[#1A4A3A]/10 px-2 py-0.5 rounded font-semibold">
                        EPA Liberia Compliant
                      </span>
                    </div>
                  </div>

                  <p className="text-gray-700 text-xs sm:text-sm leading-relaxed">{service.desc}</p>

                  <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-2">
                    <p className="text-xs font-bold text-[#0A2E24] font-mono uppercase">
                      WHO NEEDS THIS SERVICE:
                    </p>
                    <p className="text-xs text-gray-600">{service.whoNeeds}</p>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-bold text-[#0A2E24] font-mono uppercase">
                      WHAT AEC DELIVERS:
                    </p>
                    <ul className="space-y-1.5">
                      {service.aecSupport.map((item, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
                          <CheckCircle2 className="w-4 h-4 text-[#D4AF37] shrink-0 mt-0.5" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* CTAs */}
                <div className="pt-4 border-t border-gray-100 flex flex-col sm:flex-row gap-3">
                  <Link
                    to={`/book?service=${encodeURIComponent(service.bookingValue)}`}
                    className="flex-1 py-2.5 px-4 rounded-lg bg-[#D4AF37] hover:bg-[#E5C964] text-[#0A2E24] font-heading font-bold text-xs text-center transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <PhoneCall className="w-3.5 h-3.5" /> Book a Session
                  </Link>

                  <Link
                    to={`/contact?service=${encodeURIComponent(service.requestValue)}`}
                    className="flex-1 py-2.5 px-4 rounded-lg bg-[#0A2E24] hover:bg-[#1A4A3A] text-white font-heading font-bold text-xs text-center transition-colors flex items-center justify-center gap-1.5"
                  >
                    Request This Service <ArrowRight className="w-3.5 h-3.5 text-[#D4AF37]" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* FINAL CONSULTATION BANNER */}
      <section className="bg-[#0A2E24] text-white py-12 text-center">
        <div className="max-w-4xl mx-auto px-4 space-y-4">
          <h2 className="font-heading font-bold text-2xl sm:text-3xl">Not Sure Which Permit or Assessment You Need?</h2>
          <p className="text-gray-300 text-sm">Our EPA advisory specialists will review your project parameters and map out your regulatory compliance roadmap.</p>
          <div className="pt-2">
            <Link
              to="/book"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#D4AF37] text-[#0A2E24] font-bold text-sm hover:bg-[#E5C964] transition-colors"
            >
              Book Free Consultation Call
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};
