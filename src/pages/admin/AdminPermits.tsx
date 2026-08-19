import React, { useState, useEffect, useCallback } from 'react';
import { FileCheck, Plus, Edit, Trash2, X, Search, Loader2, AlertCircle } from 'lucide-react';
import type { Permit, PermitType, PermitStatus, Proponent, Pagination } from '../../types';
import { adminApi } from '../../lib/api';
import { PermitStatusBadge } from '../../components/common/StatusBadges';
import { DateRangeFilter, DateRange } from '../../components/common/DateRangeFilter';

function errMsg(e: unknown): string {
  return e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : 'Request failed. Please try again.';
}

const PER_PAGE = 25;

export const AdminPermits: React.FC = () => {
  const [items, setItems] = useState<Permit[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');
  const [proponents, setProponents] = useState<Proponent[]>([]);
  const [dateRange, setDateRange] = useState<DateRange | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Permit | null>(null);

  const [form, setForm] = useState<Partial<Permit>>({
    proponent_id: '',
    permit_number: '',
    permit_type: 'EPA Environmental Permit',
    issue_date: new Date().toISOString().split('T')[0],
    expiry_date: '',
    status: 'Active',
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.listPermits({
        page,
        per_page: PER_PAGE,
        q: searchTerm || undefined,
        status: filterStatus || undefined,
        type: filterType || undefined,
      });
      setItems(res.items);
      setPagination(res.pagination);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, [page, searchTerm, filterStatus, filterType]);

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

  const handleOpenAdd = () => {
    setEditingItem(null);
    const defaultProp = proponents[0]?.id || '';
    setForm({
      proponent_id: defaultProp,
      permit_number: `EPA-SL-${Math.floor(100 + Math.random() * 900)}-2026`,
      permit_type: 'EPA Environmental Permit',
      issue_date: new Date().toISOString().split('T')[0],
      expiry_date: '2027-08-30',
      status: 'Active',
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (item: Permit) => {
    setEditingItem(item);
    setForm(item);
    setModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this permit record?')) return;
    setSaving(true);
    setError(null);
    try {
      await adminApi.deletePermit(id);
      setSuccess('Permit deleted successfully.');
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
        permit_number: form.permit_number ?? '',
        permit_type: form.permit_type ?? 'EPA Environmental Permit',
        status: form.status ?? 'Active',
        issue_date: form.issue_date || null,
        expiry_date: form.expiry_date || null,
      };
      if (editingItem) {
        await adminApi.updatePermit(editingItem.id, payload);
        setSuccess('Permit updated successfully.');
      } else {
        await adminApi.createPermit(payload);
        setSuccess('Permit created successfully.');
      }
      setModalOpen(false);
      load();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setSaving(false);
    }
  };

  const visiblePermits = dateRange
    ? items.filter((p) => {
        if (dateRange.startDate && (p.issue_date < dateRange.startDate && p.expiry_date < dateRange.startDate)) {
          return false;
        }
        if (dateRange.endDate && p.issue_date > dateRange.endDate) {
          return false;
        }
        return true;
      })
    : items;

  return (
    <div className="space-y-6 font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-200">
        <div>
          <h1 className="font-heading font-extrabold text-2xl text-[#0A2E24] flex items-center gap-2">
            <FileCheck className="w-6 h-6 text-[#D4AF37]" /> EPA Permits Management
          </h1>
          <p className="text-xs text-gray-600 mt-0.5">Manage environmental permits, mining licenses, issue dates and expiry validity</p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="px-4 py-2.5 bg-[#0A2E24] hover:bg-[#1A4A3A] text-[#D4AF37] font-heading font-bold text-xs rounded-xl transition-all shadow-md flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" /> Issue New Permit
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

      <DateRangeFilter onDateChange={(range) => setDateRange(range)} label="Filter Permits by Issue / Expiry Date Range" />

      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="flex items-center gap-3 flex-1">
          <Search className="w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search by permit number, proponent or permit type..."
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
          <option value="Active">Active</option>
          <option value="Expired">Expired</option>
          <option value="Suspended">Suspended</option>
          <option value="Pending Renewal">Pending Renewal</option>
        </select>
        <select
          value={filterType}
          onChange={(e) => {
            setFilterType(e.target.value);
            setPage(1);
          }}
          className="p-2 border border-gray-300 rounded-lg text-xs bg-white focus:outline-none focus:border-[#D4AF37]"
        >
          <option value="">All Types</option>
          <option value="EPA Environmental Permit">EPA Environmental Permit</option>
          <option value="Mining License">Mining License</option>
          <option value="Environmental Impact License">Environmental Impact License</option>
          <option value="Waste Management Permit">Waste Management Permit</option>
          <option value="Other">Other</option>
        </select>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#0A2E24] text-[#D4AF37] text-[11px] font-mono uppercase">
                <th className="p-3">Permit Number</th>
                <th className="p-3">Proponent Company</th>
                <th className="p-3">Permit Type</th>
                <th className="p-3">Issue Date</th>
                <th className="p-3">Expiry Date</th>
                <th className="p-3">Status</th>
                <th className="p-3">Document</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs text-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center">
                    <div className="flex items-center justify-center gap-2 text-gray-400">
                      <Loader2 className="w-4 h-4 animate-spin" /> Loading permits…
                    </div>
                  </td>
                </tr>
              ) : visiblePermits.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-gray-500 italic">
                    No permit records found.
                  </td>
                </tr>
              ) : (
                visiblePermits.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-3 font-mono font-bold text-[#0A2E24]">{p.permit_number}</td>
                    <td className="p-3 font-semibold">{p.proponent_name || '—'}</td>
                    <td className="p-3">{p.permit_type}</td>
                    <td className="p-3 font-mono text-[11px]">{p.issue_date}</td>
                    <td className="p-3 font-mono text-[11px]">{p.expiry_date}</td>
                    <td className="p-3">
                      <PermitStatusBadge status={p.status} />
                    </td>
                    <td className="p-3">
                      {p.has_file ? (
                        <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-mono font-bold text-[10px]">
                          On file
                        </span>
                      ) : (
                        <span className="text-gray-400 text-[10px]">—</span>
                      )}
                    </td>
                    <td className="p-3 text-right space-x-2">
                      <button
                        onClick={() => handleOpenEdit(p)}
                        disabled={saving}
                        className="p-1.5 bg-gray-100 hover:bg-[#D4AF37]/20 text-[#0A2E24] rounded-lg transition-colors disabled:opacity-50"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(p.id)}
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
                {editingItem ? 'Edit Permit Record' : 'Issue New EPA Permit'}
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
                <label className="block font-bold text-gray-700 mb-1">Linked Proponent Company *</label>
                <select
                  required
                  value={form.proponent_id}
                  onChange={(e) => setForm({ ...form, proponent_id: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:border-[#D4AF37] bg-white"
                >
                  {proponents.map((prop) => (
                    <option key={prop.id} value={prop.id}>
                      {prop.company_name} ({prop.contact_person})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Permit Number *</label>
                  <input
                    type="text"
                    required
                    value={form.permit_number}
                    onChange={(e) => setForm({ ...form, permit_number: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:border-[#D4AF37] font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Permit Type *</label>
                  <select
                    value={form.permit_type}
                    onChange={(e) => setForm({ ...form, permit_type: e.target.value as PermitType })}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:border-[#D4AF37] bg-white"
                  >
                    <option value="EPA Environmental Permit">EPA Environmental Permit</option>
                    <option value="Mining License">Mining License</option>
                    <option value="Environmental Impact License">Environmental Impact License</option>
                    <option value="Waste Management Permit">Waste Management Permit</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Issue Date *</label>
                  <input
                    type="date"
                    required
                    value={form.issue_date}
                    onChange={(e) => setForm({ ...form, issue_date: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Expiry Date *</label>
                  <input
                    type="date"
                    required
                    value={form.expiry_date}
                    onChange={(e) => setForm({ ...form, expiry_date: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Permit Status</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value as PermitStatus })}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:border-[#D4AF37] bg-white"
                >
                  <option value="Active">Active</option>
                  <option value="Expired">Expired</option>
                  <option value="Suspended">Suspended</option>
                  <option value="Pending Renewal">Pending Renewal</option>
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
                  {saving ? 'Saving…' : 'Save Permit Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};