import React, { useState, useEffect, useCallback } from 'react';
import { MessageSquare, Search, Loader2, AlertCircle, CheckCircle2, MessageCircle } from 'lucide-react';
import { adminApi } from '../../lib/api';
import type { ServiceRequest, RequestStatus, Pagination } from '../../types';

function errMsg(e: unknown): string {
  return e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : 'Request failed. Please try again.';
}

const PER_PAGE = 25;

const STATUS_STYLES: Record<RequestStatus, string> = {
  New: 'bg-purple-100 text-purple-800 border-purple-300',
  Contacted: 'bg-blue-100 text-blue-800 border-blue-300',
  'In Review': 'bg-amber-100 text-amber-800 border-amber-300',
  'In progress': 'bg-cyan-100 text-cyan-800 border-cyan-300',
  Completed: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  Closed: 'bg-gray-100 text-gray-700 border-gray-300',
  Archived: 'bg-gray-100 text-gray-500 border-gray-300',
};

export const AdminRequests: React.FC = () => {
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.listServiceRequests({
        page,
        per_page: PER_PAGE,
        q: searchTerm || undefined,
        status: filterStatus !== 'all' ? filterStatus : undefined,
      });
      setRequests(res.items);
      setPagination(res.pagination);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, [page, searchTerm, filterStatus]);

  useEffect(() => {
    load();
  }, [load]);

  const handleUpdateStatus = async (id: string, status: RequestStatus) => {
    setUpdatingId(id);
    setError(null);
    setSuccess(null);
    try {
      await adminApi.updateServiceRequest(id, { status });
      setSuccess('Service request status updated.');
      await load();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setUpdatingId(null);
    }
  };

  const totalPages = pagination?.total_pages ?? 1;

  return (
    <div className="space-y-6 font-sans">
      <div className="pb-4 border-b border-gray-200">
        <h1 className="font-heading font-extrabold text-2xl text-[#0A2E24] flex items-center gap-2">
          <MessageSquare className="w-6 h-6 text-[#D4AF37]" /> Public Service Requests Inbox
        </h1>
        <p className="text-xs text-gray-600 mt-0.5">Manage incoming website service enquiries for EPA audits, ESIA studies, and compliance advisory</p>
      </div>

      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3 w-full sm:w-auto flex-1">
          <Search className="w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            placeholder="Search enquiries by applicant name, company, or service..."
            className="w-full text-xs focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto text-xs">
          <span className="font-mono text-[10px] text-gray-500 font-bold uppercase">Status Filter:</span>
          <select
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value);
              setPage(1);
            }}
            className="p-1.5 border border-gray-300 rounded-lg bg-white font-mono text-xs focus:outline-none focus:border-[#D4AF37]"
          >
            <option value="all">All Statuses</option>
            <option value="New">New</option>
            <option value="Contacted">Contacted</option>
            <option value="In Review">In Review</option>
            <option value="In progress">In progress</option>
            <option value="Completed">Completed</option>
            <option value="Closed">Closed</option>
            <option value="Archived">Archived</option>
          </select>
        </div>
      </div>

      {success && (
        <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" /> {success}
        </div>
      )}
      {error && (
        <div className="bg-red-50 p-4 rounded-xl border border-red-200 text-red-700 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

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
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center">
                    <span className="inline-flex items-center gap-2 text-gray-500 italic">
                      <Loader2 className="w-4 h-4 text-[#D4AF37] animate-spin" /> Loading requests…
                    </span>
                  </td>
                </tr>
              ) : requests.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-gray-500 italic">
                    No service requests found.
                  </td>
                </tr>
              ) : (
                requests.map((req) => (
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
                        disabled={updatingId === req.id}
                        onChange={(e) => handleUpdateStatus(req.id, e.target.value as RequestStatus)}
                        className={`p-1 rounded text-[10px] font-mono font-bold border ${STATUS_STYLES[req.status] || 'bg-gray-100 text-gray-700 border-gray-300'} disabled:opacity-50`}
                      >
                        <option value="New">New</option>
                        <option value="Contacted">Contacted</option>
                        <option value="In Review">In Review</option>
                        <option value="In progress">In progress</option>
                        <option value="Completed">Completed</option>
                        <option value="Closed">Closed</option>
                        <option value="Archived">Archived</option>
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

        <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-gray-200 text-xs">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1 || loading}
            className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-[#0A2E24] font-bold rounded-lg disabled:opacity-50"
          >
            Previous
          </button>
          <span className="font-mono text-[11px] text-gray-500 font-bold">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages || loading}
            className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-[#0A2E24] font-bold rounded-lg disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};