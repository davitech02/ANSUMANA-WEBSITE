import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link, NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Building2,
  FileCheck,
  CalendarClock,
  AlertTriangle,
  Upload,
  MessageSquare,
  Calendar,
  History,
  Settings,
  LogOut,
  Menu,
  X,
  ExternalLink,
  ShieldAlert,
  UserCheck,
  ChevronDown,
  BellRing,
  Search,
  Plus,
  ChevronRight,
  Command,
  CheckCircle2,
  Mail,
  HelpCircle,
  PhoneCall,
  FileText,
} from 'lucide-react';
import { useAuth } from '../../lib/AuthContext';
import { adminApi, portalApi, workflowsApi } from '../../lib/api';
import { ProfileMenu } from '../common/ProfileMenu';
import { ThemeToggle } from '../common/ThemeToggle';
import { Breadcrumbs } from '../common/Breadcrumbs';
import { NotificationDropdown } from '../common/NotificationDropdown';

interface PortalCounts {
  proponents?: number;
  permits?: number;
  schedules?: number;
  findings?: number;
  evidence?: number;
  requests?: number;
  bookings?: number;
  sessions?: number;
  expiring?: number;
}

interface SearchResultItem {
  type: string;
  title: string;
  subtitle: string;
  path: string;
}

const LOGO_URL =
  'https://media.base44.com/images/public/6a41d19b1eb6cd6bf679b527/c2b37abf0_ChatGPTImageJul28202601_07_19AM.png';

interface PortalLayoutProps {
  role?: 'admin' | 'client';
}

export const PortalLayout: React.FC<PortalLayoutProps> = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [quickActionOpen, setQuickActionOpen] = useState(false);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [counts, setCounts] = useState<PortalCounts>({});
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
  const [showToastBanner, setShowToastBanner] = useState(true);
  const quickActionRef = useRef<HTMLDivElement>(null);

  const { user, proponent, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const isSectionAdmin = location.pathname.startsWith('/admin');
  const role = isSectionAdmin ? 'admin' : (location.pathname.startsWith('/portal') ? 'client' : (user?.role === 'admin' ? 'admin' : 'client'));

  // Load portal badge/toast counts from the live backend.
  useEffect(() => {
    let cancelled = false;
    async function loadCounts() {
      try {
        if (role === 'admin') {
          const summary = await workflowsApi.dashboardSummary();
          if (cancelled) return;
          setCounts({
            proponents: summary.proponents.active,
            permits: summary.permits.expired + summary.permits.pending_renewal,
            schedules: summary.schedules.overdue + summary.schedules.pending,
            findings: summary.findings.open,
            evidence: summary.evidence.pending_review,
            requests: summary.service_requests.new,
            bookings: summary.bookings.confirmed,
            sessions: summary.bookings.confirmed,
            expiring: summary.permits.expired + summary.permits.pending_renewal,
          });
        } else {
          const [permits, schedules, findings, evidence] = await Promise.all([
            portalApi.listClientPermits(),
            portalApi.listClientSchedules(),
            portalApi.listClientFindings(),
            portalApi.listClientEvidence(),
          ]);
          if (cancelled) return;
          const pendingSchedules = schedules.items.filter(
            (s) => s.status === 'Pending' || s.status === 'Overdue',
          ).length;
          const openFindings = findings.items.filter((f) => f.action_status === 'Open').length;
          const pendingEvidence = evidence.items.filter(
            (e) => e.review_status === 'Pending review',
          ).length;
          const expiring = permits.items.filter(
            (p) => p.permit_status === 'Expired' || p.permit_status === 'Pending Renewal',
          ).length;
          setCounts({
            permits: permits.items.length,
            schedules: pendingSchedules,
            findings: openFindings,
            evidence: pendingEvidence,
            expiring,
          });
        }
      } catch {
        /* counts are non-critical; leave them empty */
      }
    }
    loadCounts();
    return () => {
      cancelled = true;
    };
  }, [role]);

  // Outside click + Escape to close Quick Action
  useEffect(() => {
    const handlePointerDown = (e: MouseEvent) => {
      if (quickActionRef.current && !quickActionRef.current.contains(e.target as Node)) {
        setQuickActionOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setQuickActionOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Keyboard shortcut Ctrl+K / Cmd+K for command palette
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchModalOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Calculate badge numbers from the live dashboard/portal data
  const badges = useMemo(() => {
    if (role === 'admin') {
      return {
        proponents: counts.proponents,
        permits: counts.permits && counts.permits > 0 ? counts.permits : undefined,
        schedules: counts.schedules && counts.schedules > 0 ? counts.schedules : undefined,
        findings: counts.findings && counts.findings > 0 ? counts.findings : undefined,
        evidence: counts.evidence && counts.evidence > 0 ? counts.evidence : undefined,
        requests: counts.requests && counts.requests > 0 ? counts.requests : undefined,
        bookings: counts.bookings && counts.bookings > 0 ? counts.bookings : undefined,
      };
    }
    return {
      permits: counts.permits,
      schedules: counts.schedules && counts.schedules > 0 ? counts.schedules : undefined,
      findings: counts.findings && counts.findings > 0 ? counts.findings : undefined,
      evidence: counts.evidence && counts.evidence > 0 ? counts.evidence : undefined,
    };
  }, [counts, role]);

  // Grouped Navigation Items matching reference image
  const adminNavGroups = useMemo(() => [
    {
      groupTitle: 'MENU',
      items: [
        { name: 'Dashboard', path: '/admin', icon: LayoutDashboard },
        { name: 'Proponent Companies', path: '/admin/proponents', icon: Building2, badge: badges.proponents },
        { name: 'EPA Permits', path: '/admin/permits', icon: FileCheck, badge: badges.permits, badgeColor: 'bg-amber-500' },
        { name: 'Report Schedules', path: '/admin/schedules', icon: CalendarClock, badge: badges.schedules, badgeColor: 'bg-red-500' },
        { name: 'Findings & Actions', path: '/admin/findings', icon: AlertTriangle, badge: badges.findings, badgeColor: 'bg-red-500' },
        { name: 'Evidence Review', path: '/admin/evidence', icon: Upload, badge: badges.evidence, badgeColor: 'bg-blue-500' },
        { name: 'Client Requests', path: '/admin/requests', icon: FileText, badge: badges.requests, badgeColor: 'bg-purple-500' },
        { name: 'Session Bookings', path: '/admin/bookings', icon: Calendar, badge: badges.bookings, badgeColor: 'bg-emerald-500' },
      ],
    },
    {
      groupTitle: 'SYSTEM & LOGS',
      items: [
        { name: 'Audit Trail Logs', path: '/admin/logs', icon: History },
        { name: 'Email Dispatch Logs', path: '/admin/email-logs', icon: Mail },
        { name: 'WhatsApp Logs', path: '/admin/whatsapp-logs', icon: MessageSquare },
        { name: 'System Settings', path: '/admin/settings', icon: Settings },
      ],
    },
    {
      groupTitle: 'SUPPORT',
      items: [
        { name: 'Support Helpdesk', path: '/admin/support', icon: HelpCircle },
        { name: 'Contact AEC', path: '/admin/contact', icon: PhoneCall },
      ],
    },
  ], [badges]);

  const clientNavGroups = useMemo(() => [
    {
      groupTitle: 'MENU',
      items: [
        { name: 'Dashboard', path: '/portal', icon: LayoutDashboard },
        { name: 'Company Profile', path: '/portal/company', icon: Building2 },
        { name: 'My EPA Permits', path: '/portal/permits', icon: FileCheck, badge: badges.permits },
        { name: 'Report Schedules', path: '/portal/schedules', icon: CalendarClock, badge: badges.schedules, badgeColor: 'bg-red-500' },
        { name: 'Non-Compliance Findings', path: '/portal/findings', icon: AlertTriangle, badge: badges.findings, badgeColor: 'bg-red-500' },
        { name: 'Evidence Uploads', path: '/portal/evidence', icon: Upload, badge: badges.evidence, badgeColor: 'bg-blue-500' },
        { name: 'Book Advisory Session', path: '/portal/book', icon: Calendar },
        { name: 'Reminders & Alerts', path: '/portal/reminders', icon: BellRing },
      ],
    },
    {
      groupTitle: 'SUPPORT',
      items: [
        { name: 'Support & Helpdesk', path: '/portal/support', icon: HelpCircle },
        { name: 'Contact AEC', path: '/portal/contact', icon: PhoneCall },
      ],
    },
  ], [badges]);

  const navGroups = useMemo(() => role === 'admin' ? adminNavGroups : clientNavGroups, [role, adminNavGroups, clientNavGroups]);

  // Mobile Bottom Navigation Bar Items (4 key links + Menu trigger)
  const mobileBottomNav = role === 'admin' ? [
    { name: 'Dashboard', path: '/admin', icon: LayoutDashboard },
    { name: 'Proponents', path: '/admin/proponents', icon: Building2 },
    { name: 'Permits', path: '/admin/permits', icon: FileCheck, badge: badges.permits },
    { name: 'Schedules', path: '/admin/schedules', icon: CalendarClock, badge: badges.schedules },
  ] : [
    { name: 'Dashboard', path: '/portal', icon: LayoutDashboard },
    { name: 'Permits', path: '/portal/permits', icon: FileCheck },
    { name: 'Deadlines', path: '/portal/schedules', icon: CalendarClock, badge: badges.schedules },
    { name: 'Uploads', path: '/portal/evidence', icon: Upload, badge: badges.evidence },
  ];

  const handleSignOut = async () => {
    await logout();
    navigate('/login');
  };

  // Build current breadcrumb route label
  const getBreadcrumbLabel = () => {
    const p = location.pathname;
    if (p === '/admin') return 'Admin Compliance Center';
    if (p === '/admin/proponents') return 'Proponent Companies';
    if (p === '/admin/permits') return 'EPA Permits Management';
    if (p === '/admin/schedules') return 'Report Schedules & Countdowns';
    if (p === '/admin/findings') return 'Non-Compliance Findings & Corrective Actions';
    if (p === '/admin/evidence') return 'Evidence Review & Field Verification';
    if (p === '/admin/requests') return 'Client Service Requests';
    if (p === '/admin/bookings') return 'Advisory Session Bookings';
    if (p === '/admin/logs') return 'Notification Audit Logs';
    if (p === '/admin/email-logs') return 'Email Dispatch Audit Trail';
    if (p === '/admin/whatsapp-logs') return 'WhatsApp Alert Audit Logs';
    if (p === '/admin/settings') return 'AEC System Settings';
    if (p === '/admin/support') return 'Support Helpdesk';
    if (p === '/admin/contact') return 'Contact AEC';

    if (p === '/portal') return 'Client Dashboard';
    if (p === '/portal/company') return 'Company Profile & Info';
    if (p === '/portal/permits') return 'My EPA Permits';
    if (p === '/portal/schedules') return 'Report Schedules & Deadlines';
    if (p === '/portal/findings') return 'My Non-Compliance Findings';
    if (p === '/portal/evidence') return 'Evidence Uploads';
    if (p === '/portal/book') return 'Book Advisory Session';
    if (p === '/portal/reminders') return 'Reminders & Notifications';
    if (p === '/portal/support') return 'EPA Statutory Help & Support';
    if (p === '/portal/contact') return 'Contact AEC Headquarters';

    return 'Compliance Portal';
  };

  // Notifications for toast banner
  const upcomingSessionsCount = counts.sessions || 0;
  const expiringPermitsCount = counts.expiring || 0;

  // Search Results inside Command Palette (pages + live records)
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const q = searchQuery.toLowerCase();
    const handle = window.setTimeout(async () => {
      const items: SearchResultItem[] = [];

      // Search Pages
      navGroups.forEach((g) => {
        g.items.forEach((item) => {
          if (item.name.toLowerCase().includes(q)) {
            items.push({
              type: 'Page Navigation',
              title: item.name,
              subtitle: g.groupTitle,
              path: item.path,
            });
          }
        });
      });

      try {
        if (role === 'admin') {
          const [permits, proponents] = await Promise.all([
            adminApi.listPermits({ q: searchQuery.trim(), page: 1, per_page: 8 }),
            adminApi.listProponents({ q: searchQuery.trim(), page: 1, per_page: 8 }),
          ]);
          permits.items.forEach((p) => {
            items.push({
              type: 'EPA Permit Record',
              title: `${p.permit_number} (${p.permit_type})`,
              subtitle: `Proponent: ${p.proponent_name || ''} • Status: ${p.status}`,
              path: '/admin/permits',
            });
          });
          proponents.items.forEach((prop) => {
            items.push({
              type: 'Proponent Company',
              title: prop.company_name,
              subtitle: `${prop.contact_person} • ${prop.county || ''}, Liberia`,
              path: '/admin/proponents',
            });
          });
        } else {
          const [permits, schedules] = await Promise.all([
            portalApi.listClientPermits(),
            portalApi.listClientSchedules(),
          ]);
          permits.items
            .filter(
              (p) =>
                p.permit_number.toLowerCase().includes(q) ||
                p.permit_type.toLowerCase().includes(q),
            )
            .forEach((p) => {
              items.push({
                type: 'EPA Permit Record',
                title: `${p.permit_number} (${p.permit_type})`,
                subtitle: `Status: ${p.permit_status}`,
                path: '/portal/permits',
              });
            });
          schedules.items
            .filter((s) => s.report_type.toLowerCase().includes(q))
            .forEach((s) => {
              items.push({
                type: 'Report Schedule',
                title: s.report_type,
                subtitle: `Due: ${s.due_date} • ${s.status}`,
                path: '/portal/schedules',
              });
            });
        }
      } catch {
        /* search failures are non-critical */
      }

      setSearchResults(items.slice(0, 8));
    }, 250);
    return () => window.clearTimeout(handle);
  }, [searchQuery, navGroups, role]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col md:flex-row font-sans text-gray-800 antialiased selection:bg-[#D4AF37] selection:text-[#0A2E24]">
      {/* Mobile Drawer Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 md:hidden transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Sidebar (Sticky Desktop & Drawer Mobile) */}
      <aside
        className={`fixed md:sticky top-0 left-0 bottom-0 z-50 w-72 bg-[#0A2E24] text-white flex flex-col border-r border-[#D4AF37]/30 shadow-2xl transition-transform duration-300 h-screen shrink-0 overflow-hidden ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Brand Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between bg-[#08241C]">
          <Link to="/" className="flex items-center gap-3 group">
            <img
              src={LOGO_URL}
              alt="AEC Logo"
              className="h-9 w-auto object-contain transition-transform group-hover:scale-105"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
            <div>
              <span className="font-heading font-extrabold text-sm text-white block leading-none tracking-tight">
                ANSUMANA
              </span>
              <span className="text-[10px] text-[#D4AF37] font-mono tracking-wider uppercase block mt-0.5">
                {role === 'admin' ? 'EPA Admin Portal' : 'Proponent Portal'}
              </span>
            </div>
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="md:hidden text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/10"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User / Proponent Info Profile Widget */}
        <div className="px-4 py-3 bg-[#1A4A3A]/80 border-b border-[#D4AF37]/20 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-8 h-8 rounded-full bg-[#D4AF37] text-[#0A2E24] font-bold flex items-center justify-center text-xs shrink-0 shadow-md">
              {role === 'admin' ? 'ADM' : 'CLT'}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-semibold text-white truncate leading-tight">
                {user?.full_name || 'AEC Portal User'}
              </p>
              <p className="text-[10px] text-[#D4AF37] font-mono truncate">
                {role === 'admin' ? 'System Administrator' : proponent?.company_name || user?.email}
              </p>
            </div>
          </div>
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            Active
          </span>
        </div>

        {/* Command Palette Quick Trigger in Sidebar */}
        <div className="px-3 pt-3">
          <button
            onClick={() => setSearchModalOpen(true)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-gray-300 hover:bg-white/10 hover:text-white transition-all shadow-inner group"
          >
            <span className="flex items-center gap-2">
              <Search className="w-3.5 h-3.5 text-[#D4AF37] group-hover:scale-110 transition-transform" />
              <span>Quick Jump / Search...</span>
            </span>
            <span className="font-mono text-[10px] bg-white/10 text-gray-300 px-1.5 py-0.5 rounded border border-white/10">
              Ctrl+K
            </span>
          </button>
        </div>

        {/* Grouped Sidebar Menu Items */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-4 scrollbar-thin scrollbar-thumb-white/10">
          {navGroups.map((group, gIdx) => (
            <div key={gIdx} className="space-y-1">
              <div className="px-3 text-[10px] font-mono uppercase font-bold tracking-wider text-[#D4AF37]/80 mb-1">
                {group.groupTitle}
              </div>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      end={item.path === '/admin' || item.path === '/portal'}
                      onClick={() => setSidebarOpen(false)}
                      className={({ isActive }) =>
                        `flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all group ${
                          isActive
                            ? 'bg-[#1A4A3A] text-white font-bold border-l-4 border-[#D4AF37] shadow-sm'
                            : 'text-gray-300 hover:bg-white/5 hover:text-white'
                        }`
                      }
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <Icon className="w-4 h-4 shrink-0 text-[#D4AF37] group-hover:scale-110 transition-transform" />
                        <span className="truncate">{item.name}</span>
                      </div>
                      {item.badge !== undefined && (
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold text-white shrink-0 shadow-sm ${
                            item.badgeColor || 'bg-[#D4AF37] text-[#0A2E24]'
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Bottom Actions */}
        <div className="p-3 border-t border-white/10 bg-[#08241C] space-y-1">
          <Link
            to="/"
            className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-gray-300 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
          >
            <ExternalLink className="w-4 h-4 text-[#D4AF37]" />
            Back to Public Website
          </Link>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-red-400 hover:text-red-300 rounded-lg hover:bg-red-500/10 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Viewport */}
      <div className="flex-1 flex flex-col min-w-0 pb-16 md:pb-0 overflow-hidden">
        {/* Sticky Top Header */}
        <header className="sticky top-0 z-30 bg-white border-b border-gray-200 px-3 sm:px-5 py-2 shadow-xs flex items-center justify-between gap-2 sm:gap-4">
          {/* Left: Menu Toggle + Logo */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0 min-w-0">
            <button
              onClick={() => setSidebarOpen((prev) => !prev)}
              className="flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg border border-gray-200 text-gray-700 hover:text-[#0A2E24] hover:bg-gray-100 transition-colors shadow-2xs font-bold text-xs shrink-0"
              aria-label="Toggle navigation menu"
            >
              <Menu className="w-5 h-5 text-[#0A2E24]" />
              <span className="hidden md:inline font-sans text-xs font-bold">Menu</span>
            </button>

            {/* EPA AEC Logo Badge in Dashboard Header */}
            <Link
              to={role === 'admin' ? '/admin' : '/portal'}
              className="flex items-center gap-2 shrink-0 group hover:opacity-95 transition-opacity"
              title="Return to Dashboard Home"
            >
              <div className="w-9 h-9 rounded-xl bg-[#0A2E24] p-1 border border-[#D4AF37]/50 flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                <img src={LOGO_URL} alt="EPA AEC Logo" className="w-full h-full object-contain" />
              </div>
            </Link>

            {role === 'admin' ? (
              <span className="hidden lg:inline-flex items-center gap-1.5 text-[11px] bg-[#0A2E24] text-[#D4AF37] px-2.5 py-1 rounded-lg font-mono font-bold shadow-xs shrink-0">
                <ShieldAlert className="w-3.5 h-3.5" /> EPA ADMIN
              </span>
            ) : (
              <span className="hidden lg:inline-flex items-center gap-1.5 text-[11px] bg-[#1A4A3A] text-[#D4AF37] px-2.5 py-1 rounded-lg font-mono font-bold shadow-xs shrink-0">
                <UserCheck className="w-3.5 h-3.5" /> CLIENT PORTAL
              </span>
            )}
          </div>

          {/* Center: Search (flex-1, hidden on mobile) */}
          <div className="hidden sm:flex flex-1 items-center justify-center min-w-0 px-2 lg:px-6">
            <button
              onClick={() => setSearchModalOpen(true)}
              className="flex items-center gap-2 w-full max-w-lg min-w-0 text-xs text-gray-500 bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded-lg border border-gray-200 transition-colors"
            >
              <Search className="w-3.5 h-3.5 text-[#0A2E24] shrink-0" />
              <span className="truncate">Search permits or pages...</span>
              <span className="font-mono text-[9px] bg-white text-gray-600 px-1.5 py-0.5 rounded border border-gray-300 shrink-0 ml-auto">
                /
              </span>
            </button>
          </div>

          {/* Right: Quick Action, Theme Toggle, Notifications, Profile */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            {/* Quick Action Button Dropdown */}
            <div className="relative" ref={quickActionRef}>
              <button
                onClick={() => setQuickActionOpen(!quickActionOpen)}
                className="flex items-center gap-1.5 bg-[#0A2E24] text-[#D4AF37] hover:bg-[#1A4A3A] px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-xs"
                aria-label="Quick actions"
                aria-expanded={quickActionOpen}
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Quick Action</span>
                <ChevronDown className="w-3 h-3" />
              </button>

              {quickActionOpen && (
                <div
                  className="absolute right-0 mt-2 w-56 bg-white dark:bg-[#14231E] rounded-xl shadow-xl border border-gray-200 dark:border-gray-300 py-1.5 z-50 animate-fadeIn"
                  onMouseLeave={() => setQuickActionOpen(false)}
                >
                  <div className="px-3 py-1.5 border-b border-gray-100 dark:border-gray-300 text-[10px] font-mono text-gray-400 uppercase font-bold">
                    System Quick Actions
                  </div>
                  {role === 'admin' ? (
                    <>
                      <Link
                        to="/admin/proponents"
                        onClick={() => setQuickActionOpen(false)}
                        className="flex items-center gap-2.5 px-3 py-2 text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-200"
                      >
                        <Building2 className="w-3.5 h-3.5 text-[#D4AF37]" /> Register Proponent
                      </Link>
                      <Link
                        to="/admin/permits"
                        onClick={() => setQuickActionOpen(false)}
                        className="flex items-center gap-2.5 px-3 py-2 text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-200"
                      >
                        <FileCheck className="w-3.5 h-3.5 text-[#D4AF37]" /> Issue EPA Permit
                      </Link>
                      <Link
                        to="/admin/schedules"
                        onClick={() => setQuickActionOpen(false)}
                        className="flex items-center gap-2.5 px-3 py-2 text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-200"
                      >
                        <CalendarClock className="w-3.5 h-3.5 text-[#D4AF37]" /> Schedule Audit Deadline
                      </Link>
                      <Link
                        to="/admin/findings"
                        onClick={() => setQuickActionOpen(false)}
                        className="flex items-center gap-2.5 px-3 py-2 text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-200"
                      >
                        <AlertTriangle className="w-3.5 h-3.5 text-[#D4AF37]" /> Log Non-Compliance Finding
                      </Link>
                      <Link
                        to="/admin/evidence"
                        onClick={() => setQuickActionOpen(false)}
                        className="flex items-center gap-2.5 px-3 py-2 text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-200"
                      >
                        <Upload className="w-3.5 h-3.5 text-[#D4AF37]" /> Review Evidence Uploads
                      </Link>
                      <Link
                        to="/admin/requests"
                        onClick={() => setQuickActionOpen(false)}
                        className="flex items-center gap-2.5 px-3 py-2 text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-200"
                      >
                        <FileText className="w-3.5 h-3.5 text-[#D4AF37]" /> View Client Requests
                      </Link>
                    </>
                  ) : (
                    <>
                      <Link
                        to="/portal/evidence"
                        onClick={() => setQuickActionOpen(false)}
                        className="flex items-center gap-2.5 px-3 py-2 text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-200"
                      >
                        <Upload className="w-3.5 h-3.5 text-[#D4AF37]" /> Submit Evidence File
                      </Link>
                      <Link
                        to="/portal/book"
                        onClick={() => setQuickActionOpen(false)}
                        className="flex items-center gap-2.5 px-3 py-2 text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-200"
                      >
                        <Calendar className="w-3.5 h-3.5 text-[#D4AF37]" /> Book Advisory Session
                      </Link>
                      <Link
                        to="/portal/permits"
                        onClick={() => setQuickActionOpen(false)}
                        className="flex items-center gap-2.5 px-3 py-2 text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-200"
                      >
                        <FileCheck className="w-3.5 h-3.5 text-[#D4AF37]" /> View My Permits
                      </Link>
                      <Link
                        to="/portal/schedules"
                        onClick={() => setQuickActionOpen(false)}
                        className="flex items-center gap-2.5 px-3 py-2 text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-200"
                      >
                        <CalendarClock className="w-3.5 h-3.5 text-[#D4AF37]" /> Check Report Deadlines
                      </Link>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Theme Toggle */}
            <ThemeToggle variant="light" />

            {/* Notifications Dropdown */}
            <NotificationDropdown role={role} proponentId={proponent?.id} />

            {/* Profile Dropdown Menu in Header */}
            <ProfileMenu
              variant="light"
              onViewAccount={() => setProfileModalOpen(true)}
              onLogout={handleSignOut}
            />
          </div>
        </header>

        {/* Sub-Header Breadcrumbs Bar */}
        <div className="bg-white dark:bg-[#14231E] border-b border-gray-200 dark:border-gray-300 px-4 sm:px-6 py-2 flex items-center justify-between gap-3 text-xs text-gray-500 dark:text-gray-400 font-mono">
          <Breadcrumbs
            items={[
              { label: role === 'admin' ? 'Admin' : 'Portal', to: role === 'admin' ? '/admin' : '/portal' },
              { label: getBreadcrumbLabel() },
            ]}
          />
          <span className="hidden md:inline-flex items-center gap-1 text-[11px] text-emerald-700 dark:text-emerald-700 bg-emerald-50 dark:bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-300">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> EPA Liberia Portal Synchronized
          </span>
        </div>

        {/* Dynamic Outlet Page Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-4">
          {/* Upcoming Sessions / Expiring Permits Toast Banner */}
          {showToastBanner && (upcomingSessionsCount > 0 || expiringPermitsCount > 0) && (
            <div className="bg-gradient-to-r from-[#0A2E24] via-[#1A4A3A] to-[#0A2E24] text-white p-3.5 rounded-2xl shadow-lg border border-[#D4AF37]/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fadeIn">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-[#D4AF37] text-[#0A2E24] flex items-center justify-center shrink-0 shadow-sm font-bold">
                  <BellRing className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-heading font-extrabold text-[#D4AF37] flex items-center gap-1.5">
                    <span>UPCOMING SESSIONS & STATUTORY ALERTS</span>
                    <span className="px-1.5 py-0.2 bg-red-500 text-white rounded text-[9px] font-mono">ACTION REQUIRED</span>
                  </p>
                  <p className="text-xs text-gray-200 mt-0.5">
                    You have <strong className="text-white underline">{upcomingSessionsCount} confirmed advisory sessions</strong> booked and <strong className="text-[#D4AF37] underline">{expiringPermitsCount} EPA permits</strong> requiring renewal or status review.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                <Link
                  to={role === 'admin' ? '/admin/bookings' : '/portal/book'}
                  className="px-3 py-1.5 bg-[#D4AF37] text-[#0A2E24] hover:bg-[#E5C964] font-heading font-bold text-xs rounded-xl transition-all shadow-xs"
                >
                  View Booked Sessions
                </Link>
                <button
                  onClick={() => setShowToastBanner(false)}
                  className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/10"
                  aria-label="Dismiss alert"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          <Outlet />
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar (Fixed at bottom on phones) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0A2E24] border-t border-[#D4AF37]/30 flex justify-around items-center p-1 shadow-2xl">
        {mobileBottomNav.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/admin' || item.path === '/portal'}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center py-1 px-2 rounded-lg text-[10px] font-medium transition-colors relative ${
                  isActive ? 'text-[#D4AF37] font-bold bg-[#1A4A3A]' : 'text-gray-300 hover:text-white'
                }`
              }
            >
              <div className="relative">
                <Icon className="w-5 h-5 mb-0.5" />
                {item.badge !== undefined && (
                  <span className="absolute -top-1 -right-2 bg-red-500 text-white text-[8px] font-bold px-1 rounded-full">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className="truncate max-w-[60px]">{item.name}</span>
            </NavLink>
          );
        })}

        <button
          onClick={() => setSidebarOpen(true)}
          className="flex flex-col items-center justify-center py-1 px-2 rounded-lg text-[10px] font-medium text-gray-300 hover:text-white"
        >
          <Menu className="w-5 h-5 mb-0.5 text-[#D4AF37]" />
          <span>Menu</span>
        </button>
      </div>

      {/* Command Palette Modal (Ctrl+K or Header Search) */}
      {searchModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-xl overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex items-center gap-3 bg-gray-50">
              <Search className="w-5 h-5 text-[#0A2E24]" />
              <input
                type="text"
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search pages, permit numbers (e.g., EPA-LR), or proponents..."
                className="w-full text-sm focus:outline-none bg-transparent"
              />
              <button
                onClick={() => setSearchModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto p-2 divide-y divide-gray-100">
              {searchQuery.trim() === '' ? (
                <div className="p-6 text-center text-xs text-gray-500 space-y-2">
                  <Command className="w-8 h-8 text-[#D4AF37] mx-auto opacity-80" />
                  <p className="font-bold text-[#0A2E24]">Portal Quick Command Palette</p>
                  <p>Type to jump to any page, EPA permit record, or proponent profile.</p>
                </div>
              ) : searchResults.length === 0 ? (
                <div className="p-6 text-center text-xs text-gray-500">
                  No records or pages matching &quot;{searchQuery}&quot;
                </div>
              ) : (
                searchResults.map((res, rIdx) => (
                  <button
                    key={rIdx}
                    onClick={() => {
                      setSearchModalOpen(false);
                      setSearchQuery('');
                      navigate(res.path);
                    }}
                    className="w-full text-left p-3 hover:bg-gray-50 rounded-xl transition-colors flex items-center justify-between group"
                  >
                    <div>
                      <span className="text-[10px] font-mono text-[#D4AF37] uppercase font-bold block">
                        {res.type}
                      </span>
                      <p className="text-xs font-bold text-[#0A2E24] group-hover:text-[#D4AF37] transition-colors">
                        {res.title}
                      </p>
                      <p className="text-[11px] text-gray-500 truncate">{res.subtitle}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-[#D4AF37] transition-colors" />
                  </button>
                ))
              )}
            </div>

            <div className="p-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between text-[11px] font-mono text-gray-500">
              <span>Press ESC or click outside to exit</span>
              <span className="text-[#0A2E24] font-bold">AEC Liberia Compliance System</span>
            </div>
          </div>
        </div>
      )}

      {/* Account Profile Details Modal */}
      {profileModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-gray-200">
            <div className="p-6 bg-[#0A2E24] text-white flex items-center justify-between border-b border-[#D4AF37]/30">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-[#D4AF37] text-[#0A2E24] font-extrabold text-lg flex items-center justify-center shadow-lg shrink-0">
                  {user?.full_name?.charAt(0) || 'U'}
                </div>
                <div>
                  <h3 className="font-heading font-extrabold text-lg text-white leading-tight">User Account Profile</h3>
                  <p className="text-xs text-[#D4AF37] font-mono mt-0.5">EPA Compliance Hub Account Information</p>
                </div>
              </div>
              <button
                onClick={() => setProfileModalOpen(false)}
                className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs font-sans">
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-gray-200">
                  <span className="text-gray-500 font-medium">Full Name:</span>
                  <span className="font-extrabold text-gray-900">{user?.full_name || 'N/A'}</span>
                </div>
                <div className="flex items-center justify-between pb-2 border-b border-gray-200">
                  <span className="text-gray-500 font-medium">Email Address:</span>
                  <span className="font-bold text-[#0A2E24] font-mono">{user?.email || 'N/A'}</span>
                </div>
                <div className="flex items-center justify-between pb-2 border-b border-gray-200">
                  <span className="text-gray-500 font-medium">Account Role:</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-[#0A2E24] text-[#D4AF37]">
                    {role === 'admin' ? 'EPA System Administrator' : 'Licensed Proponent'}
                  </span>
                </div>
                {proponent && (
                  <div className="flex items-center justify-between pb-2 border-b border-gray-200">
                    <span className="text-gray-500 font-medium">Associated Company:</span>
                    <span className="font-bold text-gray-900">{proponent.company_name}</span>
                  </div>
                )}
                <div className="flex items-center justify-between pb-2 border-b border-gray-200">
                  <span className="text-gray-500 font-medium">Account ID:</span>
                  <span className="font-mono text-gray-600">{user?.id || 'USR-2026-AEC'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 font-medium">Account Status:</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
                    Active & Verified
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={() => setProfileModalOpen(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-colors"
                >
                  Close
                </button>
                <Link
                  to={role === 'admin' ? '/admin/settings' : '/portal/company'}
                  onClick={() => setProfileModalOpen(false)}
                  className="px-4 py-2 bg-[#0A2E24] hover:bg-[#1A4A3A] text-[#D4AF37] font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5"
                >
                  <Settings className="w-3.5 h-3.5" />
                  Edit Settings
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
