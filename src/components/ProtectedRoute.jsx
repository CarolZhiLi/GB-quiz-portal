import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { UnauthorizedAccess } from './UnauthorizedAccess';

// Auth guard for signed-in users
export function ProtectedRoute({ children }) {
  const { currentUser } = useAuth();
  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

// Auth guard that restricts access to users holding one of the supplied roles
export function RoleRoute({ children, allowedRoles = [] }) {
  const { currentUser, hasAnyRole } = useAuth();
  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }
  if (allowedRoles.length > 0 && !hasAnyRole(allowedRoles)) {
    return <UnauthorizedAccess />;
  }
  return children;
}

// Auth guard for admin-only routes
export function AdminRoute({ children }) {
  const { currentUser, hasRole } = useAuth();
  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }
  if (!hasRole('admin')) {
    return <UnauthorizedAccess />;
  }
  return children;
}

