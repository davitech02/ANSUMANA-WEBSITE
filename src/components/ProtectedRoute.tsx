import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';

interface ProtectedRouteProps {
  requiredRole?: 'admin' | 'client';
  allowedRole?: 'admin' | 'client';
  children?: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ requiredRole, allowedRole, children }) => {
  const { isAuthenticated, user } = useAuth();
  const targetRole = requiredRole || allowedRole;

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
