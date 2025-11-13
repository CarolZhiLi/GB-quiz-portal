import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import { Dashboard } from './components/Dashboard';
import { QuizGenerator } from './components/QuizGenerator';
import { AdminReview } from './components/AdminReview';
import { Login } from './components/Login';
import { AdminRoute, RoleRoute } from './components/ProtectedRoute';
import { useAuth } from './contexts/AuthContext';

function App() {
  return (
    <Router>
      <HeaderBar />
      <Routes>
        <Route
          path="/"
          element={
            <RoleRoute allowedRoles={['operational', 'admin']}>
              <Dashboard />
            </RoleRoute>
          }
        />
        <Route
          path="/quiz-generator"
          element={
            <RoleRoute allowedRoles={['operational', 'admin']}>
              <QuizGenerator />
            </RoleRoute>
          }
        />
        <Route path="/admin-review" element={<AdminRoute><AdminReview /></AdminRoute>} />
        <Route path="/login" element={<Login />} />
      </Routes>
    </Router>
  );
}

export default App;

function HeaderBar() {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();

  if (!currentUser) {
    return null;
  }

  async function handleLogout() {
    try {
      await logout();
    } catch (err) {
      console.error('Failed to log out:', err);
    } finally {
      navigate('/login');
    }
  }

  return (
    <header style={headerStyles.bar}>
      <div>
        <strong>Quiz Content Portal</strong>
      </div>
      <div style={headerStyles.actions}>
        <span style={headerStyles.email}>{currentUser.email}</span>
        <button style={headerStyles.button} onClick={handleLogout}>
          Log out
        </button>
      </div>
    </header>
  );
}

const headerStyles = {
  bar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0.5rem 1.5rem',
    backgroundColor: '#1f2937',
    color: '#fff'
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem'
  },
  email: {
    fontSize: '0.9rem',
    opacity: 0.85
  },
  button: {
    padding: '0.35rem 0.9rem',
    backgroundColor: '#f87171',
    border: 'none',
    borderRadius: '4px',
    color: '#fff',
    cursor: 'pointer'
  }
};
