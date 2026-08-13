import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './lib/AuthContext';
import { ScrollToTop } from './components/ScrollToTop';
import { PublicLayout } from './components/public/PublicLayout';
import { PortalLayout } from './components/portal/PortalLayout';
import { ProtectedRoute } from './components/ProtectedRoute';

// Public Pages
import { Home } from './pages/Home';
import { About } from './pages/About';
import { Services } from './pages/Services';
import { Projects } from './pages/Projects';
import { Contact } from './pages/Contact';
import { BookSession } from './pages/BookSession';
import { CheckStatus } from './pages/CheckStatus';

// Auth Pages
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { ForgotPassword } from './pages/ForgotPassword';
import { ResetPassword } from './pages/ResetPassword';

// Admin Portal Pages
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { AdminProponents } from './pages/admin/AdminProponents';
import { AdminPermits } from './pages/admin/AdminPermits';
import { AdminSchedules } from './pages/admin/AdminSchedules';
import { AdminFindings } from './pages/admin/AdminFindings';
import { AdminEvidence } from './pages/admin/AdminEvidence';
import { AdminRequests } from './pages/admin/AdminRequests';
import { AdminBookings } from './pages/admin/AdminBookings';
import { AdminLogs } from './pages/admin/AdminLogs';
import { AdminEmailLogs } from './pages/admin/AdminEmailLogs';
import { AdminWhatsAppLogs } from './pages/admin/AdminWhatsAppLogs';
import { AdminSettings } from './pages/admin/AdminSettings';

// Client Portal Pages
import { ClientDashboard } from './pages/client/ClientDashboard';
import { ClientCompany } from './pages/client/ClientCompany';
import { ClientPermits } from './pages/client/ClientPermits';
import { ClientSchedules } from './pages/client/ClientSchedules';
import { ClientFindings } from './pages/client/ClientFindings';
import { ClientEvidence } from './pages/client/ClientEvidence';
import { ClientBook } from './pages/client/ClientBook';
import { ClientReminders } from './pages/client/ClientReminders';
import { ClientSupport } from './pages/client/ClientSupport';
import { ClientContact } from './pages/client/ClientContact';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <ScrollToTop />
        <Routes>
          {/* Public Website Routes */}
          <Route element={<PublicLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/about" element={<About />} />
            <Route path="/services" element={<Services />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/book" element={<BookSession />} />
            <Route path="/check-status" element={<CheckStatus />} />
          </Route>

          {/* Authentication Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* Admin Portal Routes */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRole="admin">
                <PortalLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<AdminDashboard />} />
            <Route path="proponents" element={<AdminProponents />} />
            <Route path="permits" element={<AdminPermits />} />
            <Route path="schedules" element={<AdminSchedules />} />
            <Route path="findings" element={<AdminFindings />} />
            <Route path="evidence" element={<AdminEvidence />} />
            <Route path="requests" element={<AdminRequests />} />
            <Route path="bookings" element={<AdminBookings />} />
            <Route path="logs" element={<AdminLogs />} />
            <Route path="email-logs" element={<AdminEmailLogs />} />
            <Route path="whatsapp-logs" element={<AdminWhatsAppLogs />} />
            <Route path="settings" element={<AdminSettings />} />
            <Route path="support" element={<ClientSupport />} />
            <Route path="contact" element={<ClientContact />} />
          </Route>

          {/* Client Portal Routes */}
          <Route
            path="/portal"
            element={
              <ProtectedRoute allowedRole="client">
                <PortalLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<ClientDashboard />} />
            <Route path="company" element={<ClientCompany />} />
            <Route path="permits" element={<ClientPermits />} />
            <Route path="schedules" element={<ClientSchedules />} />
            <Route path="findings" element={<ClientFindings />} />
            <Route path="evidence" element={<ClientEvidence />} />
            <Route path="reminders" element={<ClientReminders />} />
            <Route path="book" element={<ClientBook />} />
            <Route path="support" element={<ClientSupport />} />
            <Route path="contact" element={<ClientContact />} />
          </Route>

          {/* Fallback Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
