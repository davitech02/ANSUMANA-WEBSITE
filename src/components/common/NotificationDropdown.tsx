import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BellRing,
  Calendar,
  FileCheck,
  AlertTriangle,
  Upload,
  FileText,
  MessageSquare,
  CheckCheck,
  Inbox,
} from 'lucide-react';
import { adminApi, portalApi, workflowsApi } from '../../lib/api';

const READ_KEY = 'aec_notif_read';

export interface NotificationItem {
  id: string;
  title: string;
  description: string;
  time: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
  tone: 'green' | 'amber' | 'red' | 'blue' | 'purple' | 'gray';
}

interface NotificationDropdownProps {
  role: 'admin' | 'client';
  proponentId?: string;
}

function getReadIds(): Set<string> {
  try {
    const raw = localStorage.getItem(READ_KEY);
    if (!raw) return new Set<string>();
    const parsed = JSON.parse(raw);
    return new Set<string>(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set<string>();
  }
}

function saveReadIds(ids: Set<string>) {
  try {
    localStorage.setItem(READ_KEY, JSON.stringify(Array.from(ids)));
  } catch {
    /* ignore */
  }
}

export const NotificationDropdown: React.FC<NotificationDropdownProps> = ({ role }) => {
  const [open, setOpen] = useState(false);
  const [readIds, setReadIds] = useState<Set<string>>(getReadIds);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    async function loadNotifications() {
      const items: NotificationItem[] = [];
      try {
        if (role === 'admin') {
          const [schedules, permits, findings, evidence, bookings, requests, logs] =
            await Promise.all([
              adminApi.listSchedules({ page: 1, per_page: 50 }),
              adminApi.listPermits({ page: 1, per_page: 50 }),
              adminApi.listFindings({ page: 1, per_page: 50 }),
              adminApi.listEvidence({ page: 1, per_page: 50 }),
              adminApi.listBookings({ page: 1, per_page: 50 }),
              adminApi.listServiceRequests({ page: 1, per_page: 50 }),
              workflowsApi.listNotificationLogs({ page: 1, per_page: 3 }),
            ]);

          schedules.items
            .filter((s) => s.status === 'Overdue')
            .forEach((s) =>
              items.push({
                id: `n-sched-over-${s.id}`,
                title: `Overdue: ${s.report_type}`,
                description: `${s.proponent_name || ''} — due ${s.due_date}`,
                time: s.due_date,
                icon: Calendar,
                path: '/admin/schedules',
                tone: 'red',
              }),
            );

          schedules.items
            .filter((s) => s.status === 'Pending')
            .forEach((s) =>
              items.push({
                id: `n-sched-pend-${s.id}`,
                title: `Report due: ${s.report_type}`,
                description: `${s.proponent_name || ''} — due ${s.due_date}`,
                time: s.due_date,
                icon: Calendar,
                path: '/admin/schedules',
                tone: 'amber',
              }),
            );

          permits.items
            .filter((p) => p.status === 'Expired' || p.status === 'Pending Renewal')
            .forEach((p) =>
              items.push({
                id: `n-permit-${p.id}`,
                title: `${p.permit_number} ${p.status.toLowerCase()}`,
                description: p.proponent_name || '',
                time: p.expiry_date || '',
                icon: FileCheck,
                path: '/admin/permits',
                tone: 'amber',
              }),
            );

          findings.items
            .filter((f) => f.action_status === 'Open' || f.action_status === 'Overdue')
            .forEach((f) =>
              items.push({
                id: `n-find-${f.id}`,
                title: `Finding: ${f.finding_title}`,
                description: `${f.compliance_status} · ${f.risk_level} risk`,
                time: f.action_deadline || '',
                icon: AlertTriangle,
                path: '/admin/findings',
                tone: 'red',
              }),
            );

          evidence.items
            .filter((e) => e.review_status === 'Pending review')
            .forEach((e) =>
              items.push({
                id: `n-ev-${e.id}`,
                title: 'Evidence pending review',
                description: e.evidence_title || e.description || e.proponent_name || 'Evidence submission',
                time: e.created_at,
                icon: Upload,
                path: '/admin/evidence',
                tone: 'blue',
              }),
            );

          bookings.items
            .filter((b) => b.booking_status === 'Pending')
            .forEach((b) =>
              items.push({
                id: `n-book-pend-${b.id}`,
                title: 'New booking awaiting confirmation',
                description: `${b.company_name || b.full_name || ''} — ${b.service_needed}`,
                time: b.created_at,
                icon: Calendar,
                path: '/admin/bookings',
                tone: 'amber',
              }),
            );

          bookings.items
            .filter((b) => b.booking_status === 'Confirmed')
            .forEach((b) =>
              items.push({
                id: `n-book-${b.id}`,
                title: 'Advisory session confirmed',
                description: `${b.company_name || ''} — ${b.preferred_date || ''} ${b.preferred_time || ''}`,
                time: b.preferred_date || '',
                icon: Calendar,
                path: '/admin/bookings',
                tone: 'green',
              }),
            );

          requests.items
            .filter((r) => r.status === 'New')
            .forEach((r) =>
              items.push({
                id: `n-req-${r.id}`,
                title: `New service request: ${r.service_needed}`,
                description: `${r.company_name || ''} — ${r.full_name}`,
                time: r.created_at,
                icon: FileText,
                path: '/admin/requests',
                tone: 'purple',
              }),
            );

          logs.items.forEach((l) =>
            items.push({
              id: `n-log-${l.id}`,
              title: `${l.channel} — ${l.notification_type}`,
              description: l.subject || '',
              time: l.created_at,
              icon: MessageSquare,
              path: l.channel === 'WhatsApp' ? '/admin/whatsapp-logs' : '/admin/email-logs',
              tone: 'gray',
            }),
          );
        } else {
          const [permits, schedules, findings, evidence, reminders] = await Promise.all([
            portalApi.listClientPermits(),
            portalApi.listClientSchedules(),
            portalApi.listClientFindings(),
            portalApi.listClientEvidence(),
            portalApi.listClientReminders(),
          ]);

          schedules.items
            .filter((s) => s.status === 'Overdue')
            .forEach((s) =>
              items.push({
                id: `n-sched-over-${s.id}`,
                title: `Overdue: ${s.report_type}`,
                description: `Due ${s.due_date}`,
                time: s.due_date,
                icon: Calendar,
                path: '/portal/schedules',
                tone: 'red',
              }),
            );

          schedules.items
            .filter((s) => s.status === 'Pending')
            .forEach((s) =>
              items.push({
                id: `n-sched-pend-${s.id}`,
                title: `Report due: ${s.report_type}`,
                description: `Due ${s.due_date}`,
                time: s.due_date,
                icon: Calendar,
                path: '/portal/schedules',
                tone: 'amber',
              }),
            );

          permits.items
            .filter((p) => p.permit_status === 'Expired' || p.permit_status === 'Pending Renewal')
            .forEach((p) =>
              items.push({
                id: `n-permit-${p.id}`,
                title: `${p.permit_number} ${p.permit_status.toLowerCase()}`,
                description: 'Requires renewal or status review',
                time: p.expiry_date || '',
                icon: FileCheck,
                path: '/portal/permits',
                tone: 'amber',
              }),
            );

          findings.items
            .filter((f) => f.action_status === 'Open' || f.action_status === 'Overdue')
            .forEach((f) =>
              items.push({
                id: `n-find-${f.id}`,
                title: `Finding: ${f.finding_title}`,
                description: `${f.compliance_status} · ${f.risk_level} risk`,
                time: f.action_deadline || '',
                icon: AlertTriangle,
                path: '/portal/findings',
                tone: 'red',
              }),
            );

          evidence.items
            .filter((e) => e.review_status === 'Pending review')
            .forEach((e) =>
              items.push({
                id: `n-ev-${e.id}`,
                title: 'Evidence pending review',
                description: e.evidence_title || e.description || 'Evidence submission',
                time: e.created_at,
                icon: Upload,
                path: '/portal/evidence',
                tone: 'blue',
              }),
            );

          reminders.items.slice(0, 3).forEach((l) =>
            items.push({
              id: `n-log-${l.id}`,
              title: `${l.channel} — ${l.notification_type}`,
              description: l.subject || '',
              time: l.created_at,
              icon: MessageSquare,
              path: '/portal/reminders',
              tone: 'gray',
            }),
          );
        }
      } catch {
        /* notification loading is non-critical */
      }

      if (!cancelled) {
        setNotifications(items.sort((a, b) => (b.time || '').localeCompare(a.time || '')));
      }
    }
    loadNotifications();
    return () => {
      cancelled = true;
    };
  }, [role]);

  const unreadCount = notifications.filter((n) => !readIds.has(n.id)).length;

  const close = useCallback(() => setOpen(false), []);

  // Outside click + Escape
  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        close();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, close]);

  const markAllRead = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = new Set<string>(notifications.map((n) => n.id));
    setReadIds(next);
    saveReadIds(next);
  };

  const openItem = (n: NotificationItem) => {
    const next = new Set<string>(readIds);
    next.add(n.id);
    setReadIds(next);
    saveReadIds(next);
    close();
    navigate(n.path);
  };

  const toneClasses: Record<NotificationItem['tone'], string> = {
    green: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-100 dark:text-emerald-800',
    amber: 'bg-amber-100 text-amber-900 dark:bg-amber-100 dark:text-amber-900',
    red: 'bg-red-100 text-red-700 dark:bg-red-100 dark:text-red-700',
    blue: 'bg-blue-100 text-blue-700 dark:bg-blue-100 dark:text-blue-700',
    purple: 'bg-purple-100 text-purple-700 dark:bg-purple-100 dark:text-purple-700',
    gray: 'bg-gray-200 text-gray-600 dark:bg-gray-200 dark:text-gray-600',
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:text-[#0A2E24] hover:bg-gray-100 dark:border-gray-300 dark:text-gray-300 dark:hover:text-[#D4AF37] dark:hover:bg-gray-200 relative transition-colors"
        aria-label="Notifications"
        aria-expanded={open}
      >
        <BellRing className="w-4 h-4 text-[#0A2E24] dark:text-gray-300" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse border-2 border-white dark:border-gray-900" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-[#14231E] rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-300 py-2 z-50 animate-fadeIn max-w-[calc(100vw-2rem)]">
          <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-300 flex items-center justify-between gap-2 bg-gray-50 dark:bg-gray-200 rounded-t-2xl">
            <span className="font-heading font-bold text-xs text-[#0A2E24] dark:text-[#D4AF37] flex items-center gap-1.5">
              <BellRing className="w-3.5 h-3.5 text-[#D4AF37]" /> Alerts &amp; Notifications
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-bold bg-[#0A2E24] text-[#D4AF37] px-2 py-0.5 rounded-full">
                {unreadCount} New
              </span>
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-[10px] font-mono font-bold text-gray-500 hover:text-[#0A2E24] dark:hover:text-[#D4AF37] flex items-center gap-0.5"
                >
                  <CheckCheck className="w-3 h-3" /> Mark all read
                </button>
              )}
            </div>
          </div>

          {notifications.length === 0 ? (
            <div className="p-8 text-center space-y-2">
              <Inbox className="w-8 h-8 text-[#D4AF37] mx-auto opacity-80" />
              <p className="text-xs font-bold text-[#0A2E24] dark:text-gray-200">You&apos;re all caught up</p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">No new alerts for your account.</p>
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-300">
              {notifications.slice(0, 10).map((n) => {
                const Icon = n.icon;
                const isRead = readIds.has(n.id);
                return (
                  <button
                    key={n.id}
                    onClick={() => openItem(n)}
                    className="w-full text-left p-3 hover:bg-gray-50 dark:hover:bg-gray-200 transition-colors flex items-start gap-3"
                  >
                    <span
                      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${toneClasses[n.tone]}`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-bold text-gray-900 dark:text-gray-100 truncate">
                        {n.title}
                      </span>
                      <span className="block text-[11px] text-gray-600 dark:text-gray-400 truncate">
                        {n.description}
                      </span>
                      <span className="block text-[9px] font-mono text-gray-400 dark:text-gray-500 mt-0.5">
                        {n.time}
                      </span>
                    </span>
                    {!isRead && <span className="w-2 h-2 rounded-full bg-[#D4AF37] shrink-0 mt-1" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};