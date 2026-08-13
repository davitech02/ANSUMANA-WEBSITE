import React, { useState, useEffect } from 'react';
import { Building2, Search, Plus, Edit, Trash2, X, Check, Filter } from 'lucide-react';
import { Proponent, ProjectType } from '../../types';
import { getStorageData, saveStorageData } from '../../lib/storage';

export const AdminProponents: React.FC = () => {
  const [data, setData] = useState(() => getStorageData());
  const [searchTerm, setSearchTerm] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Proponent | null>(null);

  const [form, setForm] = useState<Partial<Proponent>>({
    company_name: '',
    contact_person: '',
    email: '',
    phone: '',
    whatsapp_number: '',
    project_type: 'Gold mining',
    county: 'Montserrado',
    district: 'Greater Monrovia',
    project_location: '',
    project_description: '',
    status: 'Active',
  });

  useEffect(() => {
    const handleUpdate = () => setData(getStorageData());
    window.addEventListener('aec_storage_updated', handleUpdate);
    return () => window.removeEventListener('aec_storage_updated', handleUpdate);
  }, []);

  const handleOpenAdd = () => {
    setEditingItem(null);
    setForm({
      company_name: '',
      contact_person: '',
      email: '',
      phone: '',
      whatsapp_number: '',
      project_type: 'Gold mining',
      county: 'Montserrado',
      district: 'Greater Monrovia',
      project_location: '',
      project_description: '',
      status: 'Active',
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (item: Proponent) => {
    setEditingItem(item);
    setForm(item);
    setModalOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this proponent company?')) {
      const currentData = getStorageData();
      currentData.proponents = currentData.proponents.filter((p) => p.id !== id);
      saveStorageData(currentData);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const currentData = getStorageData();

    if (editingItem) {
      currentData.proponents = currentData.proponents.map((p) =>
        p.id === editingItem.id ? { ...(form as Proponent), updated_date: new Date().toISOString() } : p
      );
    } else {
      const newProp: Proponent = {
        ...(form as Proponent),
        id: 'prop-' + Math.random().toString(36).substring(2, 9),
        created_date: new Date().toISOString(),
      };
      currentData.proponents.unshift(newProp);
    }

    saveStorageData(currentData);
    setModalOpen(false);
  };

  const filteredProponents = data.proponents.filter((p) => {
    const term = searchTerm.toLowerCase();
    return (
      p.company_name.toLowerCase().includes(term) ||
      p.contact_person.toLowerCase().includes(term) ||
      p.email.toLowerCase().includes(term) ||
      p.project_type.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6 font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-200">
        <div>
          <h1 className="font-heading font-extrabold text-2xl text-[#0A2E24] flex items-center gap-2">
            <Building2 className="w-6 h-6 text-[#D4AF37]" /> Proponent Companies Management
          </h1>
          <p className="text-xs text-gray-600 mt-0.5">Manage registered project proponents across Liberia counties</p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="px-4 py-2.5 bg-[#0A2E24] hover:bg-[#1A4A3A] text-[#D4AF37] font-heading font-bold text-xs rounded-xl transition-all shadow-md flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" /> Add New Proponent
        </button>
      </div>

      {/* Filter / Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3">
        <Search className="w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search proponents by company name, contact, email or sector..."
          className="w-full text-xs focus:outline-none"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#0A2E24] text-[#D4AF37] text-[11px] font-mono uppercase">
                <th className="p-3">Company Name</th>
                <th className="p-3">Contact Person</th>
                <th className="p-3">Sector</th>
                <th className="p-3">District / Province</th>
                <th className="p-3">Phone & Email</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs text-gray-700">
              {filteredProponents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-gray-500 italic">
                    No matching proponents found.
                  </td>
                </tr>
              ) : (
                filteredProponents.map((prop) => (
                  <tr key={prop.id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-3 font-bold text-[#0A2E24]">{prop.company_name}</td>
                    <td className="p-3">{prop.contact_person}</td>
                    <td className="p-3 font-mono text-[11px] text-gray-600">{prop.project_type}</td>
                    <td className="p-3">{prop.district}, {prop.county}</td>
                    <td className="p-3 space-y-0.5">
                      <p className="font-mono text-[10px]">{prop.phone}</p>
                      <p className="text-gray-500 text-[10px]">{prop.email}</p>
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                          prop.status === 'Active' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {prop.status}
                      </span>
                    </td>
                    <td className="p-3 text-right space-x-2">
                      <button
                        onClick={() => handleOpenEdit(prop)}
                        className="p-1.5 bg-gray-100 hover:bg-[#D4AF37]/20 text-[#0A2E24] rounded-lg transition-colors"
                        title="Edit Proponent"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(prop.id)}
                        className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors"
                        title="Delete Proponent"
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

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto border border-gray-200">
            <div className="flex items-center justify-between pb-3 border-b border-gray-200">
              <h3 className="font-heading font-bold text-lg text-[#0A2E24]">
                {editingItem ? 'Edit Proponent Company' : 'Add New Proponent'}
              </h3>
              <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-gray-700 mb-1">Company Name *</label>
                <input
                  type="text"
                  required
                  value={form.company_name}
                  onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:border-[#D4AF37]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Contact Person *</label>
                  <input
                    type="text"
                    required
                    value={form.contact_person}
                    onChange={(e) => setForm({ ...form, contact_person: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Email *</label>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Phone *</label>
                  <input
                    type="tel"
                    required
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">WhatsApp Number</label>
                  <input
                    type="tel"
                    value={form.whatsapp_number}
                    onChange={(e) => setForm({ ...form, whatsapp_number: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Project Sector *</label>
                  <select
                    value={form.project_type}
                    onChange={(e) => setForm({ ...form, project_type: e.target.value as ProjectType })}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:border-[#D4AF37] bg-white"
                  >
                    <option value="Cold storage">Cold storage</option>
                    <option value="Mining and quarry">Mining and quarry</option>
                    <option value="Gold mining">Gold mining</option>
                    <option value="Sand mining">Sand mining</option>
                    <option value="Construction">Construction</option>
                    <option value="Hotel">Hotel</option>
                    <option value="Factory">Factory</option>
                    <option value="Warehouse">Warehouse</option>
                    <option value="Exploration">Exploration</option>
                    <option value="Logging">Logging</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Status</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value as 'Active' | 'Inactive' })}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:border-[#D4AF37] bg-white"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">County / Province</label>
                  <input
                    type="text"
                    value={form.county}
                    onChange={(e) => setForm({ ...form, county: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">District</label>
                  <input
                    type="text"
                    value={form.district}
                    onChange={(e) => setForm({ ...form, district: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Project Site Location</label>
                <input
                  type="text"
                  value={form.project_location}
                  onChange={(e) => setForm({ ...form, project_location: e.target.value })}
                  placeholder="e.g. Baomahun Mining Lease Site B"
                  className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:border-[#D4AF37]"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Project Description</label>
                <textarea
                  rows={3}
                  value={form.project_description}
                  onChange={(e) => setForm({ ...form, project_description: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:border-[#D4AF37]"
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
                  Save Proponent
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
