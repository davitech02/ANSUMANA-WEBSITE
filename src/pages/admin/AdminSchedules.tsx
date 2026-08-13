import React, { useState, useEffect } from 'react';
import { CalendarClock, Plus, Edit, Trash2, X, Send, Search } from 'lucide-react';
import { ReportSchedule, ReportType, ReportStatus } from '../../types';
import { getStorageData, saveStorageData } from '../../lib/storage';
import { sendEmailNotification } from '../../lib/notifications';
import { DateRangeFilter, DateRange } from '../../components/common/DateRangeFilter';

export const AdminSchedules: React.FC = () => {
  const [data, setData] = useState(() => getStorageData());
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState<DateRange | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ReportSchedule | null>(null);

  const [form, setForm] = useState<Partial<ReportSchedule>>({
    proponent_id: '',
    permit_id: '',
    report_type: 'Biannual Monitoring Report',
    reporting_period: 'Q3-Q4 2026 Audit Period',
    due_date: '',
    status: 'Pending',
    reminder_30_sent: false,
    reminder_14_sent: false,
    reminder_7_sent: false,
    reminder_1_sent: false,
    reminder_due_sent: false,
    reminder_overdue_sent: false,
  });

  useEffect(() => {
    const handleUpdate = () => setData(getStorageData());
    window.addEventListener('aec_storage_updated', handleUpdate);
    return () => window.removeEventListener('aec_storage_updated', handleUpdate);
  }, []);

  const handleOpenAdd = () => {
    setEditingItem(null);
    const defaultProp = data.proponents[0]?.id || '';
    const defaultPermit = data.permits.find((p) => p.proponent_id === defaultProp)?.id || '';

    const d = new Date();
    d.setDate(d.getDate() + 14);
    const dateStr = d.toISOString().split('T')[0];

    setForm({
      proponent_id: defaultProp,
      permit_id: defaultPermit,
      report_type: 'Biannual Monitoring Report',
      reporting_period: 'Q3-Q4 2026 Audit Period',
      due_date: dateStr,
      status: 'Pending',
      reminder_30_sent: false,
      reminder_14_sent: false,
      reminder_7_sent: false,
      reminder_1_sent: false,
      reminder_due_sent: false,
      reminder_overdue_sent: false,
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (item: ReportSchedule) => {
    setEditingItem(item);
    setForm(item);
    setModalOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('Delete this report schedule entry?')) {
      const currentData = getStorageData();
      currentData.schedules = currentData.schedules.filter((s) => s.id !== id);
      saveStorageData(currentData);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const currentData = getStorageData();
    const selectedProp = currentData.proponents.find((p) => p.id === form.proponent_id);
    const propName = selectedProp?.company_name || 'Unknown Proponent';

    if (editingItem) {
      currentData.schedules = currentData.schedules.map((s) =>
        s.id === editingItem.id
          ? { ...(form as ReportSchedule), proponent_name: propName, updated_date: new Date().toISOString() }
          : s
      );
    } else {
      const newSched: ReportSchedule = {
        ...(form as ReportSchedule),
        id: 'sched-' + Math.random().toString(36).substring(2, 9),
        proponent_name: propName,
        created_date: new Date().toISOString(),
      };
      currentData.schedules.unshift(newSched);
    }

    saveStorageData(currentData);
    setModalOpen(false);
  };

  const handleSendReminder = (schedule: ReportSchedule) => {
    const proponent = data.proponents.find((p) => p.id === schedule.proponent_id);
    const email = proponent?.email || 'client@company.sl';

    sendEmailNotification({
      to: email,
      subject: `[AEC Reminder] ${schedule.report_type} Due Date: ${schedule.due_date}`,
      body: `Dear ${proponent?.contact_person || 'Proponent'}, your ${schedule.report_type} (${schedule.reporting_period}) is scheduled for submission on ${schedule.due_date}. Please log into the AEC portal to review findings and upload required evidence.`,
      notificationType: 'Report reminder',
      proponentId: schedule.proponent_id,
      reportScheduleId: schedule.id,
    });

    alert(`Notification logged & dispatched to ${email}`);
  };

  const filteredSchedules = data.schedules.filter((s) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      s.proponent_name.toLowerCase().includes(term) ||
      s.report_type.toLowerCase().includes(term) ||
      s.reporting_period.toLowerCase().includes(term);

    if (!matchesSearch) return false;

    if (dateRange) {
      if (dateRange.startDate && s.due_date < dateRange.startDate) return false;
      if (dateRange.endDate && s.due_date > dateRange.endDate) return false;
    }

    return true;
  });

  return (
    <div className="space-y-6 font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-200">
        <div>
          <h1 className="font-heading font-extrabold text-2xl text-[#0A2E24] flex items-center gap-2">
            <CalendarClock className="w-6 h-6 text-[#D4AF37]" /> Report Schedules & Deadlines
          </h1>
          <p className="text-xs text-gray-600 mt-0.5">Manage statutory environmental audit schedules and automated reminder tracking</p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="px-4 py-2.5 bg-[#0A2E24] hover:bg-[#1A4A3A] text-[#D4AF37] font-heading font-bold text-xs rounded-xl transition-all shadow-md flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" /> Schedule Report Deadline
        </button>
      </div>

      <DateRangeFilter onDateChange={(range) => setDateRange(range)} label="Filter Audit Schedules by Due Date Range" />

      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3">
        <Search className="w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search schedules by proponent, report type, or reporting period..."
          className="w-full text-xs focus:outline-none"
        />
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#0A2E24] text-[#D4AF37] text-[11px] font-mono uppercase">
                <th className="p-3">Proponent Company</th>
                <th className="p-3">Report Type</th>
                <th className="p-3">Reporting Period</th>
                <th className="p-3">Due Date</th>
                <th className="p-3">Status</th>
                <th className="p-3">Reminders Triggered</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs text-gray-700">
              {filteredSchedules.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-gray-500 italic">
                    No schedules found.
                  </td>
                </tr>
              ) : (
                filteredSchedules.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-3 font-bold text-[#0A2E24]">{s.proponent_name}</td>
                    <td className="p-3 font-semibold">{s.report_type}</td>
                    <td className="p-3 text-gray-600">{s.reporting_period}</td>
                    <td className="p-3 font-mono font-bold text-[#0A2E24]">{s.due_date}</td>
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
                    <td className="p-3">
                      <div className="flex items-center gap-1 text-[10px] font-mono">
                        <span className={`px-1.5 py-0.5 rounded ${s.reminder_30_sent ? 'bg-emerald-100 text-emerald-800 font-bold' : 'bg-gray-100 text-gray-400'}`}>30d</span>
                        <span className={`px-1.5 py-0.5 rounded ${s.reminder_14_sent ? 'bg-emerald-100 text-emerald-800 font-bold' : 'bg-gray-100 text-gray-400'}`}>14d</span>
                        <span className={`px-1.5 py-0.5 rounded ${s.reminder_7_sent ? 'bg-emerald-100 text-emerald-800 font-bold' : 'bg-gray-100 text-gray-400'}`}>7d</span>
                        <span className={`px-1.5 py-0.5 rounded ${s.reminder_1_sent ? 'bg-emerald-100 text-emerald-800 font-bold' : 'bg-gray-100 text-gray-400'}`}>1d</span>
                      </div>
                    </td>
                    <td className="p-3 text-right space-x-2">
                      <button
                        onClick={() => handleSendReminder(s)}
                        className="p-1.5 bg-[#0A2E24] hover:bg-[#1A4A3A] text-[#D4AF37] rounded-lg transition-colors"
                        title="Dispatch Manual Alert"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleOpenEdit(s)}
                        className="p-1.5 bg-gray-100 hover:bg-[#D4AF37]/20 text-[#0A2E24] rounded-lg transition-colors"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(s.id)}
                        className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto border border-gray-200">
            <div className="flex items-center justify-between pb-3 border-b border-gray-200">
              <h3 className="font-heading font-bold text-lg text-[#0A2E24]">
                {editingItem ? 'Edit Report Schedule' : 'Create Report Schedule'}
              </h3>
              <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-gray-700 mb-1">Proponent Company *</label>
                <select
                  required
                  value={form.proponent_id}
                  onChange={(e) => {
                    const pid = e.target.value;
                    const permit = data.permits.find((p) => p.proponent_id === pid)?.id || '';
                    setForm({ ...form, proponent_id: pid, permit_id: permit });
                  }}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:border-[#D4AF37] bg-white"
                >
                  {data.proponents.map((prop) => (
                    <option key={prop.id} value={prop.id}>
                      {prop.company_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Report Type *</label>
                <select
                  value={form.report_type}
                  onChange={(e) => setForm({ ...form, report_type: e.target.value as ReportType })}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:border-[#D4AF37] bg-white"
                >
                  <option value="Environmental Audit Report">Environmental Audit Report</option>
                  <option value="Biannual Monitoring Report">Biannual Monitoring Report</option>
                  <option value="Quarterly Monitoring Report">Quarterly Monitoring Report</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Reporting Period *</label>
                  <input
                    type="text"
                    required
                    value={form.reporting_period}
                    onChange={(e) => setForm({ ...form, reporting_period: e.target.value })}
                    placeholder="e.g. Q2 2026 Audit"
                    className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Due Date *</label>
                  <input
                    type="date"
                    required
                    value={form.due_date}
                    onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Report Status</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value as ReportStatus })}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:border-[#D4AF37] bg-white"
                >
                  <option value="Pending">Pending</option>
                  <option value="Submitted">Submitted</option>
                  <option value="Overdue">Overdue</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>

              <div className="pt-3 border-t border-gray-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#0A2E24] hover:bg-[#1A4A3A] text-[#D4AF37] font-bold rounded-lg"
                >
                  Save Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
