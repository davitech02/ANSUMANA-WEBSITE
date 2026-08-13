import React, { useState } from 'react';
import { Calendar, X, Filter, RotateCcw } from 'lucide-react';

export interface DateRange {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
}

interface DateRangeFilterProps {
  onDateChange: (range: DateRange | null) => void;
  className?: string;
  label?: string;
}

export const DateRangeFilter: React.FC<DateRangeFilterProps> = ({
  onDateChange,
  className = '',
  label = 'Filter by Date Range',
}) => {
  const [selectedPreset, setSelectedPreset] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const applyRange = (start: string, end: string, presetName: string) => {
    setStartDate(start);
    setEndDate(end);
    setSelectedPreset(presetName);
    if (start || end) {
      onDateChange({ startDate: start, endDate: end });
    } else {
      onDateChange(null);
    }
  };

  const handlePresetChange = (preset: string) => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    if (preset === 'all') {
      applyRange('', '', 'all');
      return;
    }

    if (preset === 'this-month') {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
      const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];
      applyRange(firstDay, lastDay, 'this-month');
      return;
    }

    if (preset === 'next-30') {
      const next30 = new Date(today);
      next30.setDate(today.getDate() + 30);
      const next30Str = next30.toISOString().split('T')[0];
      applyRange(todayStr, next30Str, 'next-30');
      return;
    }

    if (preset === 'past-30') {
      const past30 = new Date(today);
      past30.setDate(today.getDate() - 30);
      const past30Str = past30.toISOString().split('T')[0];
      applyRange(past30Str, todayStr, 'past-30');
      return;
    }

    if (preset === '2026') {
      applyRange('2026-01-01', '2026-12-31', '2026');
      return;
    }

    if (preset === 'custom') {
      setSelectedPreset('custom');
    }
  };

  const handleCustomChange = (start: string, end: string) => {
    setStartDate(start);
    setEndDate(end);
    setSelectedPreset('custom');
    if (start || end) {
      onDateChange({ startDate: start, endDate: end });
    } else {
      onDateChange(null);
    }
  };

  const handleReset = () => {
    setStartDate('');
    setEndDate('');
    setSelectedPreset('all');
    onDateChange(null);
  };

  const isFiltered = Boolean(startDate || endDate || selectedPreset !== 'all');

  return (
    <div className={`bg-white p-3.5 rounded-2xl border border-gray-200 shadow-xs space-y-3 font-sans ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-[#D4AF37]" />
          <span className="font-heading font-bold text-xs text-[#0A2E24]">{label}</span>
          {isFiltered && (
            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-mono text-[10px] font-bold border border-emerald-200">
              Active Filter
            </span>
          )}
        </div>

        {/* Quick Range Presets */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <button
            onClick={() => handlePresetChange('all')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-mono transition-all ${
              selectedPreset === 'all'
                ? 'bg-[#0A2E24] text-[#D4AF37] font-bold shadow-xs'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            All Dates
          </button>
          <button
            onClick={() => handlePresetChange('this-month')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-mono transition-all ${
              selectedPreset === 'this-month'
                ? 'bg-[#0A2E24] text-[#D4AF37] font-bold shadow-xs'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            This Month
          </button>
          <button
            onClick={() => handlePresetChange('next-30')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-mono transition-all ${
              selectedPreset === 'next-30'
                ? 'bg-[#0A2E24] text-[#D4AF37] font-bold shadow-xs'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Next 30 Days
          </button>
          <button
            onClick={() => handlePresetChange('past-30')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-mono transition-all ${
              selectedPreset === 'past-30'
                ? 'bg-[#0A2E24] text-[#D4AF37] font-bold shadow-xs'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Past 30 Days
          </button>
          <button
            onClick={() => handlePresetChange('2026')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-mono transition-all ${
              selectedPreset === '2026'
                ? 'bg-[#0A2E24] text-[#D4AF37] font-bold shadow-xs'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Year 2026
          </button>
        </div>
      </div>

      {/* Date Pickers & Reset */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2 border-t border-gray-100 text-xs">
        <div className="flex items-center gap-2 flex-1">
          <span className="font-mono text-gray-500 shrink-0 text-[11px]">From:</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => handleCustomChange(e.target.value, endDate)}
            className="w-full p-2 border border-gray-300 rounded-xl focus:outline-none focus:border-[#D4AF37] text-xs font-mono bg-white"
          />
        </div>

        <div className="flex items-center gap-2 flex-1">
          <span className="font-mono text-gray-500 shrink-0 text-[11px]">To:</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => handleCustomChange(startDate, e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-xl focus:outline-none focus:border-[#D4AF37] text-xs font-mono bg-white"
          />
        </div>

        {isFiltered && (
          <button
            onClick={handleReset}
            className="px-3 py-2 bg-rose-50 text-rose-700 hover:bg-rose-100 font-mono font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5 shrink-0 border border-rose-200"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Clear Filter
          </button>
        )}
      </div>
    </div>
  );
};
