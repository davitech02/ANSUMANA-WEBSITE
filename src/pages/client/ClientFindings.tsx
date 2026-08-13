import React, { useState, useEffect } from 'react';
import { useAuth } from '../../lib/AuthContext';
import { getStorageData } from '../../lib/storage';
import { ComplianceStatusBadge, RiskLevelBadge, ActionStatusBadge } from '../../components/common/StatusBadges';
import { DateRangeFilter, DateRange } from '../../components/common/DateRangeFilter';

export const ClientFindings: React.FC = () => {
  const { user } = useAuth();
  const [data, setData] = useState(() => getStorageData());
  const [dateRange, setDateRange] = useState<DateRange | null>(null);

  useEffect(() => {
    const handleUpdate = () => setData(getStorageData());
    window.addEventListener('aec_storage_updated', handleUpdate);
    return () => window.removeEventListener('aec_storage_updated', handleUpdate);
  }, []);

  const proponent = data.proponents.find(
    (p) => p.email.toLowerCase() === (user?.email || '').toLowerCase()
  ) || data.proponents[0];

  const clientFindings = data.findings.filter((f) => {
    if (f.proponent_id !== proponent?.id) return false;
    if (dateRange) {
      if (dateRange.startDate && f.action_deadline < dateRange.startDate) return false;
      if (dateRange.endDate && f.action_deadline > dateRange.endDate) return false;
    }
    return true;
  });

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

      <div className="space-y-4">
        {clientFindings.length === 0 ? (
          <div className="bg-white p-8 rounded-2xl border border-gray-200 text-center space-y-2">
            <p className="text-sm font-bold text-[#0A2E24]">No Non-Compliance Findings Found</p>
            <p className="text-xs text-gray-500">Your organization has no recorded environmental non-compliance issues.</p>
          </div>
        ) : (
          clientFindings.map((finding) => (
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
    </div>
  );
};
