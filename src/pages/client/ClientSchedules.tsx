import React, { useState, useEffect } from 'react';
import { CalendarClock, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '../../lib/AuthContext';
import { getStorageData } from '../../lib/storage';

export const ClientSchedules: React.FC = () => {
  const { user } = useAuth();
  const [data, setData] = useState(() => getStorageData());

  useEffect(() => {
    const handleUpdate = () => setData(getStorageData());
    window.addEventListener('aec_storage_updated', handleUpdate);
    return () => window.removeEventListener('aec_storage_updated', handleUpdate);
  }, []);

  const proponent = data.proponents.find(
    (p) => p.email.toLowerCase() === (user?.email || '').toLowerCase()
  ) || data.proponents[0];

  const clientSchedules = data.schedules.filter((s) => s.proponent_id === proponent?.id);

  const getDaysDiff = (dateStr: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const d = new Date(dateStr);
    return Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

  return (
    <div className="space-y-6 font-sans">
      <div className="pb-4 border-b border-gray-200">
        <h1 className="font-heading font-extrabold text-2xl text-[#0A2E24] flex items-center gap-2">
          <CalendarClock className="w-6 h-6 text-[#D4AF37]" /> Statutory Report Schedules & Submission Countdowns
        </h1>
        <p className="text-xs text-gray-600 mt-0.5">
          EPA Liberia mandate requires submission of biannual environmental monitoring reports and annual compliance audit reviews.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#0A2E24] text-[#D4AF37] text-[11px] font-mono uppercase">
                <th className="p-3">Report Type</th>
                <th className="p-3">Reporting Period</th>
                <th className="p-3">Due Date</th>
                <th className="p-3">Countdown</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs text-gray-700">
              {clientSchedules.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-gray-500 italic">
                    No active report schedules assigned.
                  </td>
                </tr>
              ) : (
                clientSchedules.map((s) => {
                  const diff = getDaysDiff(s.due_date);
                  const isOverdue = s.status === 'Overdue' || diff < 0;

                  return (
                    <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                      <td className="p-3 font-bold text-[#0A2E24]">{s.report_type}</td>
                      <td className="p-3 text-gray-600 font-medium">{s.reporting_period}</td>
                      <td className="p-3 font-mono font-bold text-[#0A2E24]">{s.due_date}</td>
                      <td className="p-3">
                        <span
                          className={`px-2.5 py-1 rounded text-[10px] font-mono font-bold ${
                            isOverdue
                              ? 'bg-red-100 text-red-700'
                              : diff <= 14
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {isOverdue ? 'OVERDUE' : `${diff} DAYS REMAINING`}
                        </span>
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                            s.status === 'Completed'
                              ? 'bg-emerald-100 text-emerald-800'
                              : s.status === 'Overdue'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {s.status}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
