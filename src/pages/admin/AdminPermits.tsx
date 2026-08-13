import React, { useState, useEffect } from 'react';
import { FileCheck, Plus, Edit, Trash2, X, Download, ExternalLink, Search } from 'lucide-react';
import { Permit, PermitType, PermitStatus } from '../../types';
import { getStorageData, saveStorageData } from '../../lib/storage';
import { PermitStatusBadge } from '../../components/common/StatusBadges';
import { DateRangeFilter, DateRange } from '../../components/common/DateRangeFilter';

export const AdminPermits: React.FC = () => {
  const [data, setData] = useState(() => getStorageData());
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState<DateRange | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Permit | null>(null);

  const [form, setForm] = useState<Partial<Permit>>({
    proponent_id: '',
    permit_number: '',
    permit_type: 'EPA Environmental Permit',
    issue_date: new Date().toISOString().split('T')[0],
    expiry_date: '',
    permit_status: 'Active',
    permit_file_url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
  });

  useEffect(() => {
    const handleUpdate = () => setData(getStorageData());
    window.addEventListener('aec_storage_updated', handleUpdate);
    return () => window.removeEventListener('aec_storage_updated', handleUpdate);
  }, []);

  const handleOpenAdd = () => {
    setEditingItem(null);
    const defaultProp = data.proponents[0]?.id || '';
    setForm({
      proponent_id: defaultProp,
      permit_number: `EPA-SL-${Math.floor(100 + Math.random() * 900)}-2026`,
      permit_type: 'EPA Environmental Permit',
      issue_date: new Date().toISOString().split('T')[0],
      expiry_date: '2027-08-30',
      permit_status: 'Active',
      permit_file_url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (item: Permit) => {
    setEditingItem(item);
    setForm(item);
    setModalOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this permit record?')) {
      const currentData = getStorageData();
      currentData.permits = currentData.permits.filter((p) => p.id !== id);
      saveStorageData(currentData);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const currentData = getStorageData();
    const selectedProp = currentData.proponents.find((p) => p.id === form.proponent_id);
    const propName = selectedProp?.company_name || 'Unknown Proponent';

    if (editingItem) {
      currentData.permits = currentData.permits.map((p) =>
        p.id === editingItem.id
          ? { ...(form as Permit), proponent_name: propName, updated_date: new Date().toISOString() }
          : p
      );
    } else {
      const newPermit: Permit = {
        ...(form as Permit),
        id: 'perm-' + Math.random().toString(36).substring(2, 9),
        proponent_name: propName,
        created_date: new Date().toISOString(),
      };
      currentData.permits.unshift(newPermit);
    }

    saveStorageData(currentData);
    setModalOpen(false);
  };

  const filteredPermits = data.permits.filter((p) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      p.permit_number.toLowerCase().includes(term) ||
      p.proponent_name.toLowerCase().includes(term) ||
      p.permit_type.toLowerCase().includes(term);

    if (!matchesSearch) return false;

    if (dateRange) {
      if (dateRange.startDate && (p.issue_date < dateRange.startDate && p.expiry_date < dateRange.startDate)) {
        return false;
      }
      if (dateRange.endDate && p.issue_date > dateRange.endDate) {
        return false;
      }
    }

    return true;
  });

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

      <DateRangeFilter onDateChange={(range) => setDateRange(range)} label="Filter Permits by Issue / Expiry Date Range" />

      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3">
        <Search className="w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search by permit number, proponent or permit type..."
          className="w-full text-xs focus:outline-none"
        />
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
              {filteredPermits.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-gray-500 italic">
                    No permit records found.
                  </td>
                </tr>
              ) : (
                filteredPermits.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-3 font-mono font-bold text-[#0A2E24]">{p.permit_number}</td>
                    <td className="p-3 font-semibold">{p.proponent_name}</td>
                    <td className="p-3">{p.permit_type}</td>
                    <td className="p-3 font-mono text-[11px]">{p.issue_date}</td>
                    <td className="p-3 font-mono text-[11px]">{p.expiry_date}</td>
                    <td className="p-3">
                      <PermitStatusBadge status={p.permit_status} />
                    </td>
                    <td className="p-3">
                      {p.permit_file_url ? (
                        <a
                          href={p.permit_file_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[#0A2E24] hover:text-[#D4AF37] font-bold text-[11px] inline-flex items-center gap-1"
                        >
                          <Download className="w-3.5 h-3.5 text-[#D4AF37]" /> File
                        </a>
                      ) : (
                        <span className="text-gray-400 text-[10px]">No File</span>
                      )}
                    </td>
                    <td className="p-3 text-right space-x-2">
                      <button
                        onClick={() => handleOpenEdit(p)}
                        className="p-1.5 bg-gray-100 hover:bg-[#D4AF37]/20 text-[#0A2E24] rounded-lg transition-colors"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(p.id)}
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
                {editingItem ? 'Edit Permit Record' : 'Issue New EPA Permit'}
              </h3>
              <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-gray-700 mb-1">Linked Proponent Company *</label>
                <select
                  required
                  value={form.proponent_id}
                  onChange={(e) => setForm({ ...form, proponent_id: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:border-[#D4AF37] bg-white"
                >
                  {data.proponents.map((prop) => (
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
                  value={form.permit_status}
                  onChange={(e) => setForm({ ...form, permit_status: e.target.value as PermitStatus })}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:border-[#D4AF37] bg-white"
                >
                  <option value="Active">Active</option>
                  <option value="Expired">Expired</option>
                  <option value="Suspended">Suspended</option>
                  <option value="Pending Renewal">Pending Renewal</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Permit Document File URL</label>
                <input
                  type="text"
                  value={form.permit_file_url}
                  onChange={(e) => setForm({ ...form, permit_file_url: e.target.value })}
                  placeholder="https://..."
                  className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:border-[#D4AF37] font-mono text-[11px]"
                />
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
                  Save Permit Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
