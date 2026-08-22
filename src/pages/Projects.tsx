import React from 'react';
import { Link } from 'react-router-dom';
import { Pickaxe, Layers, Boxes, Hotel, Building2, Factory, Activity, Compass, TreePine, ArrowRight, ShieldCheck, PhoneCall } from 'lucide-react';

export const Projects: React.FC = () => {
  const categories = [
    {
      title: 'Mining & Quarry Projects',
      bookingValue: 'Mining license support session',
      icon: Layers,
      count: '8 Concessions',
      image: 'https://images.unsplash.com/photo-1578575437130-527eed3abbec?auto=format&fit=crop&w=800&q=80',
      desc: 'Granite aggregate crushing, stone quarrying, and rock extraction projects requiring EPA impact assessment and dust containment management.',
    },
    {
      title: 'Gold Mining & Processing',
      bookingValue: 'Mining license support session',
      icon: Pickaxe,
      count: '12 Active Sites',
      image: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80',
      desc: 'Artisanal and medium-scale open pit gold mining operations with tailings dam monitoring, cyanide safety protocols, and river siltation audits.',
    },
    {
      title: 'Cold Storage & Logistics',
      bookingValue: 'Site visit planning call',
      icon: Boxes,
      count: '6 Port Facilities',
      image: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=800&q=80',
      desc: 'Industrial ammonia refrigeration cold stores, seafood export terminals, and marine container yards in Monrovia Port Area.',
    },
    {
      title: 'Hotels & Eco-Resorts',
      bookingValue: 'Compliance review session',
      icon: Hotel,
      count: '15 Locations',
      image: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=800&q=80',
      desc: 'Coastal luxury hotels, eco-lodges, and beach resorts needing wastewater treatment plant audits, coastal erosion protection, and EPBs.',
    },
    {
      title: 'Commercial Construction',
      bookingValue: 'Site visit planning call',
      icon: Building2,
      count: '20+ Developments',
      image: 'https://images.unsplash.com/photo-1541888946425-d0fbb186a5b7?auto=format&fit=crop&w=800&q=80',
      desc: 'Multi-story office towers, shopping malls, housing estates, and road infrastructure projects across Monrovia, Paynesville, and Buchanan.',
    },
    {
      title: 'Industrial Factories',
      bookingValue: 'Compliance review session',
      icon: Factory,
      count: '9 Industrial Plants',
      image: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=800&q=80',
      desc: 'Beverage bottling plants, cement grinding mills, plastic manufacturing, and food processing plants with stack gas & effluent monitoring.',
    },
    {
      title: 'Sand Mining Operations',
      bookingValue: 'Mining license support session',
      icon: Activity,
      count: '14 Riverbed Sites',
      image: 'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?auto=format&fit=crop&w=800&q=80',
      desc: 'Organized riverbed sand dredging and coastal sand extraction operations regulated under EPA environmental project briefs.',
    },
    {
      title: 'Port Warehouses',
      bookingValue: 'Compliance review session',
      icon: Boxes,
      count: '10 Logistics Hubs',
      image: 'https://images.unsplash.com/photo-1553413077-190dd305871c?auto=format&fit=crop&w=800&q=80',
      desc: 'Customs bonded warehouses, fuel storage depots, and bulk material logistics hubs requiring hazardous waste management permits.',
    },
    {
      title: 'Exploration Drilling',
      bookingValue: 'Mining license support session',
      icon: Compass,
      count: '5 Prospecting Zones',
      image: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=800&q=80',
      desc: 'Mineral exploration concessions conducting core drilling, trenching, and environmental baseline studies in Nimba & Grand Bassa Counties.',
    },
    {
      title: 'Sustainable Logging & Forestry',
      bookingValue: 'Report planning session',
      icon: TreePine,
      count: '4 Timber Reserves',
      image: 'https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=800&q=80',
      desc: 'Forestry concessions with timber harvesting management plans, reforestation commitments, and biodiversity conservation zones.',
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
              'url("https://images.unsplash.com/photo-1578575437130-527eed3abbec?auto=format&fit=crop&w=2000&q=80")',
          }}
        />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center space-y-4">
          <span className="text-[#D4AF37] font-mono text-xs tracking-widest uppercase font-bold">
            Experience Across Liberia
          </span>
          <h1 className="font-heading font-extrabold text-3xl sm:text-5xl text-white">
            Sector Portfolio & Client Experience
          </h1>
          <p className="text-gray-300 text-sm sm:text-base max-w-3xl mx-auto leading-relaxed">
            AEC has successfully delivered EPA permit approvals, biannual monitoring, and environmental audits across major economic sectors in Liberia without compromising client confidentiality.
          </p>
        </div>
      </section>

      {/* PROJECT CATEGORIES GRID */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {categories.map((cat, idx) => {
            const Icon = cat.icon;
            return (
              <div
                key={idx}
                className="bg-white rounded-2xl overflow-hidden border border-gray-200 shadow-sm hover:shadow-xl hover:border-[#D4AF37] transition-all flex flex-col justify-between group"
              >
                <div>
                  <div className="h-48 overflow-hidden relative">
                    <img
                      src={cat.image}
                      alt={cat.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0A2E24] via-transparent to-transparent opacity-80" />
                    <div className="absolute top-3 right-3 bg-[#0A2E24]/90 text-[#D4AF37] border border-[#D4AF37]/40 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold shadow">
                      {cat.count}
                    </div>
                    <div className="absolute bottom-3 left-3 flex items-center gap-2 text-white">
                      <div className="w-8 h-8 rounded-lg bg-[#D4AF37] text-[#0A2E24] flex items-center justify-center font-bold shadow">
                        <Icon className="w-4 h-4" />
                      </div>
                      <h3 className="font-heading font-bold text-base">{cat.title}</h3>
                    </div>
                  </div>

                  <div className="p-6">
                    <p className="text-gray-600 text-xs sm:text-sm leading-relaxed">{cat.desc}</p>
                  </div>
                </div>

                <div className="p-6 pt-0 border-t border-gray-100 mt-auto">
                  <Link
                    to={`/book?service=${encodeURIComponent(cat.bookingValue)}`}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0A2E24] group-hover:text-[#D4AF37] transition-colors"
                  >
                    Discuss Your {cat.title} Project <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="bg-[#0A2E24] text-white py-12 text-center">
        <div className="max-w-4xl mx-auto px-4 space-y-4">
          <h2 className="font-heading font-bold text-2xl sm:text-3xl">Planning an Environmental Assessment in Your Sector?</h2>
          <p className="text-gray-300 text-sm">Consult directly with our lead environmental engineers to map your project requirements.</p>
          <div className="pt-2">
            <Link
              to="/book"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#D4AF37] text-[#0A2E24] font-bold text-sm hover:bg-[#E5C964] transition-colors"
            >
              <PhoneCall className="w-4 h-4" /> Book Sector Planning Call
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};
