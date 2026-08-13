import React from 'react';
import { Link } from 'react-router-dom';
import { FileCheck, CalendarClock, AlertTriangle, ArrowRight, ShieldCheck, Clock, ShieldAlert } from 'lucide-react';
import { PermitStatusBadge, ComplianceStatusBadge } from './StatusBadges';

interface HighLevelStatsProps {
  totalActivePermits: number;
  totalPendingRenewalPermits?: number;
  totalExpiredPermits?: number;
  
  upcomingDeadlines: number;
  overdueDeadlines?: number;
  
  pendingFindings: number;
  highRiskFindings?: number;
  
  role: 'admin' | 'client';
}

export const ComplianceStatsWidget: React.FC<HighLevelStatsProps> = ({
  totalActivePermits,
  totalPendingRenewalPermits = 0,
  totalExpiredPermits = 0,
  upcomingDeadlines,
  overdueDeadlines = 0,
  pendingFindings,
  highRiskFindings = 0,
  role,
}) => {
  const permitsLink = role === 'admin' ? '/admin/permits' : '/portal/permits';
  const schedulesLink = role === 'admin' ? '/admin/schedules' : '/portal/schedules';
  const findingsLink = role === 'admin' ? '/admin/findings' : '/portal/findings';

  return (
    <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-md space-y-4 font-sans">
      <div className="flex items-center justify-between border-b border-gray-100 pb-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-[#D4AF37]" />
          <h2 className="font-heading font-extrabold text-base text-[#0A2E24]">
            High-Level Statutory Metrics Overview
          </h2>
        </div>
        <span className="text-[10px] font-mono text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md font-bold">
          LIVE AUDIT STATUS
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Card 1: Active Permits */}
        <div className="bg-emerald-50/60 p-5 rounded-2xl border border-emerald-200/80 space-y-3 relative overflow-hidden group hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-sm">
              <FileCheck className="w-5 h-5" />
            </div>
            <PermitStatusBadge status="Active" size="sm" />
          </div>

          <div>
            <span className="text-3xl font-heading font-extrabold text-[#0A2E24] block">
              {totalActivePermits}
            </span>
            <p className="text-xs font-bold text-emerald-900 mt-0.5">Total Active EPA Permits</p>
          </div>

          <div className="pt-2 border-t border-emerald-200/60 flex items-center justify-between text-[11px] text-emerald-800 font-mono">
            <span>Expired / Pending: <strong>{totalExpiredPermits + totalPendingRenewalPermits}</strong></span>
            <Link
              to={permitsLink}
              className="font-bold hover:underline inline-flex items-center gap-1 text-[#0A2E24] group-hover:translate-x-0.5 transition-transform"
            >
              View Permits <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* Card 2: Upcoming Deadlines */}
        <div className="bg-amber-50/60 p-5 rounded-2xl border border-amber-200/80 space-y-3 relative overflow-hidden group hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-amber-600 text-white flex items-center justify-center shadow-sm">
              <CalendarClock className="w-5 h-5" />
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-200 text-amber-900 border border-amber-300">
              AUDIT SCHEDULES
            </span>
          </div>

          <div>
            <span className="text-3xl font-heading font-extrabold text-[#0A2E24] block">
              {upcomingDeadlines}
            </span>
            <p className="text-xs font-bold text-amber-900 mt-0.5">Upcoming Schedule Deadlines</p>
          </div>

          <div className="pt-2 border-t border-amber-200/60 flex items-center justify-between text-[11px] text-amber-800 font-mono">
            <span>Overdue Submissions: <strong className="text-red-700">{overdueDeadlines}</strong></span>
            <Link
              to={schedulesLink}
              className="font-bold hover:underline inline-flex items-center gap-1 text-[#0A2E24] group-hover:translate-x-0.5 transition-transform"
            >
              View Deadlines <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* Card 3: Pending Findings */}
        <div className="bg-rose-50/60 p-5 rounded-2xl border border-rose-200/80 space-y-3 relative overflow-hidden group hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center shadow-sm">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-rose-200 text-rose-900 border border-rose-300">
              OPEN FINDINGS
            </span>
          </div>

          <div>
            <span className="text-3xl font-heading font-extrabold text-[#0A2E24] block">
              {pendingFindings}
            </span>
            <p className="text-xs font-bold text-rose-900 mt-0.5">Pending Action Findings</p>
          </div>

          <div className="pt-2 border-t border-rose-200/60 flex items-center justify-between text-[11px] text-rose-800 font-mono">
            <span>High Risk Issues: <strong className="text-red-800">{highRiskFindings}</strong></span>
            <Link
              to={findingsLink}
              className="font-bold hover:underline inline-flex items-center gap-1 text-[#0A2E24] group-hover:translate-x-0.5 transition-transform"
            >
              View Findings <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
