import React, { useState, useEffect, useCallback } from 'react';
import { MessageSquare, Search, CheckCircle2, ShieldCheck, RefreshCw, PhoneCall, Loader2, AlertCircle, RotateCcw } from 'lucide-react';
import type { NotificationLog, Pagination } from '../../types';
import { workflowsApi } from '../../lib/api';

function errMsg(e: unknown): string {
  return e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : 'Request failed. Please try again.';
}

const PER_PAGE = 100;

export const AdminWhatsAppLogs: React.FC = () => {
  const [items, setItems] = useState<NotificationLog[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await workflowsApi.listNotificationLogs({ page, per_page: PER_PAGE, channel: 'WhatsApp' });
      setItems(res.items);
      setPagination(res.pagination);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 3000);
    return () => clearTimeout(t);
  }, [message]);

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    setPage(1);
  };

  const waLogs = items;

  const plus231Count = waLogs.filter((l) => (l.recipient || '').replace(/[^0-9]/g, '').startsWith('231')).length;
  const deliveredCount = waLogs.filter((l) => l.status === 'Sent').length;

  const filteredLogs = waLogs.filter((l) => {
    const term = searchTerm.toLowerCase();
    return (
      (l.recipient || '').toLowerCase().includes(term) ||
      (l.subject || '').toLowerCase().includes(term) ||
      (l.notification_type || '').toLowerCase().includes(term)
    );
  });

  const handleRetry = async (id: string) => {
    setRetryingId(id);
    setError(null);
    setMessage(null);
    try {
      const res = await workflowsApi.retryNotification(id);
      setMessage(`Notification re-dispatched successfully (attempt #${res.attempt}).`);
      load();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setRetryingId(null);
    }
  };

  return (
    <div className="space-y-6 font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-200">
        <div>
          <h1 className="font-heading font-extrabold text-2xl text-[#0A2E24] flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-[#D4AF37]" /> WhatsApp Instant Alert Logs
          </h1>
          <p className="text-xs text-gray-600 mt-0.5">
            Audit history of real-time WhatsApp mobile notifications dispatched to proponent directors and compliance managers
          </p>
        </div>

        <button
          onClick={load}
          className="px-3.5 py-2 bg-[#0A2E24] hover:bg-[#1A4A3A] text-[#D4AF37] font-bold text-xs rounded-xl transition-all shadow-xs flex items-center gap-2 w-fit"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh Dispatch Feed
        </button>
      </div>

      {error && (
        <div className="bg-red-50 p-3 rounded-xl border border-red-200 text-red-700 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {message && (
        <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 shrink-0" /> {message}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex items-center gap-3">
          <div className="p-3 bg-emerald-50 text-emerald-700 rounded-lg">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-mono uppercase text-gray-500">WhatsApp Messages Sent</p>
            <p className="text-xl font-bold text-[#0A2E24]">{waLogs.length}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex items-center gap-3">
          <div className="p-3 bg-emerald-50 text-emerald-700 rounded-lg">
            <PhoneCall className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-mono uppercase text-gray-500">Liberia Country Code</p>
            <p className="text-xl font-bold text-[#0A2E24]">{plus231Count} +231 Numbers</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex items-center gap-3">
          <div className="p-3 bg-amber-50 text-amber-700 rounded-lg">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-mono uppercase text-gray-500">Instant Alert Engine</p>
            <p className="text-xl font-bold text-emerald-700">{deliveredCount} Delivered</p>
          </div>
        </div>
      </div>

      {/* Search Filter */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3">
        <Search className="w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Filter WhatsApp logs by phone number, message text, or alert type..."
          className="w-full text-xs focus:outline-none"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#0A2E24] text-[#D4AF37] text-[11px] font-mono uppercase">
                <th className="p-3">Timestamp</th>
                <th className="p-3">Alert Type</th>
                <th className="p-3">Recipient Phone</th>
                <th className="p-3">Message Preview</th>
                <th className="p-3">Status</th>
                <th className="p-3">Error</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs text-gray-700 font-mono">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center">
                    <div className="flex items-center justify-center gap-2 text-gray-400">
                      <Loader2 className="w-4 h-4 animate-spin" /> Loading WhatsApp dispatch logs…
                    </div>
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-500 italic">
                    No WhatsApp alert logs recorded.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-3 text-[11px] text-gray-500">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="p-3 text-[#0A2E24] font-bold">{log.notification_type}</td>
                    <td className="p-3 font-semibold text-emerald-800 flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      {log.recipient}
                    </td>
                    <td className="p-3 text-gray-600 max-w-xs truncate">{log.subject || '—'}</td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold flex items-center gap-1 w-fit ${
                          log.status === 'Sent'
                            ? 'bg-emerald-100 text-emerald-800'
                            : log.status === 'Failed'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {log.status === 'Sent' && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                        {log.status}
                      </span>
                    </td>
                    <td className="p-3 text-[11px] text-red-600 max-w-xs truncate">{log.error_message || '—'}</td>
                    <td className="p-3">
                      {(log.status === 'Failed' || log.status === 'Pending') && (
                        <button
                          onClick={() => handleRetry(log.id)}
                          disabled={retryingId !== null}
                          className="px-2 py-1 bg-[#0A2E24] hover:bg-[#1A4A3A] text-[#D4AF37] font-bold text-[10px] rounded-lg flex items-center gap-1 disabled:opacity-50"
                        >
                          <RotateCcw className={`w-3 h-3 ${retryingId === log.id ? 'animate-spin' : ''}`} />
                          {retryingId === log.id ? 'Retrying…' : 'Retry'}
                        </button>
                      )}
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
    </div>
  );
};