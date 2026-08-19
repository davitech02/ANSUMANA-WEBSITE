import React, { useState, useEffect, useCallback } from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../lib/AuthContext';
import { portalApi } from '../../lib/api';
import { ComplianceStatusBadge, RiskLevelBadge, ActionStatusBadge } from '../../components/common/StatusBadges';
import { DateRangeFilter, DateRange } from '../../components/common/DateRangeFilter';
import type { ClientFinding } from '../../types';

function errMsg(e: unknown): string {
  return e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : 'Request failed. Please try again.';
}

export const ClientFindings: React.FC = () => {
  const { proponent } = useAuth();
  const [findings, setFindings] = useState<ClientFinding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange | null>(null);

  const from = dateRange?.startDate || undefined;
  const to = dateRange?.endDate || undefined;

  const loadFindings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await portalApi.listClientFindings({ from, to });
      setFindings(res.items);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    loadFindings();
  }, [loadFindings]);

  return (
    <div className="space-y-6 font-sans">
      <div>
        <h1 className="font-heading font-extrabold text-2xl text-[#0A2E24] tracking-tight">
          My Non-Compliance Findings
        </h1>
        <p className="text-xs text-gray-500 mt-1">
          Audit observations and non-compliance notices recorded during EPA inspections for {proponent?.company_name}
        </p>
      </div>

      <DateRangeFilter onDateChange={(range) => setDateRange(range)} label="Filter Findings by Action Deadline" />

      {loading ? (
        <div className="bg-white p-12 rounded-2xl border border-gray-200 text-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-[#D4AF37] mx-auto" />
          <p className="text-sm font-bold text-[#0A2E24]">Loading findings...</p>
        </div>
      ) : error ? (
        <div className="bg-rose-50 p-8 rounded-2xl border border-rose-200 text-center space-y-3">
          <AlertTriangle className="w-10 h-10 text-rose-600 mx-auto" />
          <p className="text-sm font-bold text-rose-800">Unable to load findings</p>
          <p className="text-xs text-rose-600">{error}</p>
          <button
            onClick={loadFindings}
            className="px-4 py-2 bg-[#0A2E24] text-[#D4AF37] font-bold text-xs rounded-xl hover:bg-[#1A4A3A] transition-colors"
          >
            Retry
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {findings.length === 0 ? (
            <div className="bg-white p-8 rounded-2xl border border-gray-200 text-center space-y-2">
              <p className="text-sm font-bold text-[#0A2E24]">No Non-Compliance Findings Found</p>
              <p className="text-xs text-gray-500">Your organization has no recorded environmental non-compliance issues.</p>
            </div>
          ) : (
            findings.map((finding) => (
              <div key={finding.id} className="bg-white p-6 rounded-2xl border border-gray-200 shadow-2xs space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-3">
                  <div>
                    <h3 className="font-heading font-extrabold text-base text-[#0A2E24]">{finding.finding_title}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">Inspection Area: {finding.inspection_area}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <ComplianceStatusBadge status={finding.compliance_status} />
                    <RiskLevelBadge level={finding.risk_level} />
                    <ActionStatusBadge status={finding.action_status} />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-gray-600">
                  <div>
                    <span className="font-semibold text-gray-800 block">Corrective Action Required:</span>
                    <p className="mt-1 bg-gray-50 p-2.5 rounded-xl border border-gray-100">{finding.corrective_action}</p>
                  </div>
                  <div className="space-y-1">
                    <p><strong className="text-gray-800">Action Deadline:</strong> {finding.action_deadline}</p>
                    <p><strong className="text-gray-800">Responsible Party:</strong> {finding.responsible_party}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};