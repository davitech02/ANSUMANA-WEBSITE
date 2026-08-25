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
      subTitle: 'EPA Liberia Compliance Service',
      bookingValue: 'Environmental audit planning session',
      requestValue: 'Environmental Audit Report',
      icon: FileCheck,
      desc: 'A detailed assessment of an operating facility or project to determine its level of compliance with environmental permit conditions, approved management measures, and applicable EPA requirements.',
      whoNeeds: 'Operating mines, quarries, factories, cold stores, hotels, petroleum facilities, ports, construction projects, and other EPA-permitted operations requiring an environmental compliance review or permit renewal.',
      aecSupport: [
        'On-site environmental inspection and operational assessment',
        'Review of EPA permit conditions, EMP/ESMP commitments, and environmental records',
        'Environmental sampling coordination where applicable',
        'Compliance gap assessment and corrective action plan',
        'Complete Environmental Audit Report and EPA submission support',
      ],
    },
    {
      id: 'biannual',
      title: 'Biannual Monitoring Report',
      subTitle: 'EPA Environmental Compliance Reporting',
      bookingValue: 'Biannual monitoring planning session',
      requestValue: 'Biannual Monitoring Report',
      icon: Activity,
      desc: 'A six-month environmental performance report that documents how a project is implementing its environmental management measures and complying with its EPA permit conditions.',
      whoNeeds: 'EPA-permitted facilities and projects whose permit conditions or reporting schedule require environmental monitoring every six months.',
      aecSupport: [
        'Six-month site inspection and environmental performance review',
        'Assessment of EMP/ESMP implementation',
        'Review of waste, safety, environmental, and operational records',
        'Environmental monitoring and laboratory data review',
        'Complete Biannual Monitoring Report for EPA submission',
      ],
    },
    {
      id: 'quarterly',
      title: 'Quarterly Monitoring Report',
      subTitle: 'EPA Periodic Compliance Monitoring',
      bookingValue: 'Quarterly monitoring planning session',
      requestValue: 'Quarterly Monitoring Report',
      icon: ClipboardList,
      desc: 'A three-month environmental monitoring report used to document operational conditions, environmental performance, permit compliance, and implementation of required mitigation measures.',
      whoNeeds: 'Mining operations, industrial facilities, construction projects, and other permit holders required by their EPA permit or regulatory conditions to report quarterly.',
      aecSupport: [
        'Quarterly environmental site inspection',
        'Compliance assessment against permit and EMP/ESMP requirements',
        'Review of environmental incidents, waste management, and corrective actions',
        'Environmental sampling and monitoring results, where applicable',
        'Complete Quarterly Monitoring Report for regulatory submission',
      ],
    },
    {
      id: 'esia',
      title: 'Environmental & Social Impact Assessment (ESIA)',
      subTitle: 'Pre-Development Environmental Assessment',
      bookingValue: 'ESIA/EMP/EPB consultation',
      requestValue: 'Environmental and Social Impact Assessment',
      icon: FileText,
      desc: 'A comprehensive environmental and social study for proposed projects that may cause significant environmental or social impacts and require detailed assessment before development begins.',
      whoNeeds: 'Large mining projects, industrial developments, major infrastructure, energy projects, large agricultural developments, ports, processing facilities, and other projects screened by the EPA for a full ESIA.',
      aecSupport: [
        'Project screening, scoping, and baseline environmental studies',
        'Environmental and social field assessments',
        'Stakeholder and community consultations',
        'Impact identification, mitigation measures, and alternatives analysis',
        'ESMP development and complete ESIA documentation for EPA review',
      ],
    },
    {
      id: 'emp',
      title: 'Environmental Management Plan (EMP)',
      subTitle: 'Environmental Management & Mitigation Planning',
      bookingValue: 'ESIA/EMP/EPB consultation',
      requestValue: 'Environmental Management Plan',
      icon: Compass,
      desc: 'A practical management document that identifies project impacts and sets out the measures, responsibilities, monitoring requirements, and resources needed to manage them.',
      whoNeeds: 'New or existing businesses, industrial facilities, mining operations, construction projects, hotels, cold storage facilities, petroleum facilities, and other developments that require an environmental management framework.',
      aecSupport: [
        'Identification of environmental and social risks',
        'Project-specific mitigation and management measures',
        'Environmental monitoring indicators and responsibilities',
        'Waste, pollution, health, safety, and emergency management measures',
        'Implementation schedule and compliance monitoring framework',
      ],
    },
    {
      id: 'epb',
      title: 'Environmental Project Brief (EPB)',
      subTitle: 'EPA Project Screening & Permitting Support',
      bookingValue: 'ESIA/EMP/EPB consultation',
      requestValue: 'Environmental Project Brief',
      icon: Layers,
      desc: 'An Environmental Project Brief provides the EPA with key information on a proposed project, its location, activities, potential impacts, baseline conditions, and planned environmental management measures.',
      whoNeeds: 'Developers and businesses establishing new projects or expanding existing operations that have been directed through the EPA screening process to prepare an Environmental Project Brief.',
      aecSupport: [
        'Project description and site assessment',
        'Environmental and social baseline assessment',
        'Stakeholder consultation and supporting documentation',
        'Impact assessment and mitigation measures',
        'Environmental Management Plan and complete EPB submission package',
      ],
    },
    {
      id: 'mining',
      title: 'Mining License Support',
      subTitle: 'Ministry of Mines & Energy Regulatory Support',
      bookingValue: 'Mining license support session',
      requestValue: 'Mining license support',
      icon: Pickaxe,
      desc: 'AEC assists mining companies, cooperatives, and investors with the environmental, technical, mapping, and documentation requirements that support applications to the Ministry of Mines and Energy and the EPA.',
      whoNeeds: 'Mining cooperatives, Class C miners, companies pursuing Class B or Class A mining licenses, quarry operators, and investors preparing to enter Liberia\'s mining sector.',
      aecSupport: [
        'Mining license application documentation support',
        'Site coordinates, GIS maps, and production-area documentation',
        'Work plan and environmental documentation support',
        'EPA environmental permitting coordination',
        'Compliance follow-up with applicable mining and environmental requirements',
      ],
    },
    {
      id: 'advisory',
      title: 'Compliance Advisory & Legal Defense Support',
      subTitle: 'Regulatory & Technical Compliance Support',
      bookingValue: 'Compliance review session',
      requestValue: 'Compliance advisory',
      icon: ShieldAlert,
      desc: 'AEC provides environmental technical support to businesses responding to EPA inspections, compliance notices, environmental complaints, enforcement matters, and other regulatory concerns.',
      whoNeeds: 'Companies facing EPA inspections, notices of violation, environmental complaints, permit disputes, compliance investigations, penalties, or regulatory proceedings.',
      aecSupport: [
        'Technical review of inspection findings and alleged non-compliance',
        'Environmental records and evidence assessment',
        'Corrective action and compliance response preparation',
        'Technical reports and supporting environmental evidence',
        'Environmental technical support to management and licensed legal counsel during regulatory matters',
      ],
    },
    {
      id: 'advisory',
      title: 'Resettlement Action Plans – RAPs',
      subTitle: 'Social Safeguards & Resettlement Planning',
      bookingValue: 'Resettlement Action Plans ',
      requestValue: 'Resettlement Action Plans – RAPs',
      icon: ShieldAlert,
      desc: 'A Resettlement Action Plan establishes how a project will manage land acquisition, displacement, livelihood impacts, compensation, relocation, and engagement with project-affected persons.',
      whoNeeds: 'Mining, infrastructure, energy, road, industrial, agricultural, and other projects that may cause physical displacement, economic displacement, loss of assets, or restrictions on access to land and resources.',
      aecSupport: [
        'Identification and assessment of project-affected persons',
        'Socio-economic surveys and asset inventory support',
        'Stakeholder consultation and grievance planning',
        'Compensation, livelihood restoration, and resettlement planning',
        'RAP implementation and monitoring framework',
      ],
    },
    {
      id: 'monitoring',
      title: 'Environmental Field Monitoring (Water, Air, Noise)',
      subTitle: 'Water • Air • Noise • Soil Monitoring',
      bookingValue: 'Site visit planning call',
      requestValue: 'Environmental monitoring',
      icon: Activity,
      desc: 'AEC coordinates environmental field monitoring with qualified analytical laboratories to provide reliable environmental data for permitting, audits, monitoring reports, baseline studies, and compliance assessments.',
      whoNeeds: 'Mining companies, factories, petroleum facilities, construction projects, hotels, cold stores, processing plants, agricultural operations, and other facilities requiring environmental monitoring data.',
      aecSupport: [
        'Surface water, groundwater, and wastewater sampling',
        'Ambient air quality and emission monitoring coordination',
        'Environmental and occupational noise monitoring',
        'Soil and sediment sampling',
        'Laboratory analysis coordination, results interpretation, and integration into environmental reports',
      ],
    },
    {
      id: 'corrective',
      title: 'Corrective Action Tracking & Evidence Review',
      subTitle: 'Post-Inspection Compliance Management',
      bookingValue: 'Corrective action support session',
      requestValue: 'Corrective action tracking',
      icon: Award,
      desc: 'AEC helps clients document, track, and close environmental findings identified during audits, EPA inspections, monitoring exercises, internal reviews, or other compliance assessments.',
      whoNeeds: 'Companies with outstanding EPA observations, audit findings, permit conditions, inspection findings, environmental incidents, or corrective actions requiring documented closure.',
      aecSupport: [
        'Corrective action register and compliance tracking',
        'Review of photographs, receipts, records, laboratory results, and other evidence',
        'Evidence photo & document review by AEC lead engineer',
        'Preparation of close-out evidence and regulatory response documentation',
        'Verification of completed environmental corrective measures',
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
              'url("https://images.unsplash.com/photo-1787614537789-3f16d6d10807?q=80&w=3132&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D")',
          }}
        />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center space-y-4">
          <span className="text-[#D4AF37] font-mono text-xs tracking-widest uppercase font-bold">
            Ansumana Environmental Consultancy Inc.
          </span>
          <h1 className="font-heading font-extrabold text-3xl sm:text-5xl text-white">
            Comprehensive Environmental Services
          </h1>
          {/* <p className="text-gray-300 text-sm sm:text-base max-w-3xl mx-auto leading-relaxed">
            From initial Environmental Impact Assessments to annual statutory EPA audits and real-time digital monitoring, explore our full spectrum of specialized consulting offerings in Liberia.
          </p> */}
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
                        {service.subTitle}
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
          <h2 className="font-heading font-bold text-2xl sm:text-3xl">Not Sure Which Service You Need?</h2>
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
