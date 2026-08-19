import React, { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, Plus, Edit, Trash2, X, Search, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { adminApi, workflowsApi } from '../../lib/api';
import type { Finding, Proponent, Pagination } from '../../types';
import { ComplianceStatusBadge, RiskLevelBadge, ActionStatusBadge } from '../../components/common/StatusBadges';

function errMsg(e: unknown): string {
  return e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : 'Request failed. Please try again.';
}

type WorkflowAction = 'start' | 'submit_for_review' | 'verify' | 'reopen' | 'mark_overdue';

const PER_PAGE = 25;

const WORKFLOW_LABELS: Record<WorkflowAction, string> = {
  start: 'Start',
  submit_for_review: 'Submit Review',
  verify: 'Verify',
  reopen: 'Reopen',
  mark_overdue: 'Mark Overdue',
};

function workflowButtons(f: Finding): WorkflowAction[] {
  switch (f.action_status) {
    case 'Open':
      return ['start', 'mark_overdue'];
    case 'Pending':
    case 'In progress':
      return ['submit_for_review', 'mark_overdue'];
    case 'Submitted for review':
      return ['verify'];
    case 'Verified':
      return ['reopen'];
    case 'Overdue':
      return ['reopen', 'start'];
    default:
      return [];
  }
}

interface FindingForm {
  proponent_id: string;
  finding_title: string;
  inspection_area: string;
  compliance_status: string;
  risk_level: string;
  corrective_action: string;
  action_deadline: string;
  responsible_party: string;
  action_status: string;
}

export const AdminFindings: React.FC = () => {
  const [findings, setFindings] = useState<Finding[]>([]);
  const [proponents, setProponents] = useState<Proponent[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRisk, setFilterRisk] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Finding | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [workflowBusy, setWorkflowBusy] = useState<{ id: string; action: WorkflowAction } | null>(null);

  const [form, setForm] = useState<FindingForm>({
    proponent_id: '',
    finding_title: '',
    inspection_area: 'Tailings Management & Effluent',
    compliance_status: 'Non-compliant',
    risk_level: 'High',
    corrective_action: '',
    action_deadline: '',
    responsible_party: 'HSE Director',
    action_status: 'Open',
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.listFindings({
        page,
        per_page: PER_PAGE,
        q: searchTerm || undefined,
        risk_level: filterRisk !== 'all' ? filterRisk : undefined,
      });
      setFindings(res.items);
      setPagination(res.pagination);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, [page, searchTerm, filterRisk]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    let active = true;
    adminApi
      .listProponents({ page: 1, per_page: 100 })
      .then((res) => {
        if (active) setProponents(res.items);
      })
      .catch(() => {
        /* dropdown best-effort */
      });
    return () => {
      active = false;
    };
  }, []);

  const handleOpenAdd = () => {
    setEditingItem(null);
    const defaultProp = proponents[0]?.id || '';
    const d = new Date();
    d.setDate(d.getDate() + 15);
    const dateStr = d.toISOString().split('T')[0];

    setForm({
      proponent_id: defaultProp,
      finding_title: '',
      inspection_area: 'Tailings & Effluent Storage',
      compliance_status: 'Non-compliant',
      risk_level: 'High',
      corrective_action: '',
      action_deadline: dateStr,
      responsible_party: 'Environmental Manager',
      action_status: 'Open',
    });
    setError(null);
    setSuccess(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (item: Finding) => {
    setEditingItem(item);
    setForm({
      proponent_id: item.proponent_id,
      finding_title: item.finding_title,
      inspection_area: item.inspection_area ?? '',
      compliance_status: item.compliance_status,
      risk_level: item.risk_level,
      corrective_action: item.corrective_action ?? '',
      action_deadline: item.action_deadline ?? '',
      responsible_party: item.responsible_party ?? '',
      action_status: item.action_status,
    });
    setError(null);
    setSuccess(null);
    setModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this compliance finding record?')) return;
    setDeletingId(id);
    setError(null);
    setSuccess(null);
    try {
      await adminApi.deleteFinding(id);
      setSuccess('Finding deleted.');
      await load();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setDeletingId(null);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const payload = {
        proponent_id: form.proponent_id,
        finding_title: form.finding_title,
        inspection_area: form.inspection_area || null,
        compliance_status: form.compliance_status,
        risk_level: form.risk_level,
        corrective_action: form.corrective_action || null,
        action_deadline: form.action_deadline || null,
        responsible_party: form.responsible_party || null,
        action_status: form.action_status,
      };
      if (editingItem) {
        await adminApi.updateFinding(editingItem.id, payload);
        setSuccess('Finding updated.');
      } else {
        await adminApi.createFinding(payload);
        setSuccess('Finding created.');
      }
      setModalOpen(false);
      await load();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setSaving(false);
    }
  };

  const handleWorkflow = async (id: string, action: WorkflowAction) => {
    setWorkflowBusy({ id, action });
    setError(null);
    setSuccess(null);
    try {
      await workflowsApi.findingWorkflow(id, action);
      setSuccess(`Workflow action "${WORKFLOW_LABELS[action]}" completed.`);
      await load();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setWorkflowBusy(null);
    }
  };

  const totalPages = pagination?.total_pages ?? 1;

  return (
    <div className="space-y-6 font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-200">
        <div>
          <h1 className="font-heading font-extrabold text-2xl text-[#0A2E24] flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-[#D4AF37]" /> Compliance Audit Findings & Corrective Actions
          </h1>
          <p className="text-xs text-gray-600 mt-0.5">Track field inspection non-compliances, risk levels, and proponent action deadlines</p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="px-4 py-2.5 bg-[#0A2E24] hover:bg-[#1A4A3A] text-[#D4AF37] font-heading font-bold text-xs rounded-xl transition-all shadow-md flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" /> Log New Finding
        </button>
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
            placeholder="Search findings by title, proponent, or inspection area..."
            className="w-full text-xs focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto text-xs">
          <span className="font-mono text-[10px] text-gray-500 font-bold uppercase">Risk Filter:</span>
          <select
            value={filterRisk}
            onChange={(e) => {
              setFilterRisk(e.target.value);
              setPage(1);
            }}
            className="p-1.5 border border-gray-300 rounded-lg bg-white font-mono text-xs focus:outline-none focus:border-[#D4AF37]"
          >
            <option value="all">All Risks</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
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
                <th className="p-3">Finding Title & Area</th>
                <th className="p-3">Compliance</th>
                <th className="p-3">Risk Level</th>
                <th className="p-3">Corrective Action</th>
                <th className="p-3">Deadline</th>
                <th className="p-3">Action Status</th>
                <th className="p-3">Workflow</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs text-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={9} className="p-6 text-center">
                    <span className="inline-flex items-center gap-2 text-gray-500 italic">
                      <Loader2 className="w-4 h-4 text-[#D4AF37] animate-spin" /> Loading findings…
                    </span>
                  </td>
                </tr>
              ) : findings.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-6 text-center text-gray-500 italic">
                    No findings recorded.
                  </td>
                </tr>
              ) : (
                findings.map((f) => (
                  <tr key={f.id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-3 font-bold text-[#0A2E24]">{f.proponent_name}</td>
                    <td className="p-3 space-y-0.5">
                      <p className="font-bold text-gray-900">{f.finding_title}</p>
                      <p className="text-[10px] text-gray-500 font-mono">{f.inspection_area}</p>
                    </td>
                    <td className="p-3">
                      <ComplianceStatusBadge status={f.compliance_status} />
                    </td>
                    <td className="p-3">
                      <RiskLevelBadge level={f.risk_level} />
                    </td>
                    <td className="p-3 max-w-xs text-gray-600 line-clamp-2">{f.corrective_action}</td>
                    <td className="p-3 font-mono font-bold text-[#0A2E24]">{f.action_deadline}</td>
                    <td className="p-3">
                      <ActionStatusBadge status={f.action_status} />
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1">
                        {workflowButtons(f).map((action) => (
                          <button
                            key={action}
                            disabled={workflowBusy !== null}
                            onClick={() => handleWorkflow(f.id, action)}
                            className="px-1.5 py-0.5 rounded border border-[#D4AF37]/60 bg-[#D4AF37]/10 text-[#0A2E24] font-bold text-[10px] hover:bg-[#D4AF37]/25 transition-colors disabled:opacity-50"
                          >
                            {workflowBusy?.id === f.id && workflowBusy.action === action ? 'Working…' : WORKFLOW_LABELS[action]}
                          </button>
                        ))}
                      </div>
                    </td>
                    <td className="p-3 text-right space-x-2">
                      <button
                        onClick={() => handleOpenEdit(f)}
                        disabled={deletingId !== null}
                        className="p-1.5 bg-gray-100 hover:bg-[#D4AF37]/20 text-[#0A2E24] rounded-lg transition-colors disabled:opacity-50"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(f.id)}
                        disabled={deletingId !== null}
                        className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors disabled:opacity-50"
                      >
                        {deletingId === f.id ? (
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

      {modalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto border border-gray-200">
            <div className="flex items-center justify-between pb-3 border-b border-gray-200">
              <h3 className="font-heading font-bold text-lg text-[#0A2E24]">
                {editingItem ? 'Edit Compliance Finding' : 'Log New Compliance Finding'}
              </h3>
              <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-gray-700 mb-1">Proponent Company *</label>
                <select
                  required
                  value={form.proponent_id}
                  onChange={(e) => setForm({ ...form, proponent_id: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:border-[#D4AF37] bg-white"
                >
                  {proponents.length === 0 && <option value="">No proponents available</option>}
                  {proponents.map((prop) => (
                    <option key={prop.id} value={prop.id}>
                      {prop.company_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Finding Title *</label>
                <input
                  type="text"
                  required
                  value={form.finding_title}
                  onChange={(e) => setForm({ ...form, finding_title: e.target.value })}
                  placeholder="e.g. Tailings Dam Seepage Control Defect"
                  className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:border-[#D4AF37]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Inspection Area</label>
                  <input
                    type="text"
                    value={form.inspection_area}
                    onChange={(e) => setForm({ ...form, inspection_area: e.target.value })}
                    placeholder="e.g. Chemical Storage Bay 2"
                    className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Compliance Status</label>
                  <select
                    value={form.compliance_status}
                    onChange={(e) => setForm({ ...form, compliance_status: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:border-[#D4AF37] bg-white"
                  >
                    <option value="Compliant">Compliant</option>
                    <option value="Non-compliant">Non-compliant</option>
                    <option value="Requires improvement">Requires improvement</option>
                    <option value="Pending review">Pending review</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Risk Level</label>
                  <select
                    value={form.risk_level}
                    onChange={(e) => setForm({ ...form, risk_level: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:border-[#D4AF37] bg-white"
                  >
                    <option value="High">High Risk</option>
                    <option value="Medium">Medium Risk</option>
                    <option value="Low">Low Risk</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Action Status</label>
                  <select
                    value={form.action_status}
                    onChange={(e) => setForm({ ...form, action_status: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:border-[#D4AF37] bg-white"
                  >
                    <option value="Open">Open</option>
                    <option value="Pending">Pending</option>
                    <option value="In progress">In progress</option>
                    <option value="Submitted for review">Submitted for review</option>
                    <option value="Verified">Verified & Closed</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Required Corrective Action *</label>
                <textarea
                  required
                  rows={3}
                  value={form.corrective_action}
                  onChange={(e) => setForm({ ...form, corrective_action: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:border-[#D4AF37]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Action Deadline *</label>
                  <input
                    type="date"
                    required
                    value={form.action_deadline}
                    onChange={(e) => setForm({ ...form, action_deadline: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Responsible Party</label>
                  <input
                    type="text"
                    value={form.responsible_party}
                    onChange={(e) => setForm({ ...form, responsible_party: e.target.value })}
                    placeholder="e.g. Mine Site Director"
                    className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-gray-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  disabled={saving}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-lg disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-[#0A2E24] hover:bg-[#1A4A3A] text-[#D4AF37] font-bold rounded-lg disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Save Finding'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};