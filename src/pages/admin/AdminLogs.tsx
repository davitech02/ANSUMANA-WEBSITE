import React, { useState, useEffect, useCallback } from 'react';
import { History, Search, Loader2, AlertCircle } from 'lucide-react';
import type { AuditLog, Pagination } from '../../types';
import { workflowsApi } from '../../lib/api';

function errMsg(e: unknown): string {
  return e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : 'Request failed. Please try again.';
}

const PER_PAGE = 25;

export const AdminLogs: React.FC = () => {
  const [items, setItems] = useState<AuditLog[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await workflowsApi.listAuditLogs({ page, per_page: PER_PAGE });
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

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    setPage(1);
  };

  const filteredLogs = items.filter((l) => {
    const term = searchTerm.toLowerCase();
    return (
      (l.action || '').toLowerCase().includes(term) ||
      (l.entity_type || '').toLowerCase().includes(term) ||
      (l.entity_id || '').toLowerCase().includes(term) ||
      (l.ip_address || '').toLowerCase().includes(term) ||
      (l.user_agent || '').toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6 font-sans">
      <div className="pb-4 border-b border-gray-200">
        <h1 className="font-heading font-extrabold text-2xl text-[#0A2E24] flex items-center gap-2">
          <History className="w-6 h-6 text-[#D4AF37]" /> Reminder Engine Audit Trail Logs
        </h1>
        <p className="text-xs text-gray-600 mt-0.5">Audit log of all dispatched statutory report reminders, WhatsApp alerts, and booking confirmations</p>
      </div>

      {error && (
        <div className="bg-red-50 p-3 rounded-xl border border-red-200 text-red-700 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3">
        <Search className="w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Filter audit logs by action, entity, user, IP address, or agent..."
          className="w-full text-xs focus:outline-none"
        />
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#0A2E24] text-[#D4AF37] text-[11px] font-mono uppercase">
                <th className="p-3">Timestamp</th>
                <th className="p-3">Action</th>
                <th className="p-3">Entity Type</th>
                <th className="p-3">Entity ID</th>
                <th className="p-3">User ID</th>
                <th className="p-3">IP Address</th>
                <th className="p-3">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs text-gray-700 font-mono">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center">
                    <div className="flex items-center justify-center gap-2 text-gray-400">
                      <Loader2 className="w-4 h-4 animate-spin" /> Loading audit trail…
                    </div>
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-gray-500 italic">
                    No audit log entries recorded.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-3 text-[11px] text-gray-500">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded bg-gray-100 text-[#0A2E24] font-bold text-[10px]">
                        {log.action}
                      </span>
                    </td>
                    <td className="p-3 text-[#0A2E24] font-bold">{log.entity_type || '—'}</td>
                    <td className="p-3 text-gray-700">{log.entity_id || '—'}</td>
                    <td className="p-3 text-gray-600">{log.user_id || '—'}</td>
                    <td className="p-3 text-gray-600">{log.ip_address || '—'}</td>
                    <td className="p-3 text-[11px] text-gray-500 max-w-xs truncate">
                      {log.details ? JSON.stringify(log.details) : '—'}
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