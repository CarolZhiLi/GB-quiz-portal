import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Dashboard } from './components/Dashboard';
import { QuizGenerator } from './components/QuizGenerator';
import { AdminReview } from './components/AdminReview';
import { Login } from './components/Login';
import { AdminRoute } from './components/ProtectedRoute';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/quiz-generator" element={<QuizGenerator />} />
        <Route path="/admin-review" element={<AdminRoute><AdminReview /></AdminRoute>} />
        <Route path="/login" element={<Login />} />
      </Routes>
    </Router>
  );
}

export default App;
