import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, Video, Search, Loader2, AlertCircle, CheckCircle2, MessageCircle } from 'lucide-react';
import { adminApi, workflowsApi } from '../../lib/api';
import type { BookingWorkflowAction } from '../../lib/api/workflows';
import type { Booking, BookingStatus, Pagination } from '../../types';

function errMsg(e: unknown): string {
  return e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : 'Request failed. Please try again.';
}

const PER_PAGE = 25;

const STATUS_STYLES: Record<BookingStatus, string> = {
  Pending: 'bg-amber-100 text-amber-800 border-amber-300',
  Confirmed: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  Rescheduled: 'bg-blue-100 text-blue-800 border-blue-300',
  Completed: 'bg-blue-100 text-blue-800 border-blue-300',
  Cancelled: 'bg-red-100 text-red-800 border-red-300',
};

export const AdminBookings: React.FC = () => {
  const [bookings, setBookings] = useState<Booking[]>([]);
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
      const res = await adminApi.listBookings({
        page,
        per_page: PER_PAGE,
        q: searchTerm || undefined,
        booking_status: filterStatus !== 'all' ? filterStatus : undefined,
      });
      setBookings(res.items);
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

  const WORKFLOW_BY_STATUS: Partial<Record<BookingStatus, BookingWorkflowAction>> = {
    Confirmed: 'confirm',
    Rescheduled: 'reschedule',
    Completed: 'complete',
    Cancelled: 'cancel',
  };

  const WORKFLOW_SOURCES: Record<BookingWorkflowAction, BookingStatus[]> = {
    confirm: ['Pending', 'Rescheduled'],
    reschedule: ['Pending', 'Confirmed'],
    complete: ['Confirmed', 'Rescheduled'],
    cancel: ['Pending', 'Confirmed', 'Rescheduled'],
  };

  const handleUpdateStatus = async (id: string, booking_status: BookingStatus) => {
    setUpdatingId(id);
    setError(null);
    setSuccess(null);
    try {
      const current = bookings.find((b) => b.id === id)?.booking_status;
      const action = WORKFLOW_BY_STATUS[booking_status];
      const sources = action ? WORKFLOW_SOURCES[action] : null;
      if (action && sources && current && sources.includes(current)) {
        await workflowsApi.bookingWorkflow(id, action);
      } else {
        await adminApi.updateBooking(id, { booking_status });
      }
      setSuccess('Booking status updated.');
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
          <Calendar className="w-6 h-6 text-[#D4AF37]" /> Consultation Bookings Schedule
        </h1>
        <p className="text-xs text-gray-600 mt-0.5">Manage scheduled technical consultation sessions and Google Meet links</p>
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
            placeholder="Search bookings by proponent name, company, or session type..."
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
            <option value="Pending">Pending</option>
            <option value="Confirmed">Confirmed</option>
            <option value="Rescheduled">Rescheduled</option>
            <option value="Completed">Completed</option>
            <option value="Cancelled">Cancelled</option>
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
                <th className="p-3">Client / Company</th>
                <th className="p-3">Consultation Service</th>
                <th className="p-3">Date & Time</th>
                <th className="p-3">Meeting Link</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs text-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center">
                    <span className="inline-flex items-center gap-2 text-gray-500 italic">
                      <Loader2 className="w-4 h-4 text-[#D4AF37] animate-spin" /> Loading bookings…
                    </span>
                  </td>
                </tr>
              ) : bookings.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-gray-500 italic">
                    No consultation bookings found.
                  </td>
                </tr>
              ) : (
                bookings.map((b) => (
                  <tr key={b.id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-3 font-bold text-[#0A2E24]">
                      {b.full_name}
                      <p className="text-[10px] font-normal text-gray-500">{b.company_name}</p>
                    </td>
                    <td className="p-3 font-semibold">{b.service_needed}</td>
                    <td className="p-3 font-mono text-[11px]">
                      {b.preferred_date} @ {b.preferred_time}
                    </td>
                    <td className="p-3">
                      {b.meeting_link ? (
                        <a
                          href={b.meeting_link}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-600 font-mono text-[10px] underline inline-flex items-center gap-1"
                        >
                          <Video className="w-3 h-3 text-blue-600" /> Join Call
                        </a>
                      ) : (
                        <span className="text-gray-400 text-[10px]">In-Person Session</span>
                      )}
                    </td>
                    <td className="p-3">
                      <select
                        value={b.booking_status}
                        disabled={updatingId === b.id}
                        onChange={(e) => handleUpdateStatus(b.id, e.target.value as BookingStatus)}
                        className={`p-1 rounded text-[10px] font-mono font-bold border ${STATUS_STYLES[b.booking_status] || 'bg-gray-100 text-gray-700 border-gray-300'} disabled:opacity-50`}
                      >
                        <option value="Pending">Pending</option>
                        <option value="Confirmed">Confirmed</option>
                        <option value="Rescheduled">Rescheduled</option>
                        <option value="Completed">Completed</option>
                        <option value="Cancelled">Cancelled</option>
                      </select>
                    </td>
                    <td className="p-3 text-right">
                      {b.whatsapp_number && (
                        <a
                          href={`https://wa.me/${b.whatsapp_number.replace(/[^0-9]/g, '')}`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2.5 py-1 bg-emerald-700 text-white font-bold text-[10px] rounded hover:bg-emerald-800 inline-flex items-center gap-1"
                        >
                          <MessageCircle className="w-3 h-3" /> WhatsApp
                        </a>
                      )}
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