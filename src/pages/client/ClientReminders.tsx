import React, { useState, useEffect } from 'react';
import { History, Mail, MessageSquare, Bell, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { getStorageData } from '../../lib/storage';
import { useAuth } from '../../lib/AuthContext';

export const ClientReminders: React.FC = () => {
  const [data, setData] = useState(() => getStorageData());
  const { user, proponent } = useAuth();

  useEffect(() => {
    const handleUpdate = () => setData(getStorageData());
    window.addEventListener('aec_storage_updated', handleUpdate);
    return () => window.removeEventListener('aec_storage_updated', handleUpdate);
  }, []);

  // Filter logs for this proponent (exact match to avoid cross-proponent data leaks)
  const clientEmail = (proponent?.email || user?.email || '').toLowerCase();
  const clientWhatsApp = (proponent?.whatsapp_number || '').replace(/[^0-9+]/g, '').toLowerCase();
  const myLogs = data.logs.filter((l) => {
    const rec = l.recipient.toLowerCase();
    if (clientEmail && rec === clientEmail) return true;
    if (clientWhatsApp && rec.replace(/[^0-9+]/g, '').toLowerCase() === clientWhatsApp) return true;
    return false;
  });

  return (
    <div className="space-y-6 font-sans">
      <div className="pb-4 border-b border-gray-200">
        <h1 className="font-heading font-extrabold text-2xl text-[#0A2E24] flex items-center gap-2">
          <History className="w-6 h-6 text-[#D4AF37]" /> Statutory Reminder History & Alert Logs
        </h1>
        <p className="text-xs text-gray-600 mt-0.5">
          History of 30-day, 14-day, and 7-day automated compliance alerts dispatched to your registered email and WhatsApp number
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3">
          <div className="p-3 rounded-lg bg-emerald-50 text-emerald-700">
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] text-gray-500 font-mono uppercase">Total Dispatched</p>
            <p className="text-xl font-bold text-[#0A2E24]">{myLogs.length}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3">
          <div className="p-3 rounded-lg bg-blue-50 text-blue-700">
            <Mail className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] text-gray-500 font-mono uppercase">Email Dispatch Channel</p>
            <p className="text-sm font-semibold text-gray-800 truncate">{clientEmail || 'Active'}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3">
          <div className="p-3 rounded-lg bg-emerald-50 text-emerald-600">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] text-gray-500 font-mono uppercase">WhatsApp Alerts</p>
            <p className="text-sm font-semibold text-gray-800">{proponent?.whatsapp_number || '+231 077 000 000'}</p>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
          <h2 className="font-heading font-bold text-sm text-[#0A2E24] flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#D4AF37]" /> Automated Notification Logs
          </h2>
          <span className="text-[11px] text-gray-500 font-mono">Real-Time Dispatch Feed</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#0A2E24] text-[#D4AF37] text-[11px] font-mono uppercase">
                <th className="p-3">Timestamp</th>
                <th className="p-3">Channel</th>
                <th className="p-3">Alert Type</th>
                <th className="p-3">Subject / Detail</th>
                <th className="p-3">Delivery Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs text-gray-700 font-mono">
              {myLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-500 italic">
                    No reminder logs found for {clientEmail}. New statutory reminders will appear here automatically when upcoming audit reports approach their deadline.
                  </td>
                </tr>
              ) : (
                myLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-3 text-[11px] text-gray-500">
                      {new Date(log.created_date).toLocaleString()}
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded bg-gray-100 text-[#0A2E24] font-bold text-[10px] inline-flex items-center gap-1">
                        {log.channel === 'WhatsApp' ? <MessageSquare className="w-3 h-3 text-emerald-600" /> : <Mail className="w-3 h-3 text-blue-600" />}
                        {log.channel}
                      </span>
                    </td>
                    <td className="p-3 text-[#0A2E24] font-bold">{log.notification_type}</td>
                    <td className="p-3 text-gray-600">{log.subject}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold flex items-center gap-1 w-fit">
                        <CheckCircle2 className="w-3 h-3" /> {log.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
