import React, { useState, useEffect, useCallback } from 'react';
import { FileCheck, Download, ExternalLink, ShieldCheck, Loader2, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../lib/AuthContext';
import { portalApi, saveDownload } from '../../lib/api';
import { PermitStatusBadge } from '../../components/common/StatusBadges';
import { DateRangeFilter, DateRange } from '../../components/common/DateRangeFilter';
import type { ClientPermit } from '../../types';

function errMsg(e: unknown): string {
  return e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : 'Request failed. Please try again.';
}

export const ClientPermits: React.FC = () => {
  const { proponent } = useAuth();
  const [permits, setPermits] = useState<ClientPermit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange | null>(null);

  const from = dateRange?.startDate || undefined;
  const to = dateRange?.endDate || undefined;

  const loadPermits = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await portalApi.listClientPermits({ from, to });
      setPermits(res.items);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    loadPermits();
  }, [loadPermits]);

  const handleDownload = async (permit: ClientPermit) => {
    setDownloadingId(permit.id);
    setDownloadError(null);
    try {
      await saveDownload(portalApi.clientPermitFileUrl(permit.id));
    } catch (e) {
      setDownloadError(errMsg(e));
    } finally {
      setDownloadingId(null);
    }
  };

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

      {downloadError && (
        <div className="p-3 bg-rose-100 border border-rose-300 text-rose-800 text-xs rounded-xl font-bold">
          {downloadError}
        </div>
      )}

      {loading ? (
        <div className="bg-white p-12 rounded-2xl border border-gray-200 text-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-[#D4AF37] mx-auto" />
          <p className="text-sm font-bold text-[#0A2E24]">Loading permits & licenses...</p>
        </div>
      ) : error ? (
        <div className="bg-rose-50 p-8 rounded-2xl border border-rose-200 text-center space-y-3">
          <AlertTriangle className="w-10 h-10 text-rose-600 mx-auto" />
          <p className="text-sm font-bold text-rose-800">Unable to load permits</p>
          <p className="text-xs text-rose-600">{error}</p>
          <button
            onClick={loadPermits}
            className="px-4 py-2 bg-[#0A2E24] text-[#D4AF37] font-bold text-xs rounded-xl hover:bg-[#1A4A3A] transition-colors"
          >
            Retry
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {permits.length === 0 ? (
            <div className="col-span-2 bg-white p-8 rounded-2xl border border-gray-200 text-center space-y-2">
              <ShieldCheck className="w-12 h-12 text-gray-300 mx-auto" />
              <p className="text-sm font-bold text-[#0A2E24]">No Permit Certificates Found</p>
              <p className="text-xs text-gray-500">Contact AEC consultants if your permit is currently under EPA review.</p>
            </div>
          ) : (
            permits.map((permit) => (
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
                  {permit.has_file ? (
                    <button
                      onClick={() => handleDownload(permit)}
                      disabled={downloadingId === permit.id}
                      className="px-4 py-2 bg-[#0A2E24] text-[#D4AF37] font-bold text-xs rounded-lg hover:bg-[#1A4A3A] flex items-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {downloadingId === permit.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Download className="w-3.5 h-3.5" />
                      )} {downloadingId === permit.id ? 'Downloading...' : 'Download PDF'}
                    </button>
                  ) : (
                    <span className="text-xs text-gray-400">—</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};