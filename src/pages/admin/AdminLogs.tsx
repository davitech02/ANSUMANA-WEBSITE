import React, { useState, useEffect } from 'react';
import { History, ShieldCheck, Mail, MessageSquare, Search } from 'lucide-react';
import { getStorageData } from '../../lib/storage';

export const AdminLogs: React.FC = () => {
  const [data, setData] = useState(() => getStorageData());
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const handleUpdate = () => setData(getStorageData());
    window.addEventListener('aec_storage_updated', handleUpdate);
    return () => window.removeEventListener('aec_storage_updated', handleUpdate);
  }, []);

  const filteredLogs = data.logs.filter((l) => {
    const term = searchTerm.toLowerCase();
    return (
      l.recipient.toLowerCase().includes(term) ||
      l.subject.toLowerCase().includes(term) ||
      l.notification_type.toLowerCase().includes(term) ||
      l.channel.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6 font-sans">
      <div className="pb-4 border-b border-gray-200">
        <h1 className="font-heading font-extrabold text-2xl text-[#0A2E24] flex items-center gap-2">
          <History className="w-6 h-6 text-[#D4AF37]" /> Reminder Engine Audit Trail Logs
        </h1>
        <p className="text-xs text-gray-600 mt-0.5">Audit log of all dispatched statutory report reminders, WhatsApp alerts, and booking confirmations</p>
      </div>

      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3">
        <Search className="w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Filter logs by recipient, subject, channel, or type..."
          className="w-full text-xs focus:outline-none"
        />
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#0A2E24] text-[#D4AF37] text-[11px] font-mono uppercase">
                <th className="p-3">Timestamp</th>
                <th className="p-3">Channel</th>
                <th className="p-3">Notification Type</th>
                <th className="p-3">Recipient</th>
                <th className="p-3">Subject</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs text-gray-700 font-mono">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-gray-500 italic">
                    No notification logs recorded.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-3 text-[11px] text-gray-500">
                      {new Date(log.created_date).toLocaleString()}
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded bg-gray-100 text-[#0A2E24] font-bold text-[10px]">
                        {log.channel}
                      </span>
                    </td>
                    <td className="p-3 text-[#0A2E24] font-bold">{log.notification_type}</td>
                    <td className="p-3 text-gray-700">{log.recipient}</td>
                    <td className="p-3 text-gray-600 max-w-xs truncate">{log.subject}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                        {log.status}
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
