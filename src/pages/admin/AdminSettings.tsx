import React, { useState, useEffect, useCallback } from 'react';
import {
  Settings,
  Save,
  ShieldCheck,
  Mail,
  Bell,
  Loader2,
  AlertCircle,
  RefreshCw,
  Eye,
  Send,
  Activity,
  Server,
  Cpu,
} from 'lucide-react';
import { adminApi, workflowsApi, healthApi, ApiError } from '../../lib/api';
import type { CompanySettings, Diagnostics, HealthCheck, ReminderRunSummary } from '../../types';

function errMsg(e: unknown): string {
  return e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : 'Request failed. Please try again.';
}

export const AdminSettings: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [companyName, setCompanyName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPhone, setAdminPhone] = useState('');
  const [adminWhatsApp, setAdminWhatsApp] = useState('');
  const [enableEmail, setEnableEmail] = useState(true);
  const [enableWhatsApp, setEnableWhatsApp] = useState(true);
  const [reminder30Days, setReminder30Days] = useState(true);
  const [reminder14Days, setReminder14Days] = useState(true);
  const [reminder7Days, setReminder7Days] = useState(true);
  const [reminder1Days, setReminder1Days] = useState(true);

  const [banner, setBanner] = useState<string | null>(null);
  const [liveness, setLiveness] = useState<string | null>(null);
  const [ready, setReady] = useState<HealthCheck | null>(null);
  const [diagnostics, setDiagnostics] = useState<Diagnostics | null>(null);
  const [diagLoading, setDiagLoading] = useState(true);
  const [diagError, setDiagError] = useState<string | null>(null);

  const [reminderRunning, setReminderRunning] = useState(false);
  const [dryRunRunning, setDryRunRunning] = useState(false);
  const [reminderResult, setReminderResult] = useState<ReminderRunSummary | null>(null);
  const [reminderError, setReminderError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const settings = await adminApi.getSettings();
      setCompanyName(settings.company_name || '');
      setAdminEmail(settings.company_email || '');
      setAdminPhone(settings.company_phone || '');
      setAdminWhatsApp(settings.company_whatsapp || '');
      setEnableEmail(settings.enable_email_notifications);
      setEnableWhatsApp(settings.enable_whatsapp_notifications);
      setReminder30Days(settings.reminder_30_enabled);
      setReminder14Days(settings.reminder_14_enabled);
      setReminder7Days(settings.reminder_7_enabled);
      setReminder1Days(settings.reminder_1_enabled);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(false), 3000);
    return () => clearTimeout(t);
  }, [saved]);

  const loadHealth = useCallback(async () => {
    setDiagLoading(true);
    setDiagError(null);
    try {
      const [bannerRes, liveRes, readyRes, diagRes] = await Promise.allSettled([
        healthApi.healthBanner(),
        healthApi.liveness(),
        healthApi.readiness(),
        workflowsApi.diagnostics(),
      ]);
      if (bannerRes.status === 'fulfilled') setBanner(bannerRes.value.service);
      if (liveRes.status === 'fulfilled') setLiveness(liveRes.value.status);
      if (readyRes.status === 'fulfilled') {
        setReady(readyRes.value);
      } else {
        const reason = readyRes.reason;
        const isNotReady = reason instanceof ApiError && reason.code === 'not_ready';
        setReady({
          status: isNotReady ? 'Not ready' : 'Unavailable',
          checks: { database: '—', configuration: '—' },
          problems: [errMsg(reason)],
        });
      }
      if (diagRes.status === 'fulfilled') {
        setDiagnostics(diagRes.value);
      } else {
        setDiagError(errMsg(diagRes.reason));
      }
    } finally {
      setDiagLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHealth();
  }, [loadHealth]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await adminApi.updateSettings({
        company_name: companyName,
        company_email: adminEmail,
        company_phone: adminPhone,
        company_whatsapp: adminWhatsApp,
        enable_email_notifications: enableEmail,
        enable_whatsapp_notifications: enableWhatsApp,
        reminder_30_enabled: reminder30Days,
        reminder_14_enabled: reminder14Days,
        reminder_7_enabled: reminder7Days,
        reminder_1_enabled: reminder1Days,
      });
      setSaved(true);
    } catch (e2) {
      setError(errMsg(e2));
    } finally {
      setSaving(false);
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
    <div className="space-y-6 font-sans max-w-4xl">
      <div className="pb-4 border-b border-gray-200">
        <h1 className="font-heading font-extrabold text-2xl text-[#0A2E24] flex items-center gap-2">
          <Settings className="w-6 h-6 text-[#D4AF37]" /> AEC System & Portal Settings
        </h1>
        <p className="text-xs text-gray-600 mt-0.5">Configure notification dispatch parameters, admin recipient emails, and Liberia EPA compliance rules</p>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl font-bold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {saved && (
        <div className="p-3 bg-emerald-100 border border-emerald-300 text-emerald-800 text-xs rounded-xl font-bold flex items-center gap-2">
          <ShieldCheck className="w-4 h-4" /> System Settings Updated & Saved Successfully!
        </div>
      )}

      {loading ? (
        <div className="bg-white p-10 rounded-2xl border border-gray-200 shadow-sm flex items-center justify-center gap-3">
          <Loader2 className="w-5 h-5 text-[#D4AF37] animate-spin" />
          <span className="text-xs font-bold text-gray-500">Loading system settings…</span>
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-6">
          {/* Contact Info Settings */}
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
            <h3 className="font-heading font-bold text-base text-[#0A2E24] flex items-center gap-2 border-b border-gray-100 pb-2">
              <Mail className="w-4 h-4 text-[#D4AF37]" /> AEC Admin Contact Routing
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="block font-bold text-gray-700 mb-1">Company Name</label>
                <input
                  type="text"
                  required
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full p-2.5 border border-gray-300 rounded-lg focus:outline-none focus:border-[#D4AF37]"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Primary Admin Email</label>
                <input
                  type="email"
                  required
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  className="w-full p-2.5 border border-gray-300 rounded-lg focus:outline-none focus:border-[#D4AF37]"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Office Hotline</label>
                <input
                  type="text"
                  required
                  value={adminPhone}
                  onChange={(e) => setAdminPhone(e.target.value)}
                  className="w-full p-2.5 border border-gray-300 rounded-lg focus:outline-none focus:border-[#D4AF37]"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">WhatsApp Dispatch Line</label>
                <input
                  type="text"
                  required
                  value={adminWhatsApp}
                  onChange={(e) => setAdminWhatsApp(e.target.value)}
                  className="w-full p-2.5 border border-gray-300 rounded-lg focus:outline-none focus:border-[#D4AF37]"
                />
              </div>
            </div>
          </div>

          {/* Notification Dispatch Channels */}
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
            <h3 className="font-heading font-bold text-base text-[#0A2E24] flex items-center gap-2 border-b border-gray-100 pb-2">
              <Bell className="w-4 h-4 text-[#D4AF37]" /> Notification Dispatch Channels
            </h3>

            <div className="space-y-3 text-xs">
              <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enableEmail}
                  onChange={(e) => setEnableEmail(e.target.checked)}
                  className="w-4 h-4 accent-[#0A2E24]"
                />
                <div>
                  <p className="font-bold text-[#0A2E24]">Email Notifications</p>
                  <p className="text-[11px] text-gray-500">Allow automated email reminders and alerts to be dispatched</p>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enableWhatsApp}
                  onChange={(e) => setEnableWhatsApp(e.target.checked)}
                  className="w-4 h-4 accent-[#0A2E24]"
                />
                <div>
                  <p className="font-bold text-[#0A2E24]">WhatsApp Notifications</p>
                  <p className="text-[11px] text-gray-500">Allow automated WhatsApp alerts and reminders to be dispatched</p>
                </div>
              </label>
            </div>
          </div>

          {/* Reminder Threshold Settings */}
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
            <h3 className="font-heading font-bold text-base text-[#0A2E24] flex items-center gap-2 border-b border-gray-100 pb-2">
              <Bell className="w-4 h-4 text-[#D4AF37]" /> Automated Statutory Report Reminder Engine
            </h3>

            <div className="space-y-3 text-xs">
              <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={reminder30Days}
                  onChange={(e) => setReminder30Days(e.target.checked)}
                  className="w-4 h-4 accent-[#0A2E24]"
                />
                <div>
                  <p className="font-bold text-[#0A2E24]">30-Day Early Warning Alert</p>
                  <p className="text-[11px] text-gray-500">Dispatch email & WhatsApp notification 30 days prior to report due date</p>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={reminder14Days}
                  onChange={(e) => setReminder14Days(e.target.checked)}
                  className="w-4 h-4 accent-[#0A2E24]"
                />
                <div>
                  <p className="font-bold text-[#0A2E24]">14-Day Priority Alert</p>
                  <p className="text-[11px] text-gray-500">Dispatch email & WhatsApp notification 14 days prior to report due date</p>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={reminder7Days}
                  onChange={(e) => setReminder7Days(e.target.checked)}
                  className="w-4 h-4 accent-[#0A2E24]"
                />
                <div>
                  <p className="font-bold text-[#0A2E24]">7-Day Urgent Deadline Warning</p>
                  <p className="text-[11px] text-gray-500">Dispatch email & WhatsApp notification 7 days prior to report due date</p>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={reminder1Days}
                  onChange={(e) => setReminder1Days(e.target.checked)}
                  className="w-4 h-4 accent-[#0A2E24]"
                />
                <div>
                  <p className="font-bold text-[#0A2E24]">1-Day Final Deadline Alert</p>
                  <p className="text-[11px] text-gray-500">Dispatch email & WhatsApp notification 1 day prior to report due date</p>
                </div>
              </label>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="px-6 py-3 bg-[#0A2E24] hover:bg-[#1A4A3A] text-[#D4AF37] font-heading font-bold text-xs rounded-xl shadow-lg transition-all flex items-center gap-2 disabled:opacity-50"
          >
            <Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Save Configuration'}
          </button>
        </form>
      )}

      {/* System Diagnostics & Health */}
      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
        <h3 className="font-heading font-bold text-base text-[#0A2E24] flex items-center gap-2 border-b border-gray-100 pb-2">
          <Activity className="w-4 h-4 text-[#D4AF37]" /> System Diagnostics & Health
        </h3>

        {diagLoading ? (
          <div className="flex items-center justify-center gap-2 text-gray-400 py-4">
            <Loader2 className="w-4 h-4 animate-spin" /> Checking system health…
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 shadow-xs space-y-1">
              <p className="text-[10px] font-mono uppercase text-gray-500 font-bold flex items-center gap-1.5">
                <Server className="w-3.5 h-3.5 text-[#0A2E24]" /> Service
              </p>
              <p className="text-sm font-bold text-[#0A2E24]">{banner || '—'}</p>
            </div>

            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 shadow-xs space-y-1">
              <p className="text-[10px] font-mono uppercase text-gray-500 font-bold flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-emerald-600" /> Liveness
              </p>
              <p className="text-sm font-bold text-emerald-700">{liveness || '—'}</p>
            </div>

            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 shadow-xs space-y-1">
              <p className="text-[10px] font-mono uppercase text-gray-500 font-bold flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-[#D4AF37]" /> Readiness
              </p>
              {ready ? (
                <>
                  <p className={`text-sm font-bold ${ready.status === 'Not ready' ? 'text-red-600' : 'text-emerald-700'}`}>
                    {ready.status}
                  </p>
                  <p className="text-[10px] text-gray-500 font-mono">
                    Database: {ready.checks.database} · Configuration: {ready.checks.configuration}
                  </p>
                  {(ready.problems ?? []).map((p, i) => (
                    <p key={i} className="text-[10px] text-red-600">{p}</p>
                  ))}
                </>
              ) : (
                <p className="text-sm font-bold text-gray-400">—</p>
              )}
            </div>

            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 shadow-xs space-y-1">
              <p className="text-[10px] font-mono uppercase text-gray-500 font-bold flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-[#0A2E24]" /> Backend Diagnostics
              </p>
              {diagError ? (
                <p className="text-[10px] text-red-600">{diagError}</p>
              ) : diagnostics ? (
                <>
                  <p className="text-[11px] text-gray-700">
                    Database: <span className="font-bold text-[#0A2E24]">{diagnostics.database}</span>
                  </p>
                  <p className="text-[11px] text-gray-700">
                    Configuration:{' '}
                    <span className={`font-bold ${diagnostics.configuration.status === 'ok' ? 'text-emerald-700' : 'text-red-600'}`}>
                      {diagnostics.configuration.status}
                    </span>
                  </p>
                  {diagnostics.configuration.problems.length > 0 && (
                    <ul className="list-disc pl-4 text-[10px] text-red-600 space-y-0.5">
                      {diagnostics.configuration.problems.map((p, i) => (
                        <li key={i}>{p}</li>
                      ))}
                    </ul>
                  )}
                  <p className="text-[11px] text-gray-700">
                    Notifications:{' '}
                    <span className="font-bold text-[#0A2E24]">
                      {diagnostics.notifications.email_enabled ? 'Email on' : 'Email off'} ·{' '}
                      {diagnostics.notifications.whatsapp_enabled ? 'WhatsApp on' : 'WhatsApp off'}
                    </span>
                  </p>
                  <p className="text-[11px] text-gray-700">
                    Reminders:{' '}
                    <span className="font-bold text-[#0A2E24]">
                      {diagnostics.reminders.available ? 'Available' : 'Unavailable'}
                    </span>
                  </p>
                  <p className="text-[11px] text-gray-700">
                    Migrations: <span className="font-mono text-[#0A2E24]">{diagnostics.migrations.head}</span>
                  </p>
                </>
              ) : null}
            </div>
          </div>
        )}
      </div>

      {/* Reminder Engine */}
      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
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
            <p className="text-[10px] text-gray-400 font-mono">Run at: {new Date(reminderResult.run_at).toLocaleString()}</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div>
                <p className="font-heading font-extrabold text-xl text-[#D4AF37]">{reminderResult.processed}</p>
                <p className="text-[10px] text-gray-400 font-mono uppercase">Processed</p>
              </div>
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
              <div>
                <p className="font-heading font-extrabold text-xl text-gray-200">{reminderResult.channel_skips}</p>
                <p className="text-[10px] text-gray-400 font-mono uppercase">Channel Skips</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};