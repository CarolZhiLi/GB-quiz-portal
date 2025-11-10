import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, setDoc, updateDoc, deleteDoc, doc, addDoc } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, deleteObject } from 'firebase/storage';
import { db, storage, auth } from '../firebase/config';
import { QuestionForm } from './QuestionForm';
import { BulkUpload } from './BulkUpload';
import { useAuth } from '../contexts/AuthContext';

const STORAGE_BUCKET =
  import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ||
  import.meta.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ||
  'granvillebiomedicalapp.appspot.com';
const STORAGE_GS_PREFIX = `gs://${STORAGE_BUCKET}/`;

export function Dashboard() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;

  useEffect(() => {
    loadQuestions();
  }, []);

  async function loadQuestions() {
    try {
      // Check if Firebase is configured
      if (!db) {
        console.warn('Firebase not configured. App will work in view-only mode.');
        setQuestions([]);
        setLoading(false);
        return;
      }
      // Get all questions without orderBy to include those without createdAt
      const querySnapshot = await getDocs(collection(db, 'quizQuestions'));
      const questionsData = [];
      querySnapshot.forEach((doc) => {
        questionsData.push({ id: doc.id, ...doc.data() });
      });
      
      // Sort: questions with createdAt first (newest first), then questions without createdAt at bottom
      questionsData.sort((a, b) => {
        const aHasDate = a.createdAt && (a.createdAt.toDate || typeof a.createdAt === 'object' || typeof a.createdAt === 'string');
        const bHasDate = b.createdAt && (b.createdAt.toDate || typeof b.createdAt === 'object' || typeof b.createdAt === 'string');
        
        // If both have dates, sort by date (newest first)
        if (aHasDate && bHasDate) {
          const aDate = a.createdAt.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
          const bDate = b.createdAt.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
          return bDate.getTime() - aDate.getTime();
        }
        
        // If only one has date, it comes first
        if (aHasDate && !bHasDate) return -1;
        if (!aHasDate && bHasDate) return 1;
        
        // If neither has date, keep original order (at bottom)
        return 0;
      });
      
      setQuestions(questionsData);
      setCurrentPage(1);
    } catch (error) {
      console.error('Error loading questions:', error);
      setQuestions([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(questionData) {
    try {
      if (!db) {
        alert('Firebase not configured. Please update src/firebase/config.js with your Firebase credentials.');
        return;
      }

      const { imageFile, removeExistingImage, ...rest } = questionData;
      const dataToSave = {
        ...rest,
        updatedAt: new Date()
      };

      if (typeof dataToSave.imageUrl === 'string') {
        dataToSave.imageUrl = dataToSave.imageUrl.trim();
        if (dataToSave.imageUrl.length === 0) {
          delete dataToSave.imageUrl;
        }
      }

      const shouldUploadImage = typeof File !== 'undefined' ? imageFile instanceof File : !!imageFile;
      const previousImageUrl = editingQuestion?.imageUrl;

      if (isAdmin) {
        let docRef;
        if (editingQuestion) {
          docRef = doc(db, 'quizQuestions', editingQuestion.id);
          if (shouldUploadImage) {
            const imagePath = await uploadQuestionImage(docRef.id, imageFile);
            dataToSave.imageUrl = imagePath;
            await deleteQuestionImage(previousImageUrl);
          } else if (shouldRemoveImageField({ removeExistingImage, previousImageUrl, nextImageUrl: dataToSave.imageUrl })) {
            await deleteQuestionImage(previousImageUrl);
            delete dataToSave.imageUrl;
          } else if (!dataToSave.imageUrl && previousImageUrl) {
            dataToSave.imageUrl = previousImageUrl;
          } else if (dataToSave.imageUrl && previousImageUrl && dataToSave.imageUrl !== previousImageUrl) {
            await deleteQuestionImage(previousImageUrl);
          }
          await updateDoc(docRef, dataToSave);
        } else {
          docRef = doc(collection(db, 'quizQuestions'));
          if (shouldUploadImage) {
            const imagePath = await uploadQuestionImage(docRef.id, imageFile);
            dataToSave.imageUrl = imagePath;
          }
          dataToSave.createdAt = new Date();
          await setDoc(docRef, dataToSave);
        }
      } else {
        // Non-admin: stage this change as a single-item batch
        const batchRef = await addDoc(collection(db, 'stagingBatches'), {
          status: 'pending',
          createdAt: new Date(),
          createdByUid: auth?.currentUser?.uid || null,
          createdByEmail: auth?.currentUser?.email || null,
          totals: { success: 1, error: 0, total: 1 },
          notes: 'single-item change from dashboard'
        });
        const action = editingQuestion ? 'update' : 'create';
        const questionPayload = {
          ...dataToSave,
          createdAt: editingQuestion?.createdAt || new Date(),
          published: false,
          publishedBatchId: null,
          __action: action,
          __targetId: editingQuestion?.id || null
        };
        await addDoc(collection(db, 'stagingBatches', batchRef.id, 'questions'), questionPayload);
        alert(`Change submitted for admin review. Batch: ${batchRef.id}`);
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
      if (!db) {
        alert('Firebase not configured. Please update src/firebase/config.js with your Firebase credentials.');
        return;
      }
      if (isAdmin) {
        await deleteDoc(doc(db, 'quizQuestions', questionId));
        loadQuestions();
      } else {
        const batchRef = await addDoc(collection(db, 'stagingBatches'), {
          status: 'pending',
          createdAt: new Date(),
          createdByUid: auth?.currentUser?.uid || null,
          createdByEmail: auth?.currentUser?.email || null,
          totals: { success: 1, error: 0, total: 1 },
          notes: 'delete request from dashboard'
        });
        await addDoc(collection(db, 'stagingBatches', batchRef.id, 'questions'), {
          __action: 'delete',
          __targetId: questionId,
          createdAt: new Date()
        });
        alert(`Delete request submitted for admin review. Batch: ${batchRef.id}`);
      }
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

  async function uploadQuestionImage(questionId, file) {
    if (!storage) {
      throw new Error('Firebase storage not configured. Please update src/firebase/config.js with your Firebase credentials.');
    }

    const extension = getFileExtension(file?.name);
    const storagePath = `images/anatomyQuestions/${questionId}.${extension}`;
    const imageRef = storageRef(storage, storagePath);
    await uploadBytes(imageRef, file);

    return `${STORAGE_GS_PREFIX}${storagePath}`;
  }

  function getFileExtension(filename = '') {
    if (typeof filename !== 'string') {
      return 'jpg';
    }
    const parts = filename.split('.');
    if (parts.length <= 1) {
      return 'jpg';
    }
    const ext = parts.pop()?.trim().toLowerCase();
    return ext || 'jpg';
  }

  function shouldRemoveImageField({ removeExistingImage, previousImageUrl, nextImageUrl }) {
    if (!previousImageUrl) {
      return false;
    }
    if (removeExistingImage) {
      return true;
    }
    if (typeof nextImageUrl === 'undefined') {
      return true;
    }
    return false;
  }

  async function deleteQuestionImage(existingUrl) {
    if (!existingUrl || !storage) {
      return;
    }
    const storagePath = extractStoragePath(existingUrl);
    if (!storagePath) {
      return;
    }
    try {
      const objectRef = storageRef(storage, storagePath);
      await deleteObject(objectRef);
    } catch (error) {
      console.warn('Error deleting image from storage:', error);
    }
  }

  function extractStoragePath(url = '') {
    if (typeof url !== 'string') {
      return null;
    }
    if (url.startsWith(STORAGE_GS_PREFIX)) {
      return url.replace(STORAGE_GS_PREFIX, '');
    }
    return null;
  }

  const totalPages = Math.max(1, Math.ceil(questions.length / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const pagedQuestions = questions.slice(startIndex, startIndex + pageSize);

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Loading questions...</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1>Quiz Content Management</h1>
      </header>

      <div style={styles.actions}>
        <button onClick={handleAddNew} style={styles.addButton}>Add New Question</button>
        <button onClick={() => setShowBulkUpload(true)} style={styles.uploadButton}>Bulk Upload</button>
        <button onClick={() => navigate('/quiz-generator')} style={styles.generatorButton}>Quiz Generator</button>
        {isAdmin && (
          <button onClick={() => navigate('/admin-review')} style={styles.reviewButton}>Admin Review</button>
        )}
      </div>

      <div style={styles.tableContainer}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>No.</th>
              <th style={styles.th}>Question Text</th>
              <th style={styles.th}>Level</th>
              <th style={styles.th}>User Type</th>
              <th style={styles.th}>Options</th>
              <th style={styles.th}>Date Created</th>
              <th style={styles.th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {questions.length === 0 ? (
              <tr>
                <td colSpan="7" style={styles.emptyCell}>No questions found. Add your first question!</td>
              </tr>
            ) : (
              pagedQuestions.map((question, idx) => (
                <tr key={question.id}>
                  <td style={styles.td}>{startIndex + idx + 1}</td>
                  <td style={styles.td}>{question.questionText}</td>
                  <td style={styles.td}>{question.level}</td>
                  <td style={styles.td}>
                    {question.usertype && question.usertype.length > 0
                      ? question.usertype.join(', ')
                      : 'N/A'}
                  </td>
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
        {questions.length > 0 && (
          <div style={styles.pagination}>
            <button
              style={styles.pageButton}
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            >
              Prev
            </button>
            <span style={styles.pageInfo}>
              Page {currentPage} of {totalPages} · Showing {startIndex + 1}-{Math.min(startIndex + pageSize, questions.length)} of {questions.length}
            </span>
            <button
              style={styles.pageButton}
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </button>
          </div>
        )}
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
    marginBottom: '2rem',
    paddingBottom: '1rem',
    borderBottom: '2px solid #ccc'
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
  generatorButton: {
    padding: '0.75rem 1.5rem',
    backgroundColor: '#6f42c1',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '1rem'
  },
  reviewButton: {
    padding: '0.75rem 1.5rem',
    backgroundColor: '#ffc107',
    color: '#212529',
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
  pagination: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: '1rem'
  },
  pageButton: {
    padding: '0.5rem 1rem',
    backgroundColor: '#f1f3f5',
    color: '#333',
    border: '1px solid #ccc',
    borderRadius: '4px',
    cursor: 'pointer',
    minWidth: '80px'
  },
  pageInfo: {
    color: '#555'
  },
  loading: {
    textAlign: 'center',
    padding: '2rem',
    fontSize: '1.2rem'
  }
};
