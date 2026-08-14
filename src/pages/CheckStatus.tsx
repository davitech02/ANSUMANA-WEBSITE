import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, ShieldCheck, Calendar, AlertCircle, FileCheck, CheckCircle2, Clock, Lock } from 'lucide-react';
import { Permit, ReportSchedule } from '../types';
import { getStorageData } from '../lib/storage';

export const CheckStatus: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searched, setSearched] = useState(false);
  const [matchingPermits, setMatchingPermits] = useState<Permit[]>([]);
  const [matchingSchedules, setMatchingSchedules] = useState<ReportSchedule[]>([]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;

    const data = getStorageData();
    const term = searchTerm.trim().toLowerCase();

    // Search permits by permit_number or proponent_name or email match
    const foundPermits = data.permits.filter((p) => {
      const matchNumber = p.permit_number.toLowerCase().includes(term);
      const matchName = p.proponent_name.toLowerCase().includes(term);
      // find proponent email
      const prop = data.proponents.find((pr) => pr.id === p.proponent_id);
      const matchEmail = prop?.email.toLowerCase().includes(term);
      return matchNumber || matchName || matchEmail;
    });

    const permitIds = foundPermits.map((p) => p.id);
    const proponentIds = foundPermits.map((p) => p.proponent_id);

    const foundSchedules = data.schedules.filter((s) => {
      return (
        (s.permit_id && permitIds.includes(s.permit_id)) ||
        proponentIds.includes(s.proponent_id) ||
        s.proponent_name.toLowerCase().includes(term)
      );
    });

    setMatchingPermits(foundPermits);
    setMatchingSchedules(foundSchedules);
    setSearched(true);
  };

  const getDaysRemaining = (expiryDateStr: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const exp = new Date(expiryDateStr);
    const diffTime = exp.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  return (
    <div className="space-y-12 py-10">
      {/* HERO BANNER */}
      <section className="bg-[#0A2E24] text-white py-14 relative overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-20"
          style={{
            backgroundImage:
              'url("https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=2000&q=80")',
          }}
        />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#1A4A3A] border border-[#D4AF37]/40 text-[#D4AF37] text-xs font-mono">
            <Lock className="w-3.5 h-3.5" /> Public Unauthenticated Permit Search
          </div>
          <h1 className="font-heading font-extrabold text-3xl sm:text-5xl text-white">
            Check EPA Permit & Report Status
          </h1>
          <p className="text-gray-300 text-sm sm:text-base max-w-2xl mx-auto leading-relaxed">
            Enter your EPA Permit Number (e.g. <code className="text-[#D4AF37] font-mono">EPA-LR-MIN-2025-089</code>) or Proponent Email to instantly verify active permit validity and upcoming statutory audit report deadlines.
          </p>
        </div>
      </section>

      {/* SEARCH BAR CONTAINER */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white p-6 sm:p-8 rounded-2xl border border-gray-200 shadow-lg space-y-6">
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-5 h-5 text-gray-400 absolute left-3.5 top-3" />
              <input
                type="text"
                required
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Enter Permit Number or Company Email..."
                className="w-full pl-11 pr-4 py-2.5 text-xs sm:text-sm rounded-xl border border-gray-300 focus:outline-none focus:border-[#D4AF37]"
              />
            </div>
            <button
              type="submit"
              className="px-6 py-2.5 bg-[#0A2E24] hover:bg-[#1A4A3A] text-[#D4AF37] font-heading font-bold text-xs sm:text-sm rounded-xl transition-colors shadow-md flex items-center justify-center gap-2"
            >
              <Search className="w-4 h-4" /> Check Status
            </button>
          </form>

          {/* Quick Demo Pre-fill hints */}
          <div className="pt-2 border-t border-gray-100 flex flex-wrap items-center gap-2 text-xs text-gray-500">
            <span className="font-mono text-[10px] text-gray-400">TRY DEMO SEARCH:</span>
            <button
              onClick={() => {
                setSearchTerm('EPA-LR-MIN-2025-089');
              }}
              className="px-2 py-1 bg-gray-100 hover:bg-[#D4AF37]/20 text-[#0A2E24] font-mono text-[11px] rounded transition-colors"
            >
              EPA-LR-MIN-2025-089
            </button>
            <button
              onClick={() => {
                setSearchTerm('compliance@liberiagold.lr');
              }}
              className="px-2 py-1 bg-gray-100 hover:bg-[#D4AF37]/20 text-[#0A2E24] font-mono text-[11px] rounded transition-colors"
            >
              compliance@liberiagold.lr
            </button>
            <button
              onClick={() => {
                setSearchTerm('EPA-LR-ML-2024-112');
              }}
              className="px-2 py-1 bg-gray-100 hover:bg-[#D4AF37]/20 text-[#0A2E24] font-mono text-[11px] rounded transition-colors"
            >
              EPA-LR-ML-2024-112
            </button>
          </div>
        </div>
      </section>

      {/* RESULTS DISPLAY */}
      {searched && (
        <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 animate-fadeIn">
          {matchingPermits.length === 0 ? (
            <div className="bg-white p-8 rounded-2xl border border-gray-200 text-center space-y-4">
              <AlertCircle className="w-12 h-12 text-amber-500 mx-auto" />
              <h3 className="font-heading font-bold text-xl text-[#0A2E24]">
                No Matching Permit Records Found
              </h3>
              <p className="text-xs sm:text-sm text-gray-600 max-w-md mx-auto">
                We could not locate any active EPA permit matching "<strong className="text-[#0A2E24]">{searchTerm}</strong>". Please verify the permit number or contact AEC support.
              </p>
              <div className="pt-2">
                <Link
                  to="/contact"
                  className="inline-block px-5 py-2 bg-[#0A2E24] text-[#D4AF37] font-bold text-xs rounded-lg"
                >
                  Contact AEC Compliance Desk
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <h2 className="font-heading font-bold text-xl text-[#0A2E24] flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[#D4AF37]" /> Verified EPA Permit Records ({matchingPermits.length})
              </h2>

              {matchingPermits.map((permit) => {
                const daysLeft = getDaysRemaining(permit.expiry_date);
                const isExpired = daysLeft < 0;
                const isWarning = daysLeft <= 30;

                return (
                  <div
                    key={permit.id}
                    className="bg-white p-6 rounded-2xl border border-gray-200 shadow-md space-y-6 border-l-4 border-l-[#D4AF37]"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-gray-100">
                      <div>
                        <span className="text-[10px] font-mono text-gray-500 uppercase">PROPONENT COMPANY</span>
                        <h3 className="font-heading font-bold text-lg text-[#0A2E24]">
                          {permit.proponent_name}
                        </h3>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-mono font-bold ${
                            permit.permit_status === 'Active'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : 'bg-amber-100 text-amber-800 border border-amber-300'
                          }`}
                        >
                          STATUS: {permit.permit_status.toUpperCase()}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                      <div className="bg-gray-50 p-3 rounded-xl border border-gray-200">
                        <span className="text-gray-500 font-mono text-[10px]">PERMIT NUMBER</span>
                        <p className="font-bold text-[#0A2E24] mt-0.5">{permit.permit_number}</p>
                      </div>

                      <div className="bg-gray-50 p-3 rounded-xl border border-gray-200">
                        <span className="text-gray-500 font-mono text-[10px]">PERMIT TYPE</span>
                        <p className="font-bold text-[#0A2E24] mt-0.5">{permit.permit_type}</p>
                      </div>

                      <div className="bg-gray-50 p-3 rounded-xl border border-gray-200">
                        <span className="text-gray-500 font-mono text-[10px]">EXPIRY DATE</span>
                        <p className="font-bold text-[#0A2E24] mt-0.5">{permit.expiry_date}</p>
                      </div>

                      <div className="bg-gray-50 p-3 rounded-xl border border-gray-200">
                        <span className="text-gray-500 font-mono text-[10px]">VALIDITY COUNTDOWN</span>
                        <p
                          className={`font-bold mt-0.5 ${
                            isExpired
                              ? 'text-red-600'
                              : isWarning
                              ? 'text-amber-600'
                              : 'text-emerald-700'
                          }`}
                        >
                          {isExpired ? 'Expired' : `${daysLeft} Days Remaining`}
                        </p>
                      </div>
                    </div>

                    {/* Associated Report Schedules */}
                    <div className="space-y-3 pt-2">
                      <h4 className="font-heading font-bold text-xs uppercase text-[#0A2E24] font-mono">
                        UPCOMING STATUTORY REPORT DEADLINES
                      </h4>

                      {matchingSchedules.filter((s) => s.proponent_id === permit.proponent_id).length === 0 ? (
                        <p className="text-xs text-gray-500 italic">No pending report schedules found for this permit.</p>
                      ) : (
                        <div className="space-y-2">
                          {matchingSchedules
                            .filter((s) => s.proponent_id === permit.proponent_id)
                            .map((sched) => (
                              <div
                                key={sched.id}
                                className="bg-gray-50 p-3.5 rounded-xl border border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                              >
                                <div>
                                  <p className="font-bold text-xs text-[#0A2E24]">{sched.report_type}</p>
                                  <p className="text-[11px] text-gray-600">{sched.reporting_period}</p>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="text-xs font-mono text-gray-700">
                                    Due: <strong>{sched.due_date}</strong>
                                  </span>
                                  <span
                                    className={`px-2.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                                      sched.status === 'Overdue'
                                        ? 'bg-red-100 text-red-700'
                                        : 'bg-amber-100 text-amber-700'
                                    }`}
                                  >
                                    {sched.status}
                                  </span>
                                </div>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>

                    {/* Action CTA */}
                    <div className="pt-2 flex justify-end gap-3 border-t border-gray-100">
                      <Link
                        to="/login"
                        className="px-4 py-2 bg-[#0A2E24] text-[#D4AF37] font-bold text-xs rounded-lg hover:bg-[#1A4A3A]"
                      >
                        Sign In to Client Portal to Upload Evidence
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}
    </div>
  );
};
