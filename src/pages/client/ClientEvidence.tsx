import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Upload, CheckCircle2, FileText, Download, ShieldCheck, Plus } from 'lucide-react';
import { useAuth } from '../../lib/AuthContext';
import { getStorageData, saveStorageData } from '../../lib/storage';
import { EvidenceUpload } from '../../types';

export const ClientEvidence: React.FC = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const preselectedFindingId = searchParams.get('finding_id') || '';

  const [data, setData] = useState(() => getStorageData());
  const [submitted, setSubmitted] = useState(false);

  const proponent = data.proponents.find(
    (p) => p.email.toLowerCase() === (user?.email || '').toLowerCase()
  ) || data.proponents[0];

  const clientFindings = data.findings.filter((f) => f.proponent_id === proponent?.id);
  const clientEvidence = data.evidence.filter((e) => e.proponent_id === proponent?.id);

  const [form, setForm] = useState({
    finding_id: preselectedFindingId || (clientFindings[0]?.id || ''),
    evidence_title: '',
    description: '',
    file_url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
  });

  useEffect(() => {
    const handleUpdate = () => setData(getStorageData());
    window.addEventListener('aec_storage_updated', handleUpdate);
    return () => window.removeEventListener('aec_storage_updated', handleUpdate);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const currentData = getStorageData();

    const newEvidence: EvidenceUpload = {
      id: 'evid-' + Math.random().toString(36).substring(2, 9),
      proponent_id: proponent?.id || 'prop-1',
      proponent_name: proponent?.company_name || 'Proponent Company',
      finding_id: form.finding_id,
      evidence_title: form.evidence_title,
      description: form.description,
      file_url: form.file_url,
      uploaded_date: new Date().toISOString(),
      created_date: new Date().toISOString(),
      review_status: 'Pending review',
    };

    currentData.evidence.unshift(newEvidence);

    if (form.finding_id) {
      currentData.findings = currentData.findings.map((f) =>
        f.id === form.finding_id ? { ...f, action_status: 'Submitted for review' } : f
      );
    }

    saveStorageData(currentData);
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 4000);

    setForm({
      finding_id: clientFindings[0]?.id || '',
      evidence_title: '',
      description: '',
      file_url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
    });
  };

  return (
    <div className="space-y-8 font-sans">
      <div className="pb-4 border-b border-gray-200">
        <h1 className="font-heading font-extrabold text-2xl text-[#0A2E24] flex items-center gap-2">
          <Upload className="w-6 h-6 text-[#D4AF37]" /> Corrective Action Evidence Upload Portal
        </h1>
        <p className="text-xs text-gray-600 mt-0.5">
          Submit official evidence documents, photos, and water test laboratory reports to resolve EPA compliance findings
        </p>
      </div>

      {submitted && (
        <div className="p-4 bg-emerald-100 border border-emerald-300 text-emerald-800 text-xs rounded-xl font-bold flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-5 h-5 text-emerald-600" /> Evidence document successfully uploaded and routed to AEC auditor queue!
        </div>
      )}

      {/* Upload Form */}
      <div className="bg-white p-6 sm:p-8 rounded-2xl border border-gray-200 shadow-sm space-y-4">
        <h3 className="font-heading font-bold text-lg text-[#0A2E24] border-b border-gray-100 pb-2">
          New Evidence Submission Form
        </h3>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-gray-700 mb-1">Associated Compliance Finding</label>
              <select
                value={form.finding_id}
                onChange={(e) => setForm({ ...form, finding_id: e.target.value })}
                className="w-full p-2.5 border border-gray-300 rounded-lg focus:outline-none focus:border-[#D4AF37] bg-white"
              >
                <option value="">General Environmental Evidence (No specific finding)</option>
                {clientFindings.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.finding_title} ({f.inspection_area})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-gray-700 mb-1">Document / Evidence Title *</label>
              <input
                type="text"
                required
                value={form.evidence_title}
                onChange={(e) => setForm({ ...form, evidence_title: e.target.value })}
                placeholder="e.g. Water Quality Lab Test Certificate - Q3 2026"
                className="w-full p-2.5 border border-gray-300 rounded-lg focus:outline-none focus:border-[#D4AF37]"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-gray-700 mb-1">Description / Implementation Details *</label>
            <textarea
              required
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Explain how the corrective action was executed on site..."
              className="w-full p-2.5 border border-gray-300 rounded-lg focus:outline-none focus:border-[#D4AF37]"
            />
          </div>

          <div>
            <label className="block font-bold text-gray-700 mb-1">Document File URL (PDF, JPG, PNG, DOCX) *</label>
            <input
              type="text"
              required
              value={form.file_url}
              onChange={(e) => setForm({ ...form, file_url: e.target.value })}
              placeholder="https://..."
              className="w-full p-2.5 border border-gray-300 rounded-lg focus:outline-none focus:border-[#D4AF37] font-mono text-[11px]"
            />
          </div>

          <button
            type="submit"
            className="px-6 py-3 bg-[#0A2E24] hover:bg-[#1A4A3A] text-[#D4AF37] font-heading font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2"
          >
            <Upload className="w-4 h-4" /> Upload & Submit Evidence
          </button>
        </form>
      </div>

      {/* Submitted Evidence List */}
      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
        <h3 className="font-heading font-bold text-lg text-[#0A2E24] border-b border-gray-100 pb-2">
          Submitted Evidence History & Review Status
        </h3>

        <div className="space-y-3">
          {clientEvidence.length === 0 ? (
            <p className="text-xs text-gray-500 italic">No evidence uploaded yet.</p>
          ) : (
            clientEvidence.map((ev) => (
              <div
                key={ev.id}
                className="bg-gray-50 p-4 rounded-xl border border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-1">
                  <h4 className="font-bold text-[#0A2E24] text-sm">{ev.evidence_title || 'Evidence Document'}</h4>
                  <p className="text-gray-600 text-[11px]">{ev.description || ev.comment}</p>
                  <p className="text-gray-400 font-mono text-[10px]">
                    Uploaded Date: {(ev.uploaded_date || ev.created_date || '').split('T')[0]}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <span
                    className={`px-3 py-1 rounded-full text-[10px] font-mono font-bold ${
                      ev.review_status === 'Approved'
                        ? 'bg-emerald-100 text-emerald-800'
                        : ev.review_status === 'Rejected'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {ev.review_status.toUpperCase()}
                  </span>

                  <a
                    href={ev.file_url}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 bg-[#0A2E24] text-[#D4AF37] rounded-lg hover:bg-[#1A4A3A]"
                    title="Download File"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
