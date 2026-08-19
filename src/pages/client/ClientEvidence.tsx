import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Upload, CheckCircle2, FileText, Download, ShieldCheck, Plus, Loader2, AlertTriangle } from 'lucide-react';
import { portalApi, saveDownload } from '../../lib/api';
import type { ClientEvidence as ClientEvidenceItem, ClientFinding } from '../../types';

function errMsg(e: unknown): string {
  return e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : 'Request failed. Please try again.';
}

export const ClientEvidence: React.FC = () => {
  const [searchParams] = useSearchParams();
  const preselectedFindingId = searchParams.get('finding_id') || '';

  const [findings, setFindings] = useState<ClientFinding[]>([]);
  const [evidence, setEvidence] = useState<ClientEvidenceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  const [form, setForm] = useState({
    finding_id: preselectedFindingId || '',
    evidence_title: '',
    description: '',
  });

  const loadData = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const [findingRes, evidenceRes] = await Promise.all([
        portalApi.listClientFindings(),
        portalApi.listClientEvidence(),
      ]);
      setFindings(findingRes.items);
      setEvidence(evidenceRes.items);
      setForm((prev) => {
        const hasId = findingRes.items.some((f) => f.id === prev.finding_id);
        return { ...prev, finding_id: hasId ? prev.finding_id : findingRes.items[0]?.id || '' };
      });
    } catch (e) {
      if (!silent) setError(errMsg(e));
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setActionError('Please select a document file to upload.');
      return;
    }
    setActionError(null);
    setSaving(true);
    try {
      await portalApi.uploadClientEvidence({
        finding_id: form.finding_id,
        evidence_title: form.evidence_title,
        description: form.description,
        file,
      });
      setSubmitted(true);
      setTimeout(() => setSubmitted(false), 4000);
      setFile(null);
      setForm({
        finding_id: findings[0]?.id || '',
        evidence_title: '',
        description: '',
      });
      await loadData(true);
    } catch (e) {
      setActionError(errMsg(e));
    } finally {
      setSaving(false);
    }
  };

  const handleDownload = async (ev: ClientEvidenceItem) => {
    setDownloadingId(ev.id);
    setActionError(null);
    try {
      await saveDownload(portalApi.clientEvidenceFileUrl(ev.id));
    } catch (e) {
      setActionError(errMsg(e));
    } finally {
      setDownloadingId(null);
    }
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

      {actionError && (
        <div className="p-4 bg-rose-100 border border-rose-300 text-rose-800 text-xs rounded-xl font-bold flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-rose-600" /> {actionError}
        </div>
      )}

      {loading ? (
        <div className="bg-white p-12 rounded-2xl border border-gray-200 text-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-[#D4AF37] mx-auto" />
          <p className="text-sm font-bold text-[#0A2E24]">Loading evidence portal...</p>
        </div>
      ) : error ? (
        <div className="bg-rose-50 p-8 rounded-2xl border border-rose-200 text-center space-y-3">
          <AlertTriangle className="w-10 h-10 text-rose-600 mx-auto" />
          <p className="text-sm font-bold text-rose-800">Unable to load evidence portal</p>
          <p className="text-xs text-rose-600">{error}</p>
          <button
            onClick={() => loadData()}
            className="px-4 py-2 bg-[#0A2E24] text-[#D4AF37] font-bold text-xs rounded-xl hover:bg-[#1A4A3A] transition-colors"
          >
            Retry
          </button>
        </div>
      ) : (
        <>
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
                    {findings.length === 0 ? (
                      <option value="">No findings available for evidence submission</option>
                    ) : (
                      findings.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.finding_title}{f.inspection_area ? ` (${f.inspection_area})` : ''}
                        </option>
                      ))
                    )}
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
                <label className="block font-bold text-gray-700 mb-1">Document File (PDF, JPG, PNG, DOCX) *</label>
                <input
                  type="file"
                  required
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="w-full p-2.5 border border-gray-300 rounded-lg focus:outline-none focus:border-[#D4AF37] bg-white text-xs"
                />
              </div>

              <button
                type="submit"
                disabled={saving || findings.length === 0}
                className="px-6 py-3 bg-[#0A2E24] hover:bg-[#1A4A3A] text-[#D4AF37] font-heading font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} {saving ? 'Uploading...' : 'Upload & Submit Evidence'}
              </button>
            </form>
          </div>

          {/* Submitted Evidence List */}
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
            <h3 className="font-heading font-bold text-lg text-[#0A2E24] border-b border-gray-100 pb-2">
              Submitted Evidence History & Review Status
            </h3>

            <div className="space-y-3">
              {evidence.length === 0 ? (
                <p className="text-xs text-gray-500 italic">No evidence uploaded yet.</p>
              ) : (
                evidence.map((ev) => (
                  <div
                    key={ev.id}
                    className="bg-gray-50 p-4 rounded-xl border border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1">
                      <h4 className="font-bold text-[#0A2E24] text-sm">{ev.evidence_title || 'Evidence Document'}</h4>
                      <p className="text-gray-600 text-[11px]">{ev.description}</p>
                      <p className="text-gray-400 font-mono text-[10px]">
                        Uploaded Date: {(ev.submitted_at || ev.created_at || '').split('T')[0]}
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

                      {ev.has_file ? (
                        <button
                          onClick={() => handleDownload(ev)}
                          disabled={downloadingId === ev.id}
                          className="p-2 bg-[#0A2E24] text-[#D4AF37] rounded-lg hover:bg-[#1A4A3A] disabled:opacity-60 disabled:cursor-not-allowed"
                          title="Download File"
                        >
                          {downloadingId === ev.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Download className="w-3.5 h-3.5" />
                          )}
                        </button>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};