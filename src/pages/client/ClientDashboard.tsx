import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  FileCheck,
  AlertTriangle,
  Upload,
  Calendar,
  Building2,
  Clock,
  ShieldCheck,
  CheckCircle2,
  Download,
  Plus,
  Activity,
  Award,
  PhoneCall,
  Mail,
  Loader2,
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { useAuth } from '../../lib/AuthContext';
import { useTheme } from '../../lib/ThemeContext';
import { portalApi, saveDownload } from '../../lib/api';
import { PermitStatusBadge, ComplianceStatusBadge } from '../../components/common/StatusBadges';
import { ComplianceStatsWidget } from '../../components/common/ComplianceStatsWidget';
import { ComplianceProgressChart } from '../../components/common/ComplianceProgressChart';
import type { ClientEvidence, ClientFinding, ClientPermit, ReportSchedule } from '../../types';

function errMsg(e: unknown): string {
  return e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : 'Request failed. Please try again.';
}

export const ClientDashboard: React.FC = () => {
  const { proponent } = useAuth();
  const { theme } = useTheme();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [clientPermits, setClientPermits] = useState<ClientPermit[]>([]);
  const [clientSchedules, setClientSchedules] = useState<ReportSchedule[]>([]);
  const [clientFindings, setClientFindings] = useState<ClientFinding[]>([]);
  const [clientEvidence, setClientEvidence] = useState<ClientEvidence[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [permits, schedules, findings, evidence] = await Promise.all([
        portalApi.listClientPermits(),
        portalApi.listClientSchedules(),
        portalApi.listClientFindings(),
        portalApi.listClientEvidence(),
      ]);
      setClientPermits(permits.items);
      setClientSchedules(schedules.items);
      setClientFindings(findings.items);
      setClientEvidence(evidence.items);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handlePermitDownload = async (permitId: string) => {
    setDownloadingId(permitId);
    setDownloadError(null);
    try {
      await saveDownload(portalApi.clientPermitFileUrl(permitId));
    } catch (e) {
      setDownloadError(errMsg(e));
    } finally {
      setDownloadingId(null);
    }
  };

  // Compute Stats
  const activePermitsCount = clientPermits.filter((p) => p.permit_status === 'Active').length;
  const overdueSchedulesCount = clientSchedules.filter((s) => s.status === 'Overdue').length;
  const openFindingsCount = clientFindings.filter((f) => f.action_status !== 'Verified').length;
  const pendingEvidenceCount = clientEvidence.filter((e) => e.review_status === 'Pending review').length;

  // Chart 1 Data: Compliance Status Breakdown
  const compliantCount = clientFindings.filter((f) => f.compliance_status === 'Compliant').length;
  const nonCompliantCount = clientFindings.filter((f) => f.compliance_status === 'Non-compliant').length;
  const requiresImpCount = clientFindings.filter((f) => f.compliance_status === 'Requires improvement').length;

  const pieData = [
    { name: 'Compliant', value: compliantCount, color: '#059669' },
    { name: 'Non-Compliant', value: nonCompliantCount, color: '#DC2626' },
    { name: 'Requires Improvement', value: requiresImpCount, color: '#D97706' },
  ];

  // Chart 2 Data: Audit Schedules Status Breakdown (derived from actual schedules)
  const barData = [
    {
      period: 'All Periods',
      Completed: clientSchedules.filter((s) => s.status === 'Completed').length,
      Pending: clientSchedules.filter((s) => s.status === 'Pending').length,
      Overdue: clientSchedules.filter((s) => s.status === 'Overdue').length,
    },
  ];

  const dark = theme === 'dark';
  const axisColor = dark ? '#8FA99D' : '#64748b';
  const gridColor = dark ? '#2B4238' : '#e2e8f0';
  const tooltipStyle = {
    backgroundColor: dark ? '#14231E' : '#ffffff',
    border: `1px solid ${dark ? '#355046' : '#e2e8f0'}`,
    borderRadius: '0.75rem',
    fontSize: '11px',
  };

  // Compliance Progress Tracker Data
  const completedSchedules = clientSchedules.filter((s) => s.status === 'Completed').length;
  const pendingSchedules = clientSchedules.filter(
    (s) => s.status === 'Pending' || s.status === 'Submitted'
  ).length;
  const overdueSchedules = clientSchedules.filter((s) => s.status === 'Overdue').length;

  const complianceProgressData = [
    {
      period: 'My Reports',
      completed: completedSchedules,
      pending: pendingSchedules,
      overdue: overdueSchedules,
    },
  ];
  const totalProgress = completedSchedules + pendingSchedules + overdueSchedules;
  const completedProgress = completedSchedules;

  return (
    <div className="space-y-8 font-sans">
      {/* Top Welcome Header Banner */}
      <div className="bg-[#0A2E24] text-white p-6 sm:p-8 rounded-2xl shadow-xl relative overflow-hidden border border-[#D4AF37]/40">
        <div className="absolute -right-12 -top-12 w-64 h-64 bg-[#D4AF37]/10 rounded-full blur-2xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-[#D4AF37] text-[#0A2E24] font-mono font-bold text-[10px] uppercase flex items-center gap-1 shadow-xs">
                <Building2 className="w-3 h-3" /> PROPONENT PORTAL
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-900/80 text-emerald-300 font-mono text-[10px] flex items-center gap-1 border border-emerald-700/50">
                <Award className="w-3 h-3 text-emerald-400" /> EPA STANDING: GOOD & ACTIVE
              </span>
            </div>

            <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-white">
              Welcome, {proponent?.company_name || 'Proponent Company'}
            </h1>
            <p className="text-xs sm:text-sm text-gray-300 max-w-2xl leading-relaxed">
              Project Sector: <strong className="text-white">{proponent?.project_type}</strong> • Location: <strong className="text-white">{proponent?.district}, {proponent?.county}</strong> • Contact Person: <strong className="text-white">{proponent?.contact_person}</strong>
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            <Link
              to="/portal/support"
              className="px-4 py-2.5 bg-gradient-to-r from-[#D4AF37] to-[#E5C964] text-[#0A2E24] font-heading font-bold text-xs rounded-xl shadow-md hover:from-[#E5C964] hover:to-[#D4AF37] transition-all flex items-center justify-center gap-2"
            >
              <PhoneCall className="w-4 h-4" /> EPA Advisory Helpdesk
            </Link>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="bg-white p-12 rounded-2xl border border-gray-200 text-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-[#D4AF37] mx-auto" />
          <p className="text-sm font-bold text-[#0A2E24]">Loading your compliance dashboard...</p>
          <p className="text-xs text-gray-500">Fetching live permits, schedules, findings and evidence from AEC servers.</p>
        </div>
      ) : error ? (
        <div className="bg-rose-50 p-8 rounded-2xl border border-rose-200 text-center space-y-3">
          <AlertTriangle className="w-10 h-10 text-rose-600 mx-auto" />
          <p className="text-sm font-bold text-rose-800">Unable to load dashboard data</p>
          <p className="text-xs text-rose-600">{error}</p>
          <button
            onClick={loadData}
            className="px-4 py-2 bg-[#0A2E24] text-[#D4AF37] font-bold text-xs rounded-xl hover:bg-[#1A4A3A] transition-colors"
          >
            Retry
          </button>
        </div>
      ) : (
        <>
          {/* High-Level Statutory Metrics Overview Widget */}
          <ComplianceStatsWidget
            totalActivePermits={clientPermits.filter((p) => p.permit_status === 'Active').length}
            totalPendingRenewalPermits={clientPermits.filter((p) => p.permit_status === 'Pending Renewal').length}
            totalExpiredPermits={clientPermits.filter((p) => p.permit_status === 'Expired').length}
            upcomingDeadlines={clientSchedules.filter((s) => s.status === 'Pending').length}
            overdueDeadlines={clientSchedules.filter((s) => s.status === 'Overdue').length}
            pendingFindings={clientFindings.filter((f) => f.action_status === 'Open').length}
            highRiskFindings={clientFindings.filter((f) => f.risk_level === 'High').length}
            role="client"
          />

          {/* Stat Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm border-t-4 border-t-emerald-600">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-emerald-800 font-bold uppercase">ACTIVE EPA PERMITS</span>
                <FileCheck className="w-4 h-4 text-emerald-600" />
              </div>
              <p className="font-heading font-extrabold text-2xl text-[#0A2E24] mt-2">{activePermitsCount}</p>
              <Link to="/portal/permits" className="text-[10px] text-emerald-700 font-bold hover:underline block mt-1">
                View Permit Details →
              </Link>
            </div>

            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm border-t-4 border-t-red-500">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-red-600 font-bold uppercase">OVERDUE AUDITS</span>
                <AlertTriangle className="w-4 h-4 text-red-500" />
              </div>
              <p className="font-heading font-extrabold text-2xl text-red-600 mt-2">{overdueSchedulesCount}</p>
              <Link to="/portal/schedules" className="text-[10px] text-red-600 font-bold hover:underline block mt-1">
                View Schedule →
              </Link>
            </div>

            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm border-t-4 border-t-[#D4AF37]">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-[#0A2E24] font-bold uppercase">OPEN FINDINGS</span>
                <AlertTriangle className="w-4 h-4 text-[#D4AF37]" />
              </div>
              <p className="font-heading font-extrabold text-2xl text-[#0A2E24] mt-2">{openFindingsCount}</p>
              <Link to="/portal/findings" className="text-[10px] text-[#D4AF37] font-bold hover:underline block mt-1">
                View Findings →
              </Link>
            </div>

            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm border-t-4 border-t-blue-500">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-blue-600 font-bold uppercase">SUBMITTED EVIDENCE</span>
                <Upload className="w-4 h-4 text-blue-500" />
              </div>
              <p className="font-heading font-extrabold text-2xl text-blue-600 mt-2">{pendingEvidenceCount}</p>
              <Link to="/portal/evidence" className="text-[10px] text-blue-600 font-bold hover:underline block mt-1">
                Evidence Queue →
              </Link>
            </div>
          </div>

          {/* Quick Action Buttons Bar */}
          <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200 flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs font-mono font-bold text-[#0A2E24] uppercase">QUICK ACTIONS:</span>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                to="/portal/evidence"
                className="px-4 py-2 bg-[#0A2E24] hover:bg-[#1A4A3A] text-[#D4AF37] font-bold text-xs rounded-xl transition-all shadow-sm flex items-center gap-1.5"
              >
                <Upload className="w-3.5 h-3.5" /> Upload Corrective Action Evidence
              </Link>
              <Link
                to="/portal/book"
                className="px-4 py-2 bg-[#D4AF37] hover:bg-[#E5C964] text-[#0A2E24] font-bold text-xs rounded-xl transition-all shadow-sm flex items-center gap-1.5"
              >
                <Calendar className="w-3.5 h-3.5" /> Book Technical Review Call
              </Link>
            </div>
          </div>

          {/* Compliance Progress Tracker */}
          <ComplianceProgressChart
            title="My Compliance Progress Tracker"
            subtitle="Completed vs pending vs overdue statutory requirements"
            data={complianceProgressData}
            total={totalProgress}
            completedTotal={completedProgress}
          />

          {/* Visual Data Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Pie Chart: Compliance Breakdown */}
            <div className="lg:col-span-5 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
              <h3 className="font-heading font-bold text-base text-[#0A2E24]">
                Audit Findings Compliance Breakdown
              </h3>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '11px', color: dark ? '#C6D6CE' : '#334155' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Bar Chart: Statutory Report Deadlines */}
            <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
              <h3 className="font-heading font-bold text-base text-[#0A2E24]">
                Statutory Audit Submissions Progress
              </h3>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData}>
                    <XAxis dataKey="period" tick={{ fontSize: 11, fill: axisColor }} />
                    <YAxis tick={{ fontSize: 11, fill: axisColor }} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: '11px', color: dark ? '#C6D6CE' : '#334155' }} />
                    <Bar dataKey="Completed" fill="#059669" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Pending" fill="#D97706" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Overdue" fill="#DC2626" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Active Permit Overview & Pending Deadlines Table */}
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="font-heading font-bold text-base text-[#0A2E24]">
                Active EPA Permits & Mining Licenses
              </h3>
              <Link to="/portal/permits" className="text-xs text-[#D4AF37] font-bold hover:underline">
                View All Permits →
              </Link>
            </div>

            {downloadError && (
              <p className="text-xs text-rose-600 font-bold">{downloadError}</p>
            )}

            <div className="space-y-3">
              {clientPermits.length === 0 ? (
                <p className="text-xs text-gray-500 italic">No permits registered under this proponent profile.</p>
              ) : (
                clientPermits.map((p) => (
                  <div
                    key={p.id}
                    className="bg-gray-50 p-4 rounded-xl border border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <span className="font-mono text-[10px] text-gray-500 font-bold uppercase">{p.permit_type}</span>
                      <p className="font-heading font-bold text-[#0A2E24] text-sm">{p.permit_number}</p>
                      <p className="text-gray-600 text-[11px]">Valid Until: {p.expiry_date}</p>
                    </div>

                    <div className="flex items-center gap-3">
                      <PermitStatusBadge status={p.permit_status} />
                      {p.has_file ? (
                        <button
                          onClick={() => handlePermitDownload(p.id)}
                          disabled={downloadingId === p.id}
                          className="px-3 py-1.5 bg-[#0A2E24] text-[#D4AF37] font-bold text-xs rounded-lg hover:bg-[#1A4A3A] flex items-center gap-1 disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          {downloadingId === p.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Download className="w-3.5 h-3.5" />
                          )} PDF Certificate
                        </button>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};