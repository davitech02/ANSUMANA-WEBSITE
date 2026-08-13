import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2,
  AlertTriangle,
  Clock,
  Calendar,
  Upload,
  MessageSquare,
  Download,
  CheckCircle2,
  ShieldCheck,
  Send,
  FileCheck,
  Activity,
  Award,
} from 'lucide-react';
import { getStorageData } from '../../lib/storage';
import { exportToCSV } from '../../lib/exportUtils';
import { sendEmailNotification } from '../../lib/notifications';
import { PermitStatusBadge, ActionStatusBadge } from '../../components/common/StatusBadges';
import { ComplianceStatsWidget } from '../../components/common/ComplianceStatsWidget';
import { DateRangeFilter, DateRange } from '../../components/common/DateRangeFilter';

export const AdminDashboard: React.FC = () => {
  const [data, setData] = useState(() => getStorageData());
  const [dateRange, setDateRange] = useState<DateRange | null>(null);

  useEffect(() => {
    const handleUpdate = () => setData(getStorageData());
    window.addEventListener('aec_storage_updated', handleUpdate);
    return () => window.removeEventListener('aec_storage_updated', handleUpdate);
  }, []);

  // Compute stat counts
  const totalProponents = data.proponents.length;
  const overdueReports = data.schedules.filter((s) => s.status === 'Overdue').length;

  const getDaysDiff = (dateStr: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const d = new Date(dateStr);
    return Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

  const due7Days = data.schedules.filter((s) => {
    const diff = getDaysDiff(s.due_date);
    return diff >= 0 && diff <= 7 && s.status !== 'Completed';
  }).length;

  const due14Days = data.schedules.filter((s) => {
    const diff = getDaysDiff(s.due_date);
    return diff >= 0 && diff <= 14 && s.status !== 'Completed';
  }).length;

  const due30Days = data.schedules.filter((s) => {
    const diff = getDaysDiff(s.due_date);
    return diff >= 0 && diff <= 30 && s.status !== 'Completed';
  }).length;

  const openFindings = data.findings.filter((f) => f.action_status !== 'Verified').length;
  const pendingEvidence = data.evidence.filter((e) => e.review_status === 'Pending review').length;
  const newRequests = data.requests.filter((r) => r.status === 'New').length;

  const handleExportData = () => {
    // Export Findings CSV
    exportToCSV('AEC_Compliance_Findings_Report', data.findings, [
      { key: 'proponent_name', header: 'Proponent Name' },
      { key: 'finding_title', header: 'Finding Title' },
      { key: 'inspection_area', header: 'Inspection Area' },
      { key: 'compliance_status', header: 'Compliance Status' },
      { key: 'risk_level', header: 'Risk Level' },
      { key: 'corrective_action', header: 'Corrective Action' },
      { key: 'action_deadline', header: 'Action Deadline' },
      { key: 'responsible_party', header: 'Responsible Party' },
      { key: 'action_status', header: 'Action Status' },
    ]);

    // Export Schedules CSV
    exportToCSV('AEC_Report_Schedules_Report', data.schedules, [
      { key: 'proponent_name', header: 'Proponent Name' },
      { key: 'report_type', header: 'Report Type' },
      { key: 'reporting_period', header: 'Reporting Period' },
      { key: 'due_date', header: 'Due Date' },
      { key: 'status', header: 'Status' },
    ]);
  };

  const triggerManualReminder = (scheduleId: string) => {
    const target = data.schedules.find((s) => s.id === scheduleId);
    if (!target) return;

    const proponent = data.proponents.find((p) => p.id === target.proponent_id);
    const recipientEmail = proponent?.email || 'client@company.lr';

    sendEmailNotification({
      to: recipientEmail,
      subject: `[AEC URGENT REMINDER] ${target.report_type} Due on ${target.due_date}`,
      body: `Dear ${proponent?.contact_person || 'Proponent'}, this is an urgent reminder from Ansumana Environmental Consultancy Inc. Your ${target.report_type} for ${target.proponent_name} is due on ${target.due_date}. Please submit required documentation immediately.`,
      notificationType: 'Report reminder',
      proponentId: target.proponent_id,
      reportScheduleId: target.id,
    });

    alert(`Manual Email & WhatsApp reminder dispatched to ${recipientEmail}`);
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
              onClick={handleExportData}
              className="px-4 py-2.5 bg-gradient-to-r from-[#D4AF37] to-[#E5C964] text-[#0A2E24] font-heading font-bold text-xs rounded-xl shadow-md hover:from-[#E5C964] hover:to-[#D4AF37] transition-all flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" /> Export CSV Audit Reports
            </button>
          </div>
        </div>
      </div>

      {/* High-Level Statutory Metrics Overview Widget */}
      <ComplianceStatsWidget
        totalActivePermits={data.permits.filter((p) => p.status === 'Active' || p.permit_status === 'Active').length}
        totalPendingRenewalPermits={data.permits.filter((p) => p.status === 'Pending Renewal' || p.permit_status === 'Pending Renewal').length}
        totalExpiredPermits={data.permits.filter((p) => p.status === 'Expired' || p.permit_status === 'Expired').length}
        upcomingDeadlines={data.schedules.filter((s) => s.status === 'Upcoming' || s.status === 'Pending').length}
        overdueDeadlines={data.schedules.filter((s) => s.status === 'Overdue').length}
        pendingFindings={data.findings.filter((f) => f.status === 'Open' || f.action_status === 'Open' || f.compliance_status === 'Non-compliant').length}
        highRiskFindings={data.findings.filter((f) => f.risk_level === 'High').length}
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

      {/* Main Panels Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Schedules Needing Action */}
        <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <h3 className="font-heading font-bold text-base text-[#0A2E24] flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-[#D4AF37]" /> Urgent Statutory Report Deadlines
            </h3>
            <Link to="/admin/schedules" className="text-xs text-[#D4AF37] font-bold hover:underline">
              View All Schedules →
            </Link>
          </div>

          <DateRangeFilter onDateChange={(range) => setDateRange(range)} label="Filter Deadlines by Due Date Range" />

          <div className="space-y-3">
            {data.schedules
              .filter((sched) => {
                if (!dateRange) return true;
                if (dateRange.startDate && sched.due_date < dateRange.startDate) return false;
                if (dateRange.endDate && sched.due_date > dateRange.endDate) return false;
                return true;
              })
              .slice(0, 5)
              .map((sched) => {
              const diff = getDaysDiff(sched.due_date);
              const isOverdue = sched.status === 'Overdue' || diff < 0;

              return (
                <div
                  key={sched.id}
                  className="bg-gray-50 p-4 rounded-xl border border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <p className="font-bold text-xs text-[#0A2E24]">{sched.proponent_name}</p>
                    <p className="text-[11px] text-gray-600 font-medium">{sched.report_type} • {sched.reporting_period}</p>
                    <p className="text-[10px] font-mono text-gray-500">Due Date: {sched.due_date}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2.5 py-1 rounded text-[10px] font-mono font-bold ${
                        isOverdue
                          ? 'bg-red-100 text-red-700 border border-red-300'
                          : diff <= 14
                          ? 'bg-amber-100 text-amber-800 border border-amber-300'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {isOverdue ? 'OVERDUE' : `${diff} DAYS REMAINING`}
                    </span>

                    <button
                      onClick={() => triggerManualReminder(sched.id)}
                      title="Send Manual Reminder"
                      className="p-1.5 bg-[#0A2E24] hover:bg-[#1A4A3A] text-[#D4AF37] rounded-lg text-xs"
                    >
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
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
              {data.bookings.slice(0, 3).map((book) => (
                <div key={book.id} className="bg-gray-50 p-3.5 rounded-xl border border-gray-200 space-y-1 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-[#0A2E24]">{book.full_name} ({book.company_name})</span>
                    <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-mono font-bold">
                      {book.booking_status}
                    </span>
                  </div>
                  <p className="text-gray-600 text-[11px]">{book.service_needed}</p>
                  <p className="text-gray-500 text-[10px] font-mono">{book.preferred_date} @ {book.preferred_time}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Dispatched Alerts Log */}
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="font-heading font-bold text-base text-[#0A2E24] flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#D4AF37]" /> Dispatched Reminder Engine Logs
              </h3>
              <Link to="/admin/logs" className="text-xs text-[#D4AF37] font-bold hover:underline">
                View All Logs →
              </Link>
            </div>

            <div className="space-y-2">
              {data.logs.slice(0, 3).map((log) => (
                <div key={log.id} className="bg-gray-50 p-3 rounded-lg border border-gray-200 text-xs space-y-1">
                  <div className="flex justify-between items-center text-[10px] font-mono">
                    <span className="text-[#0A2E24] font-bold">{log.channel} • {log.notification_type}</span>
                    <span className="text-gray-500">{new Date(log.created_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <p className="text-gray-700 text-[11px] truncate">{log.subject}</p>
                  <p className="text-gray-500 text-[10px] font-mono truncate">To: {log.recipient}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
