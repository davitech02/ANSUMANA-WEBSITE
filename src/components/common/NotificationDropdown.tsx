import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { getStorageData } from '../../lib/storage';

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

export const NotificationDropdown: React.FC<NotificationDropdownProps> = ({ role, proponentId }) => {
  const [open, setOpen] = useState(false);
  const [readIds, setReadIds] = useState<Set<string>>(getReadIds);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const storageData = useMemo(() => getStorageData(), []);

  const notifications = useMemo<NotificationItem[]>(() => {
    const items: NotificationItem[] = [];
    const pId = proponentId;

    const isMine = (recId?: string) => (role === 'admin' ? true : !pId || recId === pId);

    storageData.schedules
      .filter((s) => isMine(s.proponent_id) && s.status === 'Overdue')
      .forEach((s) =>
        items.push({
          id: `n-sched-over-${s.id}`,
          title: `Overdue: ${s.report_type}`,
          description: `${s.proponent_name} — due ${s.due_date}`,
          time: s.due_date,
          icon: Calendar,
          path: role === 'admin' ? '/admin/schedules' : '/portal/schedules',
          tone: 'red',
        }),
      );

    storageData.schedules
      .filter((s) => isMine(s.proponent_id) && s.status === 'Pending')
      .forEach((s) =>
        items.push({
          id: `n-sched-pend-${s.id}`,
          title: `Report due: ${s.report_type}`,
          description: `${s.proponent_name} — due ${s.due_date}`,
          time: s.due_date,
          icon: Calendar,
          path: role === 'admin' ? '/admin/schedules' : '/portal/schedules',
          tone: 'amber',
        }),
      );

    storageData.permits
      .filter((p) => isMine(p.proponent_id) && (p.permit_status === 'Expired' || p.permit_status === 'Pending Renewal'))
      .forEach((p) =>
        items.push({
          id: `n-permit-${p.id}`,
          title: `${p.permit_number} ${p.permit_status.toLowerCase()}`,
          description: p.proponent_name,
          time: p.expiry_date,
          icon: FileCheck,
          path: role === 'admin' ? '/admin/permits' : '/portal/permits',
          tone: 'amber',
        }),
      );

    storageData.findings
      .filter((f) => isMine(f.proponent_id) && (f.action_status === 'Open' || f.action_status === 'Overdue'))
      .forEach((f) =>
        items.push({
          id: `n-find-${f.id}`,
          title: `Finding: ${f.finding_title}`,
          description: `${f.compliance_status} · ${f.risk_level} risk`,
          time: f.action_deadline,
          icon: AlertTriangle,
          path: role === 'admin' ? '/admin/findings' : '/portal/findings',
          tone: 'red',
        }),
      );

    storageData.evidence
      .filter((e) => isMine(e.proponent_id) && e.review_status === 'Pending review')
      .forEach((e) =>
        items.push({
          id: `n-ev-${e.id}`,
          title: 'Evidence pending review',
          description: e.file_name || e.comment || e.submitted_by || 'Evidence submission',
          time: e.created_date,
          icon: Upload,
          path: role === 'admin' ? '/admin/evidence' : '/portal/evidence',
          tone: 'blue',
        }),
      );

    storageData.bookings
      .filter((b) => (role === 'admin' ? true : b.email === userEmailOf(storageData, pId)))
      .filter((b) => b.booking_status === 'Confirmed')
      .forEach((b) =>
        items.push({
          id: `n-book-${b.id}`,
          title: 'Advisory session confirmed',
          description: `${b.company_name} — ${b.preferred_date} ${b.preferred_time}`,
          time: b.preferred_date,
          icon: Calendar,
          path: role === 'admin' ? '/admin/bookings' : '/portal/book',
          tone: 'green',
        }),
      );

    if (role === 'admin') {
      storageData.requests
        .filter((r) => r.status === 'New')
        .forEach((r) =>
          items.push({
            id: `n-req-${r.id}`,
            title: `New service request: ${r.service_needed}`,
            description: `${r.company_name} — ${r.full_name}`,
            time: r.created_date,
            icon: FileText,
            path: '/admin/requests',
            tone: 'purple',
          }),
        );
    }

    storageData.logs
      .filter((l) => isMine(l.proponent_id))
      .slice(0, 3)
      .forEach((l) =>
        items.push({
          id: `n-log-${l.id}`,
          title: `${l.channel} — ${l.notification_type}`,
          description: l.subject,
          time: l.created_date,
          icon: MessageSquare,
          path: role === 'admin' ? '/admin/logs' : '/portal/reminders',
          tone: 'gray',
        }),
      );

    // Sort newest first by ISO date, fall back to string date
    return items.sort((a, b) => (b.time || '').localeCompare(a.time || ''));
  }, [storageData, role, proponentId]);

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

function userEmailOf(data: { users: { id: string; email: string; proponent_id?: string }[] }, pId?: string): string | undefined {
  if (!pId) return undefined;
  const u = data.users.find((x) => x.proponent_id === pId || x.id === pId);
  return u?.email;
}