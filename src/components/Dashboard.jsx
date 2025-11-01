import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';
import { QuestionForm } from './QuestionForm';
import { BulkUpload } from './BulkUpload';

export function Dashboard() {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const { logout } = useAuth();

  useEffect(() => {
    loadQuestions();
  }, []);

  async function loadQuestions() {
    try {
      const q = query(collection(db, 'quizQuestions'), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      const questionsData = [];
      querySnapshot.forEach((doc) => {
        questionsData.push({ id: doc.id, ...doc.data() });
      });
      setQuestions(questionsData);
    } catch (error) {
      console.error('Error loading questions:', error);
      alert('Error loading questions: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(questionData) {
    try {
      const dataToSave = {
        ...questionData,
        updatedAt: new Date()
      };

      if (editingQuestion) {
        // Update existing
        await updateDoc(doc(db, 'quizQuestions', editingQuestion.id), dataToSave);
      } else {
        // Create new
        dataToSave.createdAt = new Date();
        await addDoc(collection(db, 'quizQuestions'), dataToSave);
      }

      setShowForm(false);
      setEditingQuestion(null);
      loadQuestions();
    } catch (error) {
      console.error('Error saving question:', error);
      alert('Error saving question: ' + error.message);
    }
  }

  async function handleDelete(questionId) {
    if (!confirm('Are you sure you want to delete this question?')) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'quizQuestions', questionId));
      loadQuestions();
    } catch (error) {
      console.error('Error deleting question:', error);
      alert('Error deleting question: ' + error.message);
    }
  }

  function handleEdit(question) {
    setEditingQuestion(question);
    setShowForm(true);
  }

  function handleAddNew() {
    setEditingQuestion(null);
    setShowForm(true);
  }

  function handleBulkUploadComplete() {
    setShowBulkUpload(false);
    loadQuestions();
  }

  if (loading) {
    return <div style={styles.loading}>Loading questions...</div>;
  }

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1>Quiz Content Management</h1>
        <button onClick={logout} style={styles.logoutButton}>Logout</button>
      </header>

      <div style={styles.actions}>
        <button onClick={handleAddNew} style={styles.addButton}>Add New Question</button>
        <button onClick={() => setShowBulkUpload(true)} style={styles.uploadButton}>Bulk Upload</button>
      </div>

      <div style={styles.tableContainer}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Question Text</th>
              <th style={styles.th}>Difficulty</th>
              <th style={styles.th}>Options</th>
              <th style={styles.th}>Date Created</th>
              <th style={styles.th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {questions.length === 0 ? (
              <tr>
                <td colSpan="5" style={styles.emptyCell}>No questions found. Add your first question!</td>
              </tr>
            ) : (
              questions.map((question) => (
                <tr key={question.id}>
                  <td style={styles.td}>{question.questionText}</td>
                  <td style={styles.td}>{question.difficulty}</td>
                  <td style={styles.td}>
                    {question.options?.length || 0} option(s)
                  </td>
                  <td style={styles.td}>
                    {question.createdAt?.toDate ? 
                      question.createdAt.toDate().toLocaleDateString() : 
                      'N/A'}
                  </td>
                  <td style={styles.td}>
                    <button 
                      onClick={() => handleEdit(question)} 
                      style={styles.editButton}
                    >
                      Edit
                    </button>
                    <button 
                      onClick={() => handleDelete(question.id)} 
                      style={styles.deleteButton}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <QuestionForm
          question={editingQuestion}
          onSave={handleSave}
          onCancel={() => {
            setShowForm(false);
            setEditingQuestion(null);
          }}
        />
      )}

      {showBulkUpload && (
        <BulkUpload
          onComplete={handleBulkUploadComplete}
          onCancel={() => setShowBulkUpload(false)}
        />
      )}
    </div>
  );
}

const styles = {
  container: {
    padding: '2rem',
    maxWidth: '1200px',
    margin: '0 auto'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '2rem',
    paddingBottom: '1rem',
    borderBottom: '2px solid #ccc'
  },
  logoutButton: {
    padding: '0.5rem 1rem',
    backgroundColor: '#dc3545',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer'
  },
  actions: {
    display: 'flex',
    gap: '1rem',
    marginBottom: '2rem'
  },
  addButton: {
    padding: '0.75rem 1.5rem',
    backgroundColor: '#28a745',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '1rem'
  },
  uploadButton: {
    padding: '0.75rem 1.5rem',
    backgroundColor: '#17a2b8',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '1rem'
  },
  tableContainer: {
    overflowX: 'auto'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    backgroundColor: 'white',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
  },
  th: {
    padding: '1rem',
    textAlign: 'left',
    borderBottom: '2px solid #ccc',
    backgroundColor: '#f8f9fa',
    fontWeight: 'bold'
  },
  td: {
    padding: '1rem',
    borderBottom: '1px solid #eee'
  },
  emptyCell: {
    textAlign: 'center',
    padding: '2rem',
    color: '#666'
  },
  editButton: {
    padding: '0.5rem 1rem',
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    marginRight: '0.5rem'
  },
  deleteButton: {
    padding: '0.5rem 1rem',
    backgroundColor: '#dc3545',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer'
  },
  loading: {
    textAlign: 'center',
    padding: '2rem',
    fontSize: '1.2rem'
  }
};

