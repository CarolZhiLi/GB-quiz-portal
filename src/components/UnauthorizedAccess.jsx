export function UnauthorizedAccess() {
  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Access Denied</h1>
        <p style={styles.message}>
          You do not have permission to view this portal. Sign in with an operational or
          admin account, or contact an administrator if you think this is a mistake.
        </p>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '1rem',
    backgroundColor: '#f5f5f5'
  },
  card: {
    maxWidth: '420px',
    backgroundColor: 'white',
    padding: '2rem',
    borderRadius: '8px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
    textAlign: 'center'
  },
  title: {
    margin: 0,
    marginBottom: '1rem',
    fontSize: '1.5rem'
  },
  message: {
    margin: 0,
    color: '#555',
    lineHeight: 1.6
  }
};
