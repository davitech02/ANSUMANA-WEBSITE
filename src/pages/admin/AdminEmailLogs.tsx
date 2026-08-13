import React, { useState, useEffect } from 'react';
import { Mail, Search, CheckCircle2, ShieldCheck, RefreshCw } from 'lucide-react';
import { getStorageData } from '../../lib/storage';

export const AdminEmailLogs: React.FC = () => {
  const [data, setData] = useState(() => getStorageData());
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const handleUpdate = () => setData(getStorageData());
    window.addEventListener('aec_storage_updated', handleUpdate);
    return () => window.removeEventListener('aec_storage_updated', handleUpdate);
  }, []);

  const emailLogs = data.logs.filter((l) => l.channel === 'Email' || l.channel.toLowerCase().includes('email'));

  const deliveredCount = emailLogs.filter((l) => l.status === 'Sent').length;
  const deliveryRate = emailLogs.length > 0 ? Math.round((deliveredCount / emailLogs.length) * 100) : 0;
  const statutoryTriggers = emailLogs.filter(
    (l) => l.notification_type === 'Report reminder' || l.notification_type === 'Overdue notice'
  ).length;

  const filteredLogs = emailLogs.filter((l) => {
    const term = searchTerm.toLowerCase();
    return (
      l.recipient.toLowerCase().includes(term) ||
      l.subject.toLowerCase().includes(term) ||
      l.notification_type.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6 font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-200">
        <div>
          <h1 className="font-heading font-extrabold text-2xl text-[#0A2E24] flex items-center gap-2">
            <Mail className="w-6 h-6 text-[#D4AF37]" /> Statutory Email Dispatch Logs
          </h1>
          <p className="text-xs text-gray-600 mt-0.5">
            Audit history of automated email reminders, EPA statutory deadline alerts, and client notifications
          </p>
        </div>

        <button
          onClick={() => setData(getStorageData())}
          className="px-3.5 py-2 bg-[#0A2E24] hover:bg-[#1A4A3A] text-[#D4AF37] font-bold text-xs rounded-xl transition-all shadow-xs flex items-center gap-2 w-fit"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh Audit Trail
        </button>
      </div>

      {/* Summary Stat */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex items-center gap-3">
          <div className="p-3 bg-blue-50 text-blue-700 rounded-lg">
            <Mail className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-mono uppercase text-gray-500">Total Email Dispatches</p>
            <p className="text-xl font-bold text-[#0A2E24]">{emailLogs.length}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex items-center gap-3">
          <div className="p-3 bg-emerald-50 text-emerald-700 rounded-lg">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-mono uppercase text-gray-500">Successful Delivery Rate</p>
            <p className="text-xl font-bold text-emerald-700">{deliveryRate}%</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex items-center gap-3">
          <div className="p-3 bg-amber-50 text-amber-700 rounded-lg">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-mono uppercase text-gray-500">Compliance Triggers</p>
            <p className="text-xl font-bold text-[#0A2E24]">{statutoryTriggers} Dispatched</p>
          </div>
        </div>
      </div>

      {/* Search Filter */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3">
        <Search className="w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Filter email logs by recipient address, subject, or alert type..."
          className="w-full text-xs focus:outline-none"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#0A2E24] text-[#D4AF37] text-[11px] font-mono uppercase">
                <th className="p-3">Timestamp</th>
                <th className="p-3">Alert Category</th>
                <th className="p-3">Recipient Email</th>
                <th className="p-3">Subject Line</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs text-gray-700 font-mono">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-500 italic">
                    No email dispatch logs matching search criteria.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-3 text-[11px] text-gray-500">
                      {new Date(log.created_date).toLocaleString()}
                    </td>
                    <td className="p-3 text-[#0A2E24] font-bold">{log.notification_type}</td>
                    <td className="p-3 font-semibold text-gray-800">{log.recipient}</td>
                    <td className="p-3 text-gray-600 max-w-xs truncate">{log.subject}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold flex items-center gap-1 w-fit">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" /> {log.status}
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
