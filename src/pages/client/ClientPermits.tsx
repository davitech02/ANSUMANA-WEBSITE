import React, { useState, useEffect } from 'react';
import { FileCheck, Download, ExternalLink, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../lib/AuthContext';
import { getStorageData } from '../../lib/storage';
import { PermitStatusBadge } from '../../components/common/StatusBadges';
import { DateRangeFilter, DateRange } from '../../components/common/DateRangeFilter';

export const ClientPermits: React.FC = () => {
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

  const clientPermits = data.permits.filter((p) => {
    if (p.proponent_id !== proponent?.id) return false;
    if (dateRange) {
      if (dateRange.startDate && p.issue_date < dateRange.startDate && p.expiry_date < dateRange.startDate) {
        return false;
      }
      if (dateRange.endDate && p.issue_date > dateRange.endDate) {
        return false;
      }
    }
    return true;
  });

  return (
    <div className="space-y-6 font-sans">
      <div className="pb-4 border-b border-gray-200">
        <h1 className="font-heading font-extrabold text-2xl text-[#0A2E24] flex items-center gap-2">
          <FileCheck className="w-6 h-6 text-[#D4AF37]" /> EPA Environmental Permits & Licenses
        </h1>
        <p className="text-xs text-gray-600 mt-0.5">
          Official Environmental Impact Assessment (EIA) Permits and Mining Concession Licenses issued for {proponent?.company_name}
        </p>
      </div>

      <DateRangeFilter onDateChange={(range) => setDateRange(range)} label="Filter My Permits by Date Range" />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {clientPermits.length === 0 ? (
          <div className="col-span-2 bg-white p-8 rounded-2xl border border-gray-200 text-center space-y-2">
            <ShieldCheck className="w-12 h-12 text-gray-300 mx-auto" />
            <p className="text-sm font-bold text-[#0A2E24]">No Permit Certificates Found</p>
            <p className="text-xs text-gray-500">Contact AEC consultants if your permit is currently under EPA review.</p>
          </div>
        ) : (
          clientPermits.map((permit) => (
            <div
              key={permit.id}
              className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4 border-l-4 border-l-[#D4AF37]"
            >
              <div className="flex justify-between items-start">
                <div>
                  <span className="font-mono text-[10px] text-gray-500 font-bold uppercase">{permit.permit_type}</span>
                  <h3 className="font-heading font-bold text-lg text-[#0A2E24] mt-0.5">{permit.permit_number}</h3>
                </div>
                <PermitStatusBadge status={permit.permit_status} size="md" />
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs bg-gray-50 p-3 rounded-xl border border-gray-100">
                <div>
                  <span className="text-gray-500 font-mono text-[10px]">ISSUE DATE</span>
                  <p className="font-bold text-[#0A2E24] mt-0.5">{permit.issue_date}</p>
                </div>
                <div>
                  <span className="text-gray-500 font-mono text-[10px]">EXPIRY DATE</span>
                  <p className="font-bold text-[#0A2E24] mt-0.5">{permit.expiry_date}</p>
                </div>
              </div>

              <div className="pt-2 flex justify-between items-center border-t border-gray-100">
                <span className="text-xs text-gray-500">Official EPA Certificate:</span>
                {permit.permit_file_url ? (
                  <a
                    href={permit.permit_file_url}
                    target="_blank"
                    rel="noreferrer"
                    className="px-4 py-2 bg-[#0A2E24] text-[#D4AF37] font-bold text-xs rounded-lg hover:bg-[#1A4A3A] flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" /> Download PDF
                  </a>
                ) : (
                  <span className="text-xs text-gray-400">PDF Pending</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
