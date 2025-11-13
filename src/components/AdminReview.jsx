import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  writeBatch,
  setDoc,
  onSnapshot,
  query,
  orderBy,
  deleteDoc
} from 'firebase/firestore';
import { db, auth } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';

const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

function toJsDate(value) {
  if (!value) return null;
  if (typeof value.toDate === 'function') {
    try {
      return value.toDate();
    } catch (_) {
      // fall through to new Date
    }
  }
  const date = new Date(value);
  return isNaN(date.getTime()) ? null : date;
}

export function AdminReview() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBatchId, setSelectedBatchId] = useState(null);
  const [selectedBatchQuestions, setSelectedBatchQuestions] = useState([]);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    if (!db) {
      setLoading(false);
      return;
    }
    // Live updates for staging batches
    const q = query(collection(db, 'stagingBatches'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const items = [];
      snap.forEach((d) => items.push({ id: d.id, ...d.data() }));
      setBatches(items);
      setLoading(false);
    }, (err) => {
      console.error('Error listening to stagingBatches:', err);
      setLoading(false);
    });
    return unsub;
  }, []);

  async function loadBatches() {}

  async function loadBatchQuestions(batchId) {
    if (!db) return;
    try {
      const snap = await getDocs(collection(db, 'stagingBatches', batchId, 'questions'));
      const items = [];
      snap.forEach(d => items.push({ id: d.id, ...d.data() }));
      setSelectedBatchQuestions(items);
    } catch (e) {
      console.error('Error loading batch questions:', e);
    }
  }

  async function approveBatch(batchId) {
    if (!confirm('Approve and publish this batch to live collection?')) return;
    setPublishing(true);
    try {
      const qSnap = await getDocs(collection(db, 'stagingBatches', batchId, 'questions'));
      const docs = [];
      qSnap.forEach(d => docs.push({ id: d.id, ...d.data() }));

      const chunkSize = 450; // under 500 write limit
      for (let i = 0; i < docs.length; i += chunkSize) {
        const batch = writeBatch(db);
        const chunk = docs.slice(i, i + chunkSize);
        chunk.forEach((q) => {
          const action = q.__action || 'create';
          const targetId = q.__targetId;
          if (action === 'delete' && targetId) {
            const targetRef = doc(db, 'quizQuestions', targetId);
            batch.delete(targetRef);
            return;
          }
          const createdAt = q.createdAt?.toDate ? q.createdAt.toDate() : (q.createdAt ? new Date(q.createdAt) : new Date());
          const payload = {
            questionText: q.questionText,
            options: q.options,
            correctIndex: q.correctIndex,
            level: q.level,
            usertype: q.usertype,
            explanation: q.explanation || '',
            createdAt: createdAt,
            updatedAt: new Date(),
            publishedBatchId: batchId,
            publishedAt: new Date()
          };
          // Only include imageUrl if valid non-empty string
          if (typeof q.imageUrl === 'string') {
            const trimmed = q.imageUrl.trim();
            if (trimmed.length > 0) {
              payload.imageUrl = trimmed;
            }
          }
          if (action === 'update' && targetId) {
            const targetRef = doc(db, 'quizQuestions', targetId);
            batch.set(targetRef, payload, { merge: true });
          } else {
            const liveRef = doc(collection(db, 'quizQuestions'));
            batch.set(liveRef, payload);
          }
        });
        await batch.commit();
      }

      await updateDoc(doc(db, 'stagingBatches', batchId), {
        status: 'approved',
        approvedAt: new Date(),
        approvedByUid: auth?.currentUser?.uid || null,
        approvedByEmail: auth?.currentUser?.email || null
      });

      // batches will refresh via onSnapshot
      if (selectedBatchId === batchId) {
        setSelectedBatchQuestions([]);
        setSelectedBatchId(null);
      }
      alert('Batch published to quizQuestions.');
    } catch (e) {
      console.error('Error approving batch:', e);
      alert('Error approving batch: ' + e.message);
    } finally {
      setPublishing(false);
    }
  }

  async function rejectBatch(batchId) {
    const note = prompt('Optional rejection note:', '');
    try {
      await updateDoc(doc(db, 'stagingBatches', batchId), {
        status: 'rejected',
        rejectedAt: new Date(),
        rejectedByUid: auth?.currentUser?.uid || null,
        rejectedByEmail: auth?.currentUser?.email || null,
        notes: note || ''
      });
      // batches will refresh via onSnapshot
      if (selectedBatchId === batchId) {
        setSelectedBatchQuestions([]);
        setSelectedBatchId(null);
      }
    } catch (e) {
      console.error('Error rejecting batch:', e);
      alert('Error rejecting batch: ' + e.message);
    }
  }

  function canCleanupBatch(batch) {
    if (!batch) return false;
    if (!['approved', 'rejected'].includes(batch.status)) {
      return false;
    }
    const reference =
      batch.status === 'approved'
        ? toJsDate(batch.approvedAt)
        : toJsDate(batch.rejectedAt);
    if (!reference) return false;
    return Date.now() - reference.getTime() >= FOURTEEN_DAYS_MS;
  }

  async function cleanupBatch(batch) {
    if (!db || !batch?.id) return;
    if (!canCleanupBatch(batch)) {
      alert('Batch can only be deleted 14 days after approval or rejection.');
      return;
    }
    if (!confirm('Delete this staging batch and all of its questions?')) {
      return;
    }
    try {
      const qSnap = await getDocs(collection(db, 'stagingBatches', batch.id, 'questions'));
      const deletions = [];
      qSnap.forEach((docSnap) => {
        deletions.push(deleteDoc(doc(db, 'stagingBatches', batch.id, 'questions', docSnap.id)));
      });
      await Promise.all(deletions);
      await deleteDoc(doc(db, 'stagingBatches', batch.id));
      if (selectedBatchId === batch.id) {
        setSelectedBatchQuestions([]);
        setSelectedBatchId(null);
      }
      alert('Batch deleted.');
    } catch (e) {
      console.error('Error deleting batch:', e);
      alert('Error deleting batch: ' + e.message);
    }
  }

  const selectedBatch = useMemo(() => batches.find(b => b.id === selectedBatchId), [batches, selectedBatchId]);

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Loading staging batches...</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1>Admin Review</h1>
        <button style={styles.backButton} onClick={() => navigate('/')}>Back to Dashboard</button>
      </header>

      <div style={styles.layout}>
        <div style={styles.leftPane}>
          <h3>Staging Batches</h3>
          {batches.length === 0 ? (
            <div style={styles.empty}>No staging batches found.</div>
          ) : (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>No.</th>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}>Totals</th>
                  <th style={styles.th}>Created By</th>
                  <th style={styles.th}>Created</th>
                  <th style={styles.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((b, index) => (
                  <tr key={b.id}>
                    <td style={styles.td}>{index + 1}</td>
                    <td style={styles.td}>{b.status || 'pending'}</td>
                    <td style={styles.td}>
                      {(b.totals?.success || 0)}/{b.totals?.total || 0}
                      {b.totals?.error ? ` (${b.totals.error} err)` : ''}
                    </td>
                    <td style={styles.td}>{b.createdByEmail || 'anonymous'}</td>
                    <td style={styles.td}>{b.createdAt?.toDate ? b.createdAt.toDate().toLocaleString() : (b.createdAt ? new Date(b.createdAt).toLocaleString() : 'N/A')}</td>
                    <td style={styles.td}>
                      <button style={styles.smallBtn} onClick={() => { setSelectedBatchId(b.id); loadBatchQuestions(b.id); }}>View</button>
                      <button style={styles.smallBtn} disabled={!isAdmin || publishing || b.status === 'approved'} onClick={() => approveBatch(b.id)}>
                        {publishing ? 'Publishing...' : 'Approve'}
                      </button>
                      <button style={styles.smallBtn} disabled={!isAdmin || b.status === 'rejected'} onClick={() => rejectBatch(b.id)}>Reject</button>
                      {canCleanupBatch(b) && (
                        <button style={styles.smallBtn} onClick={() => cleanupBatch(b)}>Delete</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div style={styles.rightPane}>
          <h3>Batch Details</h3>
          {!selectedBatchId ? (
            <div style={styles.empty}>Select a batch to preview questions</div>
          ) : (
            <div>
              <div style={styles.batchMeta}>
                <div><strong>Batch:</strong> {selectedBatch?.id}</div>
                <div><strong>Status:</strong> {selectedBatch?.status || 'pending'}</div>
                <div><strong>Notes:</strong> {selectedBatch?.notes || '-'}</div>
              </div>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>#</th>
                    <th style={styles.th}>Question</th>
                    <th style={styles.th}>Level</th>
                    <th style={styles.th}>User Type</th>
                    <th style={styles.th}>Options</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedBatchQuestions.length === 0 ? (
                    <tr><td style={styles.td} colSpan="5">No questions in this batch.</td></tr>
                  ) : (
                    selectedBatchQuestions.map((q, i) => (
                      <tr key={q.id}>
                        <td style={styles.td}>{i + 1}</td>
                        <td style={styles.td}>{q.questionText}</td>
                        <td style={styles.td}>{q.level}</td>
                        <td style={styles.td}>{Array.isArray(q.usertype) ? q.usertype.join(', ') : ''}</td>
                        <td style={styles.td}>{q.options?.length || 0} option(s)</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: { padding: '2rem', maxWidth: '1200px', margin: '0 auto' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' },
  backButton: { padding: '0.5rem 1rem', backgroundColor: '#f1f3f5', border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer' },
  layout: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' },
  leftPane: { },
  rightPane: { },
  table: { width: '100%', borderCollapse: 'collapse', backgroundColor: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' },
  th: { padding: '0.75rem', textAlign: 'left', borderBottom: '2px solid #ccc', backgroundColor: '#f8f9fa', fontWeight: 'bold' },
  td: { padding: '0.75rem', borderBottom: '1px solid #eee' },
  empty: { padding: '1rem', color: '#666' },
  loading: { textAlign: 'center', padding: '2rem' },
  smallBtn: { padding: '0.25rem 0.5rem', marginRight: '0.5rem', backgroundColor: '#e9ecef', border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer' },
  batchMeta: { display: 'flex', gap: '1rem', marginBottom: '0.5rem' }
};
