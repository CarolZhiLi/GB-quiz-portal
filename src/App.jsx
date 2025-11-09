import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Dashboard } from './components/Dashboard';
import { QuizGenerator } from './components/QuizGenerator';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/quiz-generator" element={<QuizGenerator />} />
      </Routes>
    </Router>
  );
}

export default App;
