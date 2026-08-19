import React, { useState, useEffect, useCallback } from 'react';
import { Upload, CheckCircle2, Download, Loader2, AlertCircle, Trash2 } from 'lucide-react';
import { adminApi, workflowsApi, saveDownload } from '../../lib/api';
import type { Evidence, Pagination } from '../../types';

function errMsg(e: unknown): string {
  return e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : 'Request failed. Please try again.';
}

const PER_PAGE = 25;

export const AdminEvidence: React.FC = () => {
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [page, setPage] = useState(1);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<Evidence | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.listEvidence({
        page,
        per_page: PER_PAGE,
        review_status: filterStatus !== 'all' ? filterStatus : undefined,
      });
      setEvidence(res.items);
      setPagination(res.pagination);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, [page, filterStatus]);

  useEffect(() => {
    load();
  }, [load]);

  const handleReview = async (status: 'Approved' | 'Rejected' | 'More action needed') => {
    if (!selectedItem) return;
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      await workflowsApi.reviewEvidence(selectedItem.id, {
        status,
        review_notes: reviewNotes || null,
        admin_comment: null,
      });
      setSuccess(`Evidence ${status}.`);
      setSelectedItem(null);
      setReviewNotes('');
      await load();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownload = async (id: string) => {
    setDownloadingId(id);
    setError(null);
    try {
      await saveDownload(`/admin/evidence/${id}/file`);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this evidence record?')) return;
    setDeletingId(id);
    setError(null);
    setSuccess(null);
    try {
      await adminApi.deleteEvidence(id);
      setSuccess('Evidence record deleted.');
      await load();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setDeletingId(null);
    }
  };

  const totalPages = pagination?.total_pages ?? 1;

  return (
    <div className="space-y-6 font-sans">
      <div className="pb-4 border-b border-gray-200">
        <h1 className="font-heading font-extrabold text-2xl text-[#0A2E24] flex items-center gap-2">
          <Upload className="w-6 h-6 text-[#D4AF37]" /> Corrective Action Evidence Submissions
        </h1>
        <p className="text-xs text-gray-600 mt-0.5">
          Review documents, photos, laboratory test certificates, and site inspection evidence submitted by proponents
        </p>
      </div>

      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 self-end sm:self-auto text-xs">
          <span className="font-mono text-[10px] text-gray-500 font-bold uppercase">Review Status Filter:</span>
          <select
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value);
              setPage(1);
            }}
            className="p-1.5 border border-gray-300 rounded-lg bg-white font-mono text-xs focus:outline-none focus:border-[#D4AF37]"
          >
            <option value="all">All Statuses</option>
            <option value="Pending review">Pending review</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
            <option value="More action needed">More action needed</option>
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
                <th className="p-3">Proponent Company</th>
                <th className="p-3">Title & Area</th>
                <th className="p-3">Uploaded Date</th>
                <th className="p-3">Document</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Review Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs text-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center">
                    <span className="inline-flex items-center gap-2 text-gray-500 italic">
                      <Loader2 className="w-4 h-4 text-[#D4AF37] animate-spin" /> Loading evidence…
                    </span>
                  </td>
                </tr>
              ) : evidence.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-gray-500 italic">
                    No evidence records submitted yet.
                  </td>
                </tr>
              ) : (
                evidence.map((ev) => (
                  <tr key={ev.id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-3 font-bold text-[#0A2E24]">{ev.proponent_name}</td>
                    <td className="p-3 space-y-0.5">
                      <p className="font-bold text-gray-900">{ev.evidence_title}</p>
                      <p className="text-[10px] text-gray-500 max-w-xs truncate">{ev.description}</p>
                      {ev.review_notes && (
                        <p className="text-[10px] text-amber-700 italic">Review notes: {ev.review_notes}</p>
                      )}
                    </td>
                    <td className="p-3 font-mono text-[11px]">{ev.created_at ? ev.created_at.split('T')[0] : ''}</td>
                    <td className="p-3">
                      {ev.has_file ? (
                        <button
                          onClick={() => handleDownload(ev.id)}
                          disabled={downloadingId !== null}
                          className="text-[#0A2E24] hover:text-[#D4AF37] font-bold text-[11px] inline-flex items-center gap-1 disabled:opacity-50"
                        >
                          {downloadingId === ev.id ? (
                            <Loader2 className="w-3.5 h-3.5 text-[#D4AF37] animate-spin" />
                          ) : (
                            <Download className="w-3.5 h-3.5 text-[#D4AF37]" />
                          )}
                          {downloadingId === ev.id ? 'Downloading…' : 'Download File'}
                        </button>
                      ) : (
                        <span className="text-gray-400 text-[10px]">No File</span>
                      )}
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                          ev.review_status === 'Approved'
                            ? 'bg-emerald-100 text-emerald-800'
                            : ev.review_status === 'Rejected'
                            ? 'bg-red-100 text-red-800'
                            : ev.review_status === 'More action needed'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {ev.review_status}
                      </span>
                    </td>
                    <td className="p-3 text-right space-x-2">
                      <button
                        onClick={() => {
                          setSelectedItem(ev);
                          setReviewNotes(ev.review_notes || '');
                          setError(null);
                        }}
                        className="px-3 py-1 bg-[#0A2E24] text-[#D4AF37] font-bold rounded text-xs hover:bg-[#1A4A3A]"
                      >
                        Review
                      </button>
                      <button
                        onClick={() => handleDelete(ev.id)}
                        disabled={deletingId !== null}
                        className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors disabled:opacity-50"
                      >
                        {deletingId === ev.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                      </button>
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

      {/* Review Modal */}
      {selectedItem && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-gray-200">
            <h3 className="font-heading font-bold text-lg text-[#0A2E24]">
              Review Evidence Submission
            </h3>

            <div className="bg-gray-50 p-4 rounded-xl space-y-2 text-xs">
              <p><strong className="text-gray-500">Proponent:</strong> {selectedItem.proponent_name}</p>
              <p><strong className="text-gray-500">Title:</strong> {selectedItem.evidence_title}</p>
              <p><strong className="text-gray-500">Details:</strong> {selectedItem.description}</p>
              <p>
                <strong className="text-gray-500">File:</strong>{' '}
                {selectedItem.has_file ? (
                  <button
                    onClick={() => handleDownload(selectedItem.id)}
                    disabled={downloadingId !== null}
                    className="text-blue-600 underline disabled:opacity-50"
                  >
                    {downloadingId === selectedItem.id ? 'Downloading…' : 'Download Attachment'}
                  </button>
                ) : (
                  <span className="text-gray-400">No file uploaded</span>
                )}
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Auditor Feedback / Notes</label>
              <textarea
                rows={3}
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder="Enter feedback regarding compliance verification..."
                className="w-full p-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:border-[#D4AF37]"
              />
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button
                onClick={() => setSelectedItem(null)}
                disabled={submitting}
                className="px-3 py-1.5 bg-gray-100 text-gray-700 text-xs font-bold rounded-lg disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleReview('Rejected')}
                disabled={submitting}
                className="px-3 py-1.5 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                Reject
              </button>
              <button
                onClick={() => handleReview('More action needed')}
                disabled={submitting}
                className="px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                More Action Needed
              </button>
              <button
                onClick={() => handleReview('Approved')}
                disabled={submitting}
                className="px-3 py-1.5 bg-emerald-700 text-white text-xs font-bold rounded-lg hover:bg-emerald-800 disabled:opacity-50"
              >
                {submitting ? 'Saving…' : 'Approve & Mark Verified'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};