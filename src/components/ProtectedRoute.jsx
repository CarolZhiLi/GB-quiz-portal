import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

// Set to true to bypass authentication (for testing/development)
const BYPASS_AUTH = true;

export function ProtectedRoute({ children }) {
  const { currentUser } = useAuth();

  // Bypass auth check if enabled
  if (BYPASS_AUTH) {
    return children;
  }

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

