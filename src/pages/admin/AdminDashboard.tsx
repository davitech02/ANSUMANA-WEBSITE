import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2,
  AlertTriangle,
  Clock,
  Calendar,
  Upload,
  MessageSquare,
  Download,
  ShieldCheck,
  Send,
  Activity,
  Loader2,
  AlertCircle,
  RefreshCw,
  Eye,
} from 'lucide-react';
import { adminApi, workflowsApi } from '../../lib/api';
import type {
  Booking,
  DashboardSummary,
  DashboardTrends,
  NotificationLog,
  ReminderRunSummary,
} from '../../types';
import { ComplianceStatsWidget } from '../../components/common/ComplianceStatsWidget';
import { ComplianceProgressChart } from '../../components/common/ComplianceProgressChart';

function errMsg(e: unknown): string {
  return e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : 'Request failed. Please try again.';
}

export const AdminDashboard: React.FC = () => {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [trends, setTrends] = useState<DashboardTrends | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<'findings' | 'schedules' | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [reminderRunning, setReminderRunning] = useState(false);
  const [dryRunRunning, setDryRunRunning] = useState(false);
  const [reminderResult, setReminderResult] = useState<ReminderRunSummary | null>(null);
  const [reminderError, setReminderError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sum, trend, bookingRes, logRes] = await Promise.all([
        workflowsApi.dashboardSummary(),
        workflowsApi.dashboardTrends({ granularity: 'month' }),
        adminApi.listBookings({ page: 1, per_page: 3 }),
        workflowsApi.listNotificationLogs({ page: 1, per_page: 3 }),
      ]);
      setSummary(sum);
      setTrends(trend);
      setBookings(bookingRes.items);
      setLogs(logRes.items);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Compute stat counts
  const totalProponents = summary?.proponents.total ?? 0;
  const overdueReports = summary?.schedules.overdue ?? 0;
  const due7Days = summary?.schedules.due_7 ?? 0;
  const due14Days = summary?.schedules.due_14 ?? 0;
  const due30Days = summary?.schedules.due_30 ?? 0;
  const openFindings = summary?.findings.open ?? 0;
  const pendingEvidence = summary?.evidence.pending_review ?? 0;
  const newRequests = summary?.service_requests.new ?? 0;

  // Compliance Progress Chart data — from monthly trend buckets
  const complianceProgressData = (trends?.buckets ?? []).map((b) => ({
    period: b.period,
    completed: b.completed,
    pending: b.pending,
    overdue: b.overdue,
  }));
  const totalProgress = (trends?.buckets ?? []).reduce((acc, b) => acc + b.total, 0);
  const completedProgress = (trends?.buckets ?? []).reduce((acc, b) => acc + b.completed, 0);

  const handleExportFindings = async () => {
    setExporting('findings');
    setExportError(null);
    try {
      await workflowsApi.downloadCsvExport('findings');
    } catch (e) {
      setExportError(errMsg(e));
    } finally {
      setExporting(null);
    }
  };

  const handleExportSchedules = async () => {
    setExporting('schedules');
    setExportError(null);
    try {
      await workflowsApi.downloadCsvExport('schedules');
    } catch (e) {
      setExportError(errMsg(e));
    } finally {
      setExporting(null);
    }
  };

  const handleRunReminders = async () => {
    setReminderRunning(true);
    setReminderError(null);
    try {
      const res = await workflowsApi.runReminders(false);
      setReminderResult(res);
    } catch (e) {
      setReminderError(errMsg(e));
    } finally {
      setReminderRunning(false);
    }
  };

  const handleDryRun = async () => {
    setDryRunRunning(true);
    setReminderError(null);
    try {
      const res = await workflowsApi.runReminders(true);
      setReminderResult(res);
    } catch (e) {
      setReminderError(errMsg(e));
    } finally {
      setDryRunRunning(false);
    }
  };

  return (
    <div className="space-y-8 font-sans">
      {/* Visual High-Impact Admin Header Banner */}
      <div className="bg-[#0A2E24] text-white p-6 sm:p-8 rounded-2xl shadow-xl relative overflow-hidden border border-[#D4AF37]/40">
        <div className="absolute -right-12 -top-12 w-64 h-64 bg-[#D4AF37]/10 rounded-full blur-2xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-[#D4AF37] text-[#0A2E24] font-mono font-bold text-[10px] uppercase flex items-center gap-1 shadow-xs">
                <ShieldCheck className="w-3 h-3" /> EPA LIBERIA CERTIFIED
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-900/80 text-emerald-300 font-mono text-[10px] flex items-center gap-1 border border-emerald-700/50">
                <Activity className="w-3 h-3 text-emerald-400" /> SYSTEM ACTIVE
              </span>
              <span className="text-gray-300 text-[10px] font-mono">
                Updated: {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} GMT
              </span>
            </div>

            <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-white">
              Environmental Compliance Command Center
            </h1>
            <p className="text-xs sm:text-sm text-gray-300 max-w-2xl leading-relaxed">
              Ansumana Environmental Consultancy Inc. • Real-Time EPA Statutory Audits, Proponent Management & Permit Compliance Monitor
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            <button
              onClick={handleExportFindings}
              disabled={exporting !== null}
              className="px-4 py-2.5 bg-gradient-to-r from-[#D4AF37] to-[#E5C964] text-[#0A2E24] font-heading font-bold text-xs rounded-xl shadow-md hover:from-[#E5C964] hover:to-[#D4AF37] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              {exporting === 'findings' ? 'Exporting...' : 'Export Findings CSV'}
            </button>
            <button
              onClick={handleExportSchedules}
              disabled={exporting !== null}
              className="px-4 py-2.5 bg-gradient-to-r from-[#D4AF37] to-[#E5C964] text-[#0A2E24] font-heading font-bold text-xs rounded-xl shadow-md hover:from-[#E5C964] hover:to-[#D4AF37] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              {exporting === 'schedules' ? 'Exporting...' : 'Export Schedules CSV'}
            </button>
          </div>
        </div>
      </div>

      {exportError && (
        <div className="bg-red-50 p-4 rounded-xl border border-red-200 text-red-700 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" /> {exportError}
        </div>
      )}

      {loading ? (
        <div className="bg-white p-10 rounded-2xl border border-gray-200 shadow-sm flex items-center justify-center gap-3">
          <Loader2 className="w-5 h-5 text-[#D4AF37] animate-spin" />
          <span className="text-xs font-bold text-gray-500">Loading dashboard data…</span>
        </div>
      ) : error ? (
        <div className="bg-red-50 p-4 rounded-xl border border-red-200 text-red-700 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      ) : (
        <>
          {/* High-Level Statutory Metrics Overview Widget */}
          <ComplianceStatsWidget
            totalActivePermits={summary?.permits.active ?? 0}
            totalPendingRenewalPermits={summary?.permits.pending_renewal ?? 0}
            totalExpiredPermits={summary?.permits.expired ?? 0}
            upcomingDeadlines={summary?.schedules.pending ?? 0}
            overdueDeadlines={summary?.schedules.overdue ?? 0}
            pendingFindings={summary?.findings.open ?? 0}
            highRiskFindings={summary?.findings.high_risk ?? 0}
            role="admin"
          />

          {/* 8 Stat Cards Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm border-t-4 border-t-[#0A2E24]">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-gray-500 font-bold uppercase">TOTAL PROPONENTS</span>
                <Building2 className="w-4 h-4 text-[#0A2E24]" />
              </div>
              <p className="font-heading font-extrabold text-2xl text-[#0A2E24] mt-2">{totalProponents}</p>
              <Link to="/admin/proponents" className="text-[10px] text-[#D4AF37] font-bold hover:underline block mt-1">
                Manage Proponents →
              </Link>
            </div>

            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm border-t-4 border-t-red-500">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-red-600 font-bold uppercase">OVERDUE REPORTS</span>
                <AlertTriangle className="w-4 h-4 text-red-500" />
              </div>
              <p className="font-heading font-extrabold text-2xl text-red-600 mt-2">{overdueReports}</p>
              <Link to="/admin/schedules" className="text-[10px] text-red-600 font-bold hover:underline block mt-1">
                View Overdue →
              </Link>
            </div>

            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm border-t-4 border-t-amber-500">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-amber-700 font-bold uppercase">DUE IN 7 DAYS</span>
                <Clock className="w-4 h-4 text-amber-500" />
              </div>
              <p className="font-heading font-extrabold text-2xl text-amber-600 mt-2">{due7Days}</p>
              <span className="text-[10px] text-gray-500 block mt-1">High priority</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm border-t-4 border-t-yellow-500">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-yellow-700 font-bold uppercase">DUE IN 14 DAYS</span>
                <Calendar className="w-4 h-4 text-yellow-600" />
              </div>
              <p className="font-heading font-extrabold text-2xl text-yellow-600 mt-2">{due14Days}</p>
              <span className="text-[10px] text-gray-500 block mt-1">Mid-range timeline</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm border-t-4 border-t-blue-500">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-blue-600 font-bold uppercase">DUE IN 30 DAYS</span>
                <Calendar className="w-4 h-4 text-blue-500" />
              </div>
              <p className="font-heading font-extrabold text-2xl text-blue-600 mt-2">{due30Days}</p>
              <span className="text-[10px] text-gray-500 block mt-1">Scheduled monitoring</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm border-t-4 border-t-[#D4AF37]">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-[#0A2E24] font-bold uppercase">OPEN FINDINGS</span>
                <AlertTriangle className="w-4 h-4 text-[#D4AF37]" />
              </div>
              <p className="font-heading font-extrabold text-2xl text-[#0A2E24] mt-2">{openFindings}</p>
              <Link to="/admin/findings" className="text-[10px] text-[#D4AF37] font-bold hover:underline block mt-1">
                Review Findings →
              </Link>
            </div>

            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm border-t-4 border-t-emerald-600">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-emerald-800 font-bold uppercase">EVIDENCE QUEUE</span>
                <Upload className="w-4 h-4 text-emerald-600" />
              </div>
              <p className="font-heading font-extrabold text-2xl text-emerald-700 mt-2">{pendingEvidence}</p>
              <Link to="/admin/evidence" className="text-[10px] text-emerald-700 font-bold hover:underline block mt-1">
                Inspect Evidence →
              </Link>
            </div>

            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm border-t-4 border-t-purple-600">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-purple-800 font-bold uppercase">NEW REQUESTS</span>
                <MessageSquare className="w-4 h-4 text-purple-600" />
              </div>
              <p className="font-heading font-extrabold text-2xl text-purple-700 mt-2">{newRequests}</p>
              <Link to="/admin/requests" className="text-[10px] text-purple-700 font-bold hover:underline block mt-1">
                View Enquiries →
              </Link>
            </div>
          </div>

          {/* Compliance Progress Tracker */}
          <ComplianceProgressChart
            title="Fleet-wide Compliance Progress Tracker"
            subtitle="Completed vs pending vs overdue statutory requirements per period"
            data={complianceProgressData}
            total={totalProgress}
            completedTotal={completedProgress}
          />

          {/* Main Panels Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left Column: Reminder Engine */}
            <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                <h3 className="font-heading font-bold text-base text-[#0A2E24] flex items-center gap-2">
                  <Send className="w-4 h-4 text-[#D4AF37]" /> Reminder Engine
                </h3>
              </div>
              <p className="text-[11px] text-gray-600">
                Dispatch automated report reminders for pending and overdue statutory deadlines, or preview eligibility with a dry run.
              </p>

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={handleRunReminders}
                  disabled={reminderRunning || dryRunRunning}
                  className="px-4 py-2.5 bg-[#0A2E24] hover:bg-[#1A4A3A] text-[#D4AF37] font-heading font-bold text-xs rounded-xl transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${reminderRunning ? 'animate-spin' : ''}`} />
                  {reminderRunning ? 'Running…' : 'Run Reminders'}
                </button>
                <button
                  onClick={handleDryRun}
                  disabled={reminderRunning || dryRunRunning}
                  className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-[#0A2E24] font-heading font-bold text-xs rounded-xl transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Eye className={`w-4 h-4 ${dryRunRunning ? 'animate-pulse' : ''}`} />
                  {dryRunRunning ? 'Previewing…' : 'Dry Run Preview'}
                </button>
              </div>

              {reminderError && (
                <div className="bg-red-50 p-3 rounded-xl border border-red-200 text-red-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" /> {reminderError}
                </div>
              )}

              {reminderResult && (
                <div className="bg-[#0A2E24] text-white p-4 rounded-xl border border-[#D4AF37]/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="font-heading font-bold text-sm">Reminder Run Summary</p>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                        reminderResult.dry_run ? 'bg-amber-400 text-amber-900' : 'bg-emerald-500 text-white'
                      }`}
                    >
                      {reminderResult.dry_run ? 'DRY RUN' : 'LIVE'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                    <div>
                      <p className="font-heading font-extrabold text-xl text-[#D4AF37]">{reminderResult.eligible}</p>
                      <p className="text-[10px] text-gray-400 font-mono uppercase">Eligible</p>
                    </div>
                    <div>
                      <p className="font-heading font-extrabold text-xl text-emerald-400">{reminderResult.sent}</p>
                      <p className="text-[10px] text-gray-400 font-mono uppercase">Sent</p>
                    </div>
                    <div>
                      <p className="font-heading font-extrabold text-xl text-red-400">{reminderResult.failed}</p>
                      <p className="text-[10px] text-gray-400 font-mono uppercase">Failed</p>
                    </div>
                    <div>
                      <p className="font-heading font-extrabold text-xl text-gray-200">{reminderResult.skipped}</p>
                      <p className="text-[10px] text-gray-400 font-mono uppercase">Skipped</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Recent Bookings & Notifications */}
            <div className="lg:col-span-5 space-y-6">
              {/* Recent Bookings */}
              <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                  <h3 className="font-heading font-bold text-base text-[#0A2E24] flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-[#D4AF37]" /> Recent Consultation Bookings
                  </h3>
                  <Link to="/admin/bookings" className="text-xs text-[#D4AF37] font-bold hover:underline">
                    View All →
                  </Link>
                </div>

                <div className="space-y-3">
                  {bookings.length === 0 ? (
                    <p className="text-[11px] text-gray-500 italic text-center py-4">No recent bookings.</p>
                  ) : (
                    bookings.map((book) => (
                      <div key={book.id} className="bg-gray-50 p-3.5 rounded-xl border border-gray-200 space-y-1 text-xs">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-[#0A2E24]">{book.full_name} ({book.company_name || '—'})</span>
                          <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-mono font-bold">
                            {book.booking_status}
                          </span>
                        </div>
                        <p className="text-gray-600 text-[11px]">{book.service_needed}</p>
                        <p className="text-gray-500 text-[10px] font-mono">{book.preferred_date} @ {book.preferred_time}</p>
                        <p className="text-gray-400 text-[10px] font-mono">Created: {new Date(book.created_at).toLocaleString()}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Recent Dispatched Alerts Log */}
              <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                  <h3 className="font-heading font-bold text-base text-[#0A2E24] flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-[#D4AF37]" /> Dispatched Reminder Engine Logs
                  </h3>
                  <Link to="/admin/email-logs" className="text-xs text-[#D4AF37] font-bold hover:underline">
                    View All Logs →
                  </Link>
                </div>

                <div className="space-y-2">
                  {logs.length === 0 ? (
                    <p className="text-[11px] text-gray-500 italic text-center py-4">No notification logs yet.</p>
                  ) : (
                    logs.map((log) => (
                      <div key={log.id} className="bg-gray-50 p-3 rounded-lg border border-gray-200 text-xs space-y-1">
                        <div className="flex justify-between items-center text-[10px] font-mono">
                          <span className="text-[#0A2E24] font-bold">{log.channel} • {log.notification_type}</span>
                          <span className="text-gray-500">{new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <p className="text-gray-700 text-[11px] truncate">{log.subject || '—'}</p>
                        <p className="text-gray-500 text-[10px] font-mono truncate">To: {log.recipient}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};