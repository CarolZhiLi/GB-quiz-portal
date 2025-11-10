import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

// Auth guard for signed-in users
export function ProtectedRoute({ children }) {
  const { currentUser } = useAuth();
  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

// Auth guard for admin-only routes
export function AdminRoute({ children }) {
  const { currentUser, isAdmin } = useAuth();
  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }
  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }
  return children;
}

