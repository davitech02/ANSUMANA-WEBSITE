import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { TrendingUp, Loader2, AlertCircle, BarChart3 } from 'lucide-react';
import { useTheme } from '../../lib/ThemeContext';

export interface ComplianceProgressPoint {
  period: string;
  completed: number;
  pending: number;
  overdue: number;
}

interface ComplianceProgressChartProps {
  title?: string;
  subtitle?: string;
  data: ComplianceProgressPoint[];
  loading?: boolean;
  error?: string | null;
  total?: number;
  completedTotal?: number;
}

export const ComplianceProgressChart: React.FC<ComplianceProgressChartProps> = ({
  title = 'Compliance Progress Tracker',
  subtitle = 'Completed vs pending vs overdue compliance requirements',
  data,
  loading = false,
  error = null,
  total,
  completedTotal,
}) => {
  const { theme } = useTheme();
  const dark = theme === 'dark';

  const axisColor = dark ? '#8FA99D' : '#64748b';
  const gridColor = dark ? '#2B4238' : '#e2e8f0';
  const legendColor = dark ? '#C6D6CE' : '#334155';
  const tooltipBg = dark ? '#14231E' : '#ffffff';
  const tooltipBorder = dark ? '#355046' : '#e2e8f0';
  const tooltipText = dark ? '#E7EEEA' : '#1e293b';

  if (loading) {
    return (
      <div className="bg-white dark:bg-[#14231E] p-6 rounded-2xl border border-gray-200 dark:border-gray-300 shadow-sm space-y-4 animate-pulse">
        <div className="h-4 w-48 bg-gray-200 dark:bg-gray-300 rounded" />
        <div className="h-3 w-72 bg-gray-100 dark:bg-gray-200 rounded" />
        <div className="h-56 bg-gray-100 dark:bg-gray-200 rounded-xl flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-[#14231E] p-6 rounded-2xl border border-gray-200 dark:border-gray-300 shadow-sm">
        <div className="flex items-center gap-3 text-red-600 dark:text-red-700">
          <AlertCircle className="w-5 h-5" />
          <p className="text-xs font-bold">Unable to load compliance progress.</p>
        </div>
        <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">{error}</p>
      </div>
    );
  }

  const hasData = data.length > 0 && data.some((d) => d.completed + d.pending + d.overdue > 0);

  if (!hasData) {
    return (
      <div className="bg-white dark:bg-[#14231E] p-6 rounded-2xl border border-gray-200 dark:border-gray-300 shadow-sm">
        <div className="text-center space-y-2 py-8">
          <BarChart3 className="w-8 h-8 text-[#D4AF37] mx-auto opacity-80" />
          <p className="text-xs font-bold text-[#0A2E24] dark:text-gray-200">No compliance progress data yet</p>
          <p className="text-[11px] text-gray-500 dark:text-gray-400">
            Compliance records will appear here as schedules, evidence and findings are processed.
          </p>
        </div>
      </div>
    );
  }

  const pct = total && total > 0 ? Math.round(((completedTotal || 0) / total) * 100) : null;

  return (
    <div className="bg-white dark:bg-[#14231E] p-6 rounded-2xl border border-gray-200 dark:border-gray-300 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h3 className="font-heading font-bold text-base text-[#0A2E24] dark:text-gray-100 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[#D4AF37]" /> {title}
          </h3>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">{subtitle}</p>
        </div>
        {pct !== null && (
          <div className="shrink-0 text-right">
            <p className="font-heading font-extrabold text-2xl text-emerald-700 dark:text-emerald-700">
              {pct}%
            </p>
            <p className="text-[10px] font-mono uppercase text-gray-500 dark:text-gray-400">Overall completion</p>
            <div className="w-32 h-1.5 bg-gray-100 dark:bg-gray-300 rounded-full mt-1 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )}
      </div>

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
            <defs>
              <linearGradient id="gradCompleted" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#059669" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#059669" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="gradPending" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#D97706" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#D97706" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="gradOverdue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#DC2626" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#DC2626" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
            <XAxis dataKey="period" tick={{ fontSize: 11, fill: axisColor }} tickLine={false} axisLine={{ stroke: gridColor }} />
            <YAxis tick={{ fontSize: 11, fill: axisColor }} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip
              contentStyle={{
                backgroundColor: tooltipBg,
                border: `1px solid ${tooltipBorder}`,
                borderRadius: '0.75rem',
                fontSize: '11px',
                color: tooltipText,
              }}
              labelStyle={{ color: tooltipText, fontWeight: 700 }}
            />
            <Legend wrapperStyle={{ fontSize: '11px', color: legendColor }} />
            <Area
              type="monotone"
              dataKey="completed"
              name="Completed"
              stroke="#059669"
              strokeWidth={2}
              fill="url(#gradCompleted)"
            />
            <Area
              type="monotone"
              dataKey="pending"
              name="Pending"
              stroke="#D97706"
              strokeWidth={2}
              fill="url(#gradPending)"
            />
            <Area
              type="monotone"
              dataKey="overdue"
              name="Overdue"
              stroke="#DC2626"
              strokeWidth={2}
              fill="url(#gradOverdue)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};