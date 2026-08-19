import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';

interface ProtectedRouteProps {
  requiredRole?: 'admin' | 'client';
  allowedRole?: 'admin' | 'client';
  children?: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ requiredRole, allowedRole, children }) => {
  const { isAuthenticated, isRestoring, user } = useAuth();
  const targetRole = requiredRole || allowedRole;

  // Wait for the persisted session to be restored before deciding to redirect.
  if (isRestoring) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#14231E] flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-4 border-[#D4AF37] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-mono text-gray-500">Restoring session...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (targetRole && user?.role !== targetRole) {
    return <Navigate to={user?.role === 'admin' ? '/admin' : '/portal'} replace />;
  }

  // Render the layout (e.g. PortalLayout) passed as children; the layout
  // itself renders <Outlet /> for the matched nested page.
  return <>{children}</>;
};