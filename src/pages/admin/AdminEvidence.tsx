import React, { useState, useEffect } from 'react';
import { Upload, CheckCircle2, XCircle, FileText, Download, MessageSquare } from 'lucide-react';
import { EvidenceUpload, ReviewStatus } from '../../types';
import { getStorageData, saveStorageData } from '../../lib/storage';

export const AdminEvidence: React.FC = () => {
  const [data, setData] = useState(() => getStorageData());
  const [selectedItem, setSelectedItem] = useState<EvidenceUpload | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');

  useEffect(() => {
    const handleUpdate = () => setData(getStorageData());
    window.addEventListener('aec_storage_updated', handleUpdate);
    return () => window.removeEventListener('aec_storage_updated', handleUpdate);
  }, []);

  const handleUpdateStatus = (id: string, status: ReviewStatus) => {
    const currentData = getStorageData();
    currentData.evidence = currentData.evidence.map((e) => {
      if (e.id === id) {
        return {
          ...e,
          review_status: status,
          review_notes: reviewNotes || e.review_notes,
          reviewed_date: new Date().toISOString(),
        };
      }
      return e;
    });

    // Also if approved, mark associated finding as Verified
    const targetEvidence = currentData.evidence.find((e) => e.id === id);
    if (targetEvidence && status === 'Approved' && targetEvidence.finding_id) {
      currentData.findings = currentData.findings.map((f) =>
        f.id === targetEvidence.finding_id ? { ...f, action_status: 'Verified' } : f
      );
    }

    saveStorageData(currentData);
    setSelectedItem(null);
    setReviewNotes('');
  };

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
              {data.evidence.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-gray-500 italic">
                    No evidence records submitted yet.
                  </td>
                </tr>
              ) : (
                data.evidence.map((ev) => (
                  <tr key={ev.id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-3 font-bold text-[#0A2E24]">{ev.proponent_name}</td>
                    <td className="p-3 space-y-0.5">
                      <p className="font-bold text-gray-900">{ev.evidence_title}</p>
                      <p className="text-[10px] text-gray-500 max-w-xs truncate">{ev.description}</p>
                    </td>
                    <td className="p-3 font-mono text-[11px]">{(ev.uploaded_date || ev.created_date || '').split('T')[0]}</td>
                    <td className="p-3">
                      <a
                        href={ev.file_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[#0A2E24] hover:text-[#D4AF37] font-bold text-[11px] inline-flex items-center gap-1"
                      >
                        <Download className="w-3.5 h-3.5 text-[#D4AF37]" /> Open File
                      </a>
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                          ev.review_status === 'Approved'
                            ? 'bg-emerald-100 text-emerald-800'
                            : ev.review_status === 'Rejected'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {ev.review_status}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => {
                          setSelectedItem(ev);
                          setReviewNotes(ev.review_notes || '');
                        }}
                        className="px-3 py-1 bg-[#0A2E24] text-[#D4AF37] font-bold rounded text-xs hover:bg-[#1A4A3A]"
                      >
                        Review
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
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
                <a href={selectedItem.file_url} target="_blank" rel="noreferrer" className="text-blue-600 underline">
                  View Uploaded Attachment
                </a>
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
                className="px-3 py-1.5 bg-gray-100 text-gray-700 text-xs font-bold rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() => handleUpdateStatus(selectedItem.id, 'Rejected')}
                className="px-3 py-1.5 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700"
              >
                Reject
              </button>
              <button
                onClick={() => handleUpdateStatus(selectedItem.id, 'Approved')}
                className="px-3 py-1.5 bg-emerald-700 text-white text-xs font-bold rounded-lg hover:bg-emerald-800"
              >
                Approve & Mark Verified
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
