import React, { useState, useEffect, useCallback } from 'react';
import { CalendarClock, Plus, Edit, Trash2, X, Search, Loader2, AlertCircle } from 'lucide-react';
import type { ReportSchedule, ReportType, ReportStatus, Permit, Proponent, Pagination } from '../../types';
import { adminApi } from '../../lib/api';
import { DateRangeFilter, DateRange } from '../../components/common/DateRangeFilter';

function errMsg(e: unknown): string {
  return e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : 'Request failed. Please try again.';
}

const PER_PAGE = 25;

export const AdminSchedules: React.FC = () => {
  const [items, setItems] = useState<ReportSchedule[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterReportType, setFilterReportType] = useState('');
  const [proponents, setProponents] = useState<Proponent[]>([]);
  const [permits, setPermits] = useState<Permit[]>([]);
  const [dateRange, setDateRange] = useState<DateRange | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ReportSchedule | null>(null);

  const [form, setForm] = useState<Partial<ReportSchedule>>({
    proponent_id: '',
    permit_id: '',
    report_type: 'Biannual Monitoring Report',
    reporting_period: 'Q3-Q4 2026 Audit Period',
    due_date: '',
    status: 'Pending',
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.listSchedules({
        page,
        per_page: PER_PAGE,
        q: searchTerm || undefined,
        status: filterStatus || undefined,
        report_type: filterReportType || undefined,
      });
      setItems(res.items);
      setPagination(res.pagination);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, [page, searchTerm, filterStatus, filterReportType]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    let active = true;
    adminApi
      .listProponents({ page: 1, per_page: 100 })
      .then((res) => {
        if (active) setProponents(res.items);
      })
      .catch(() => {
        if (active) setProponents([]);
      });
    adminApi
      .listPermits({ page: 1, per_page: 100 })
      .then((res) => {
        if (active) setPermits(res.items);
      })
      .catch(() => {
        if (active) setPermits([]);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => setSuccess(null), 3000);
    return () => clearTimeout(t);
  }, [success]);

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    setPage(1);
  };

  const proponentPermits = form.proponent_id
    ? permits.filter((p) => p.proponent_id === form.proponent_id)
    : permits;

  const handleOpenAdd = () => {
    setEditingItem(null);
    const defaultProp = proponents[0]?.id || '';
    const defaultPermit = permits.find((p) => p.proponent_id === defaultProp)?.id || '';

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
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (item: ReportSchedule) => {
    setEditingItem(item);
    setForm(item);
    setModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this report schedule entry?')) return;
    setSaving(true);
    setError(null);
    try {
      await adminApi.deleteSchedule(id);
      setSuccess('Schedule deleted successfully.');
      load();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        proponent_id: form.proponent_id ?? '',
        permit_id: form.permit_id || null,
        report_type: form.report_type ?? 'Biannual Monitoring Report',
        reporting_period: form.reporting_period || null,
        due_date: form.due_date ?? '',
        status: form.status ?? 'Pending',
      };
      if (editingItem) {
        await adminApi.updateSchedule(editingItem.id, payload);
        setSuccess('Schedule updated successfully.');
      } else {
        await adminApi.createSchedule(payload);
        setSuccess('Schedule created successfully.');
      }
      setModalOpen(false);
      load();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setSaving(false);
    }
  };

  const visibleSchedules = dateRange
    ? items.filter((s) => {
        if (dateRange.startDate && s.due_date < dateRange.startDate) return false;
        if (dateRange.endDate && s.due_date > dateRange.endDate) return false;
        return true;
      })
    : items;

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

      {success && (
        <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" /> {success}
        </div>
      )}

      {error && (
        <div className="bg-red-50 p-3 rounded-xl border border-red-200 text-red-700 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      <DateRangeFilter onDateChange={(range) => setDateRange(range)} label="Filter Audit Schedules by Due Date Range" />

      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="flex items-center gap-3 flex-1">
          <Search className="w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search schedules by proponent, report type, or reporting period..."
            className="w-full text-xs focus:outline-none"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => {
            setFilterStatus(e.target.value);
            setPage(1);
          }}
          className="p-2 border border-gray-300 rounded-lg text-xs bg-white focus:outline-none focus:border-[#D4AF37]"
        >
          <option value="">All Statuses</option>
          <option value="Pending">Pending</option>
          <option value="Submitted">Submitted</option>
          <option value="Overdue">Overdue</option>
          <option value="Completed">Completed</option>
        </select>
        <select
          value={filterReportType}
          onChange={(e) => {
            setFilterReportType(e.target.value);
            setPage(1);
          }}
          className="p-2 border border-gray-300 rounded-lg text-xs bg-white focus:outline-none focus:border-[#D4AF37]"
        >
          <option value="">All Report Types</option>
          <option value="Environmental Audit Report">Environmental Audit Report</option>
          <option value="Biannual Monitoring Report">Biannual Monitoring Report</option>
          <option value="Quarterly Monitoring Report">Quarterly Monitoring Report</option>
        </select>
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
                <th className="p-3">Created</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs text-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center">
                    <div className="flex items-center justify-center gap-2 text-gray-400">
                      <Loader2 className="w-4 h-4 animate-spin" /> Loading schedules…
                    </div>
                  </td>
                </tr>
              ) : visibleSchedules.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-gray-500 italic">
                    No schedules found.
                  </td>
                </tr>
              ) : (
                visibleSchedules.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-3 font-bold text-[#0A2E24]">{s.proponent_name || '—'}</td>
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
                    <td className="p-3 text-[10px] text-gray-500">
                      {new Date(s.created_at).toLocaleString()}
                    </td>
                    <td className="p-3 text-right space-x-2">
                      <button
                        onClick={() => handleOpenEdit(s)}
                        disabled={saving}
                        className="p-1.5 bg-gray-100 hover:bg-[#D4AF37]/20 text-[#0A2E24] rounded-lg transition-colors disabled:opacity-50"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(s.id)}
                        disabled={saving}
                        className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors disabled:opacity-50"
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

      {pagination && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-500">
            Page {pagination.page} of {pagination.total_pages} ({pagination.total} total)
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={pagination.page <= 1 || loading}
              className="px-3 py-1.5 bg-white border border-gray-300 hover:bg-gray-100 text-gray-700 font-bold rounded-lg disabled:opacity-40"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={pagination.page >= pagination.total_pages || loading}
              className="px-3 py-1.5 bg-white border border-gray-300 hover:bg-gray-100 text-gray-700 font-bold rounded-lg disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}

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
              {error && (
                <div className="bg-red-50 p-3 rounded-xl border border-red-200 text-red-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" /> {error}
                </div>
              )}

              <div>
                <label className="block font-bold text-gray-700 mb-1">Proponent Company *</label>
                <select
                  required
                  value={form.proponent_id}
                  onChange={(e) => {
                    const pid = e.target.value;
                    const permit = permits.find((p) => p.proponent_id === pid)?.id || '';
                    setForm({ ...form, proponent_id: pid, permit_id: permit });
                  }}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:border-[#D4AF37] bg-white"
                >
                  {proponents.map((prop) => (
                    <option key={prop.id} value={prop.id}>
                      {prop.company_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Linked Permit</label>
                <select
                  value={form.permit_id}
                  onChange={(e) => setForm({ ...form, permit_id: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:border-[#D4AF37] bg-white"
                >
                  <option value="">— No linked permit —</option>
                  {proponentPermits.map((permit) => (
                    <option key={permit.id} value={permit.id}>
                      {permit.permit_number} ({permit.permit_type})
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
                  disabled={saving}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-lg disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-[#0A2E24] hover:bg-[#1A4A3A] text-[#D4AF37] font-bold rounded-lg disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Save Schedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};