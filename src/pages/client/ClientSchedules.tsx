import React, { useState, useEffect, useCallback } from 'react';
import { CalendarClock, Clock, CheckCircle2, AlertCircle, Loader2, AlertTriangle } from 'lucide-react';
import { portalApi } from '../../lib/api';
import type { ReportSchedule } from '../../types';

function errMsg(e: unknown): string {
  return e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : 'Request failed. Please try again.';
}

export const ClientSchedules: React.FC = () => {
  const [schedules, setSchedules] = useState<ReportSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSchedules = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await portalApi.listClientSchedules();
      setSchedules(res.items);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSchedules();
  }, [loadSchedules]);

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

      {loading ? (
        <div className="bg-white p-12 rounded-2xl border border-gray-200 text-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-[#D4AF37] mx-auto" />
          <p className="text-sm font-bold text-[#0A2E24]">Loading report schedules...</p>
        </div>
      ) : error ? (
        <div className="bg-rose-50 p-8 rounded-2xl border border-rose-200 text-center space-y-3">
          <AlertTriangle className="w-10 h-10 text-rose-600 mx-auto" />
          <p className="text-sm font-bold text-rose-800">Unable to load report schedules</p>
          <p className="text-xs text-rose-600">{error}</p>
          <button
            onClick={loadSchedules}
            className="px-4 py-2 bg-[#0A2E24] text-[#D4AF37] font-bold text-xs rounded-xl hover:bg-[#1A4A3A] transition-colors"
          >
            Retry
          </button>
        </div>
      ) : (
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
                {schedules.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-gray-500 italic">
                      No active report schedules assigned.
                    </td>
                  </tr>
                ) : (
                  schedules.map((s) => {
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
      )}
    </div>
  );
};