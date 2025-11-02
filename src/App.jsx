import { Dashboard } from './components/Dashboard';

function App() {
  return (
    <div style={{
      padding: '50px',
      fontFamily: 'Arial, sans-serif',
      fontSize: '24px',
      backgroundColor: '#f0f0f0',
      minHeight: '100vh'
    }}>
      <h1 style={{ color: '#333' }}>Quiz Content Management Portal</h1>
      <p style={{ color: '#666', marginTop: '20px' }}>
        If you can see this message, React is working!
      </p>
      <Dashboard />
    </div>
  );
}

export default App;
