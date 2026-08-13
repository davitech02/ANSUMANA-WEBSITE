import React from 'react';
import { CheckCircle2, AlertTriangle, Clock, XCircle, ShieldCheck, ShieldAlert, FileCheck, RefreshCw } from 'lucide-react';
import { PermitStatus, ComplianceStatus, RiskLevel, ActionStatus } from '../../types';

interface PermitBadgeProps {
  status: PermitStatus | string;
  size?: 'sm' | 'md';
}

export const PermitStatusBadge: React.FC<PermitBadgeProps> = ({ status, size = 'sm' }) => {
  const normalized = (status || '').toLowerCase();

  const sizeClasses = size === 'md' ? 'px-3 py-1 text-xs' : 'px-2.5 py-0.5 text-[10px]';

  if (normalized === 'active') {
    return (
      <span className={`inline-flex items-center gap-1 rounded-full font-mono font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs ${sizeClasses}`}>
        <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
        ACTIVE PERMIT
      </span>
    );
  }

  if (normalized === 'expired') {
    return (
      <span className={`inline-flex items-center gap-1 rounded-full font-mono font-bold bg-red-100 text-red-800 border border-red-300 shadow-2xs ${sizeClasses}`}>
        <XCircle className="w-3 h-3 text-red-600 shrink-0" />
        EXPIRED
      </span>
    );
  }

  if (normalized.includes('pending') || normalized.includes('review')) {
    return (
      <span className={`inline-flex items-center gap-1 rounded-full font-mono font-bold bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs ${sizeClasses}`}>
        <Clock className="w-3 h-3 text-amber-600 shrink-0" />
        PENDING RENEWAL
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-mono font-bold bg-purple-100 text-purple-800 border border-purple-300 shadow-2xs ${sizeClasses}`}>
      <AlertTriangle className="w-3 h-3 text-purple-600 shrink-0" />
      {status.toUpperCase()}
    </span>
  );
};

interface ComplianceBadgeProps {
  status: ComplianceStatus | string;
  size?: 'sm' | 'md';
}

export const ComplianceStatusBadge: React.FC<ComplianceBadgeProps> = ({ status, size = 'sm' }) => {
  const normalized = (status || '').toLowerCase();
  const sizeClasses = size === 'md' ? 'px-3 py-1 text-xs' : 'px-2.5 py-0.5 text-[10px]';

  if (normalized === 'compliant') {
    return (
      <span className={`inline-flex items-center gap-1 rounded-full font-mono font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 ${sizeClasses}`}>
        <ShieldCheck className="w-3 h-3 text-emerald-600 shrink-0" />
        COMPLIANT
      </span>
    );
  }

  if (normalized.includes('non')) {
    return (
      <span className={`inline-flex items-center gap-1 rounded-full font-mono font-bold bg-red-100 text-red-800 border border-red-300 ${sizeClasses}`}>
        <ShieldAlert className="w-3 h-3 text-red-600 shrink-0" />
        NON-COMPLIANT
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-mono font-bold bg-amber-100 text-amber-900 border border-amber-300 ${sizeClasses}`}>
      <Clock className="w-3 h-3 text-amber-600 shrink-0" />
      REQUIRES IMPROVEMENT
    </span>
  );
};

interface RiskBadgeProps {
  level: RiskLevel | string;
  size?: 'sm' | 'md';
}

export const RiskLevelBadge: React.FC<RiskBadgeProps> = ({ level, size = 'sm' }) => {
  const normalized = (level || '').toLowerCase();
  const sizeClasses = size === 'md' ? 'px-3 py-1 text-xs' : 'px-2.5 py-0.5 text-[10px]';

  if (normalized === 'high' || normalized === 'critical') {
    return (
      <span className={`inline-flex items-center gap-1 rounded-md font-mono font-bold bg-red-600 text-white shadow-xs ${sizeClasses}`}>
        <AlertTriangle className="w-3 h-3 text-white shrink-0" />
        HIGH RISK
      </span>
    );
  }

  if (normalized === 'medium') {
    return (
      <span className={`inline-flex items-center gap-1 rounded-md font-mono font-bold bg-amber-500 text-white shadow-xs ${sizeClasses}`}>
        <AlertTriangle className="w-3 h-3 text-white shrink-0" />
        MEDIUM RISK
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1 rounded-md font-mono font-bold bg-blue-600 text-white shadow-xs ${sizeClasses}`}>
      <CheckCircle2 className="w-3 h-3 text-white shrink-0" />
      LOW RISK
    </span>
  );
};

interface ActionStatusBadgeProps {
  status: ActionStatus | string;
  size?: 'sm' | 'md';
}

export const ActionStatusBadge: React.FC<ActionStatusBadgeProps> = ({ status, size = 'sm' }) => {
  const normalized = (status || '').toLowerCase();
  const sizeClasses = size === 'md' ? 'px-3 py-1 text-xs' : 'px-2.5 py-0.5 text-[10px]';

  if (normalized === 'verified' || normalized === 'closed') {
    return (
      <span className={`inline-flex items-center gap-1 rounded-full font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-300 ${sizeClasses}`}>
        <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
        ACTION VERIFIED
      </span>
    );
  }

  if (normalized.includes('progress') || normalized.includes('review')) {
    return (
      <span className={`inline-flex items-center gap-1 rounded-full font-mono font-bold bg-blue-50 text-blue-700 border border-blue-300 ${sizeClasses}`}>
        <RefreshCw className="w-3 h-3 text-blue-600 shrink-0 animate-spin-slow" />
        IN PROGRESS
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-mono font-bold bg-rose-50 text-rose-700 border border-rose-300 ${sizeClasses}`}>
      <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0" />
      ACTION OPEN
    </span>
  );
};
