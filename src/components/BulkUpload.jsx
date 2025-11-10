import { useState } from 'react';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';

export function BulkUpload({ onComplete, onCancel }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState(null);

  function downloadTemplate() {
    const templateData = [
      ['questionText', 'option1', 'option2', 'option3', 'option4', 'correctIndex', 'level', 'usertype', 'explanation'],
      ['What is 2 + 2?', '3', '4', '5', '6', '1', '1', 'practitioner,patient', 'Basic addition'],
      ['What is the capital of France?', 'London', 'Berlin', 'Paris', 'Madrid', '2', '2', 'youth', 'Paris is the capital city of France']
    ];

    const ws = XLSX.utils.aoa_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Questions');
    XLSX.writeFile(wb, 'quiz_questions_template.xlsx');
  }

  async function handleUpload() {
    if (!file) {
      alert('Please select a file');
      return;
    }

    if (!db) {
      alert('Firebase not configured. Please update src/firebase/config.js with your Firebase credentials and restart the server.');
      return;
    }

    setUploading(true);
    setResults(null);

    try {
      let data = [];

      if (file.name.endsWith('.csv')) {
        // Parse CSV
        const text = await file.text();
        Papa.parse(text, {
          header: true,
          skipEmptyLines: true,
          complete: async (results) => {
            data = results.data;
            await processData(data);
          },
          error: (error) => {
            alert('Error parsing CSV: ' + error.message);
            setUploading(false);
          }
        });
      } else {
        // Parse Excel
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        data = XLSX.utils.sheet_to_json(worksheet);
        await processData(data);
      }
    } catch (error) {
      console.error('Error processing file:', error);
      alert('Error processing file: ' + error.message);
      setUploading(false);
    }
  }

  async function processData(data) {
    if (!db) {
      alert('Firebase not configured. Please update src/firebase/config.js with your Firebase credentials and restart the server.');
      return;
    }

    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      
      try {
        // Extract and validate data
        const questionText = row.questionText || row['Question Text'] || row.question;
        if (!questionText || !questionText.trim()) {
          errorCount++;
          errors.push(`Row ${i + 2}: Missing question text`);
          continue;
        }

        // Extract options (handle different column name formats)
        const option1 = row.option1 || row['Option 1'] || row.option_1 || '';
        const option2 = row.option2 || row['Option 2'] || row.option_2 || '';
        const option3 = row.option3 || row['Option 3'] || row.option_3 || '';
        const option4 = row.option4 || row['Option 4'] || row.option_4 || '';

        const options = [option1, option2, option3, option4]
          .map(opt => String(opt || '').trim())
          .filter(opt => opt.length > 0);

        if (options.length < 2) {
          errorCount++;
          errors.push(`Row ${i + 2}: Need at least 2 options`);
          continue;
        }

        // Get correct index (handle both number and string)
        let correctIndex = row.correctIndex ?? row['Correct Index'] ?? row.correct_index ?? row['Correct Answer'];
        if (typeof correctIndex === 'string') {
          const trimmedIndex = correctIndex.trim();
          correctIndex = trimmedIndex === '' ? NaN : parseInt(trimmedIndex, 10);
        }
        if (isNaN(correctIndex) || correctIndex < 0 || correctIndex >= options.length) {
          errorCount++;
          errors.push(`Row ${i + 2}: Invalid correct index`);
          continue;
        }

        const level = row.level || row.Level || 1;
        // Convert to number if it's a string
        const levelNum = typeof level === 'string' ? parseInt(level, 10) : Number(level);
        if (isNaN(levelNum) || levelNum < 1 || levelNum > 4) {
          errorCount++;
          errors.push(`Row ${i + 2}: Invalid level (must be 1, 2, 3, or 4)`);
          continue;
        }

        const usertypeStr = row.usertype || row.Usertype || row['User Type'] || 'practitioner';
        // Parse usertype - can be comma-separated or single value
        const usertypeArray = typeof usertypeStr === 'string' 
          ? usertypeStr.split(',').map(ut => ut.trim().toLowerCase()).filter(ut => ut)
          : [String(usertypeStr).toLowerCase()];
        
        // Validate usertype values
        const validUsertypes = ['practitioner', 'patient', 'youth'];
        const validUsertypeArray = usertypeArray.filter(ut => validUsertypes.includes(ut));
        
        if (validUsertypeArray.length === 0) {
          errorCount++;
          errors.push(`Row ${i + 2}: Invalid user type "${usertypeStr}" (must be one or more of: practitioner, patient, youth)`);
          continue;
        }

        const explanation = row.explanation || row.Explanation || '';

        // Save to Firestore
        await addDoc(collection(db, 'quizQuestions'), {
          questionText: questionText.trim(),
          options: options,
          correctIndex: correctIndex,
          level: levelNum,
          usertype: validUsertypeArray,
          explanation: explanation.trim(),
          createdAt: new Date(),
          updatedAt: new Date()
        });

        successCount++;
      } catch (error) {
        errorCount++;
        errors.push(`Row ${i + 2}: ${error.message}`);
      }
    }

    setResults({
      success: successCount,
      error: errorCount,
      total: data.length,
      errors: errors.slice(0, 10) // Show first 10 errors
    });
    setUploading(false);
  }

  return (
    <div style={styles.overlay} onClick={onCancel}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h3>Bulk Upload Questions</h3>
        
        <div style={styles.section}>
          <h4>Template</h4>
          <p>Download a template file to ensure your data is structured correctly:</p>
          <button onClick={downloadTemplate} style={styles.templateButton}>
            Download Excel Template
          </button>
        </div>

        <div style={styles.section}>
          <h4>Upload File</h4>
          <p>Upload a CSV or Excel (.xlsx) file with your questions:</p>
          <input
            type="file"
            accept=".csv,.xlsx"
            onChange={(e) => setFile(e.target.files[0])}
            style={styles.fileInput}
          />
        </div>

        {results && (
          <div style={styles.results}>
            <h4>Upload Results</h4>
            <p>
              Successfully uploaded <strong>{results.success}</strong> of <strong>{results.total}</strong> questions.
              {results.error > 0 && (
                <span style={styles.errorText}> {results.error} rows were skipped due to errors.</span>
              )}
            </p>
            {results.errors.length > 0 && (
              <div style={styles.errorList}>
                <strong>Errors:</strong>
                <ul style={styles.errorUl}>
                  {results.errors.map((error, idx) => (
                    <li key={idx} style={styles.errorLi}>{error}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <div style={styles.buttonGroup}>
          <button 
            onClick={handleUpload} 
            disabled={!file || uploading}
            style={styles.uploadButton}
          >
            {uploading ? 'Uploading...' : 'Upload'}
          </button>
          <button onClick={onCancel} style={styles.cancelButton}>
            {results ? 'Close' : 'Cancel'}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000
  },
  modal: {
    backgroundColor: 'white',
    padding: '2rem',
    borderRadius: '4px',
    width: '90%',
    maxWidth: '600px',
    maxHeight: '90vh',
    overflow: 'auto'
  },
  section: {
    marginBottom: '1.5rem'
  },
  templateButton: {
    padding: '0.75rem 1.5rem',
    backgroundColor: '#17a2b8',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '1rem'
  },
  fileInput: {
    width: '100%',
    padding: '0.5rem',
    border: '1px solid #ccc',
    borderRadius: '4px'
  },
  results: {
    marginTop: '1.5rem',
    padding: '1rem',
    backgroundColor: '#f8f9fa',
    borderRadius: '4px'
  },
  errorText: {
    color: '#dc3545'
  },
  errorList: {
    marginTop: '1rem'
  },
  errorUl: {
    margin: '0.5rem 0',
    paddingLeft: '1.5rem'
  },
  errorLi: {
    marginBottom: '0.25rem',
    fontSize: '0.875rem',
    color: '#dc3545'
  },
  buttonGroup: {
    display: 'flex',
    gap: '1rem',
    marginTop: '1.5rem'
  },
  uploadButton: {
    flex: 1,
    padding: '0.75rem',
    backgroundColor: '#28a745',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '1rem'
  },
  cancelButton: {
    flex: 1,
    padding: '0.75rem',
    backgroundColor: '#6c757d',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '1rem'
  }
};

