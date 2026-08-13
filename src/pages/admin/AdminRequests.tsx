import React, { useState, useEffect } from 'react';
import { MessageSquare, Check, X, Phone, Mail, MessageCircle, Search } from 'lucide-react';
import { ServiceRequest, ServiceRequestStatus } from '../../types';
import { getStorageData, saveStorageData } from '../../lib/storage';

export const AdminRequests: React.FC = () => {
  const [data, setData] = useState(() => getStorageData());
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const handleUpdate = () => setData(getStorageData());
    window.addEventListener('aec_storage_updated', handleUpdate);
    return () => window.removeEventListener('aec_storage_updated', handleUpdate);
  }, []);

  const handleUpdateStatus = (id: string, status: ServiceRequestStatus) => {
    const currentData = getStorageData();
    currentData.requests = currentData.requests.map((r) => (r.id === id ? { ...r, status } : r));
    saveStorageData(currentData);
  };

  const filteredRequests = data.requests.filter((r) => {
    const term = searchTerm.toLowerCase();
    return (
      r.full_name.toLowerCase().includes(term) ||
      r.company_name.toLowerCase().includes(term) ||
      r.service_needed.toLowerCase().includes(term) ||
      r.project_location.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6 font-sans">
      <div className="pb-4 border-b border-gray-200">
        <h1 className="font-heading font-extrabold text-2xl text-[#0A2E24] flex items-center gap-2">
          <MessageSquare className="w-6 h-6 text-[#D4AF37]" /> Public Service Requests Inbox
        </h1>
        <p className="text-xs text-gray-600 mt-0.5">Manage incoming website service enquiries for EPA audits, ESIA studies, and compliance advisory</p>
      </div>

      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3">
        <Search className="w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search enquiries by applicant name, company, or service..."
          className="w-full text-xs focus:outline-none"
        />
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#0A2E24] text-[#D4AF37] text-[11px] font-mono uppercase">
                <th className="p-3">Applicant & Company</th>
                <th className="p-3">Service Requested</th>
                <th className="p-3">Location & Details</th>
                <th className="p-3">Contact</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs text-gray-700">
              {filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-gray-500 italic">
                    No service requests found.
                  </td>
                </tr>
              ) : (
                filteredRequests.map((req) => (
                  <tr key={req.id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-3 font-bold text-[#0A2E24]">
                      {req.full_name}
                      <p className="text-[10px] font-normal text-gray-500">{req.company_name}</p>
                    </td>
                    <td className="p-3 font-semibold">{req.service_needed}</td>
                    <td className="p-3 max-w-xs space-y-0.5">
                      <p className="font-mono text-[10px] text-[#0A2E24]">{req.project_location}</p>
                      <p className="text-[11px] text-gray-600 line-clamp-2">{req.message}</p>
                    </td>
                    <td className="p-3 space-y-1">
                      <p className="font-mono text-[10px]">{req.phone}</p>
                      <p className="text-gray-500 text-[10px]">{req.email}</p>
                      {req.whatsapp_number && (
                        <a
                          href={`https://wa.me/${req.whatsapp_number.replace(/[^0-9]/g, '')}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[10px] text-emerald-700 font-bold hover:underline"
                        >
                          <MessageCircle className="w-3 h-3" /> WhatsApp
                        </a>
                      )}
                    </td>
                    <td className="p-3">
                      <select
                        value={req.status}
                        onChange={(e) => handleUpdateStatus(req.id, e.target.value as ServiceRequestStatus)}
                        className={`p-1 rounded text-[10px] font-mono font-bold border ${
                          req.status === 'New'
                            ? 'bg-purple-100 text-purple-800 border-purple-300'
                            : req.status === 'In Review'
                            ? 'bg-amber-100 text-amber-800 border-amber-300'
                            : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        }`}
                      >
                        <option value="New">New</option>
                        <option value="In Review">In Review</option>
                        <option value="Contacted">Contacted</option>
                        <option value="Closed">Closed</option>
                      </select>
                    </td>
                    <td className="p-3 text-right">
                      <a
                        href={`mailto:${req.email}?subject=AEC Service Proposal: ${req.service_needed}`}
                        className="px-2.5 py-1 bg-[#0A2E24] text-[#D4AF37] font-bold text-[10px] rounded hover:bg-[#1A4A3A]"
                      >
                        Send Email Reply
                      </a>
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
