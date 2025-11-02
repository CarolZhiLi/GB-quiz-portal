import { useState, useEffect } from 'react';

export function QuestionForm({ question, onSave, onCancel }) {
  const [questionText, setQuestionText] = useState('');
  const [options, setOptions] = useState(['', '', '', '']);
  const [correctIndex, setCorrectIndex] = useState(0);
  const [level, setLevel] = useState(1);
  const [usertype, setUsertype] = useState([]);
  const [explanation, setExplanation] = useState('');

  useEffect(() => {
    if (question) {
      setQuestionText(question.questionText || '');
      setOptions(question.options || ['', '', '', '']);
      setCorrectIndex(question.correctIndex || 0);
      setLevel(question.level || 1);
      setUsertype(question.usertype || []);
      setExplanation(question.explanation || '');
    }
  }, [question]);

  function handleOptionChange(index, value) {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  }

  function handleSubmit(e) {
    e.preventDefault();
    
    if (!questionText.trim()) {
      alert('Question text is required');
      return;
    }

    if (options.filter(opt => opt.trim()).length < 2) {
      alert('At least 2 options are required');
      return;
    }

    if (!options[correctIndex] || !options[correctIndex].trim()) {
      alert('Correct answer option cannot be empty');
      return;
    }

    if (usertype.length === 0) {
      alert('Please select at least one user type');
      return;
    }

    onSave({
      questionText: questionText.trim(),
      options: options.map(opt => opt.trim()),
      correctIndex,
      level,
      usertype: usertype,
      explanation: explanation.trim()
    });
  }

  return (
    <div style={styles.overlay} onClick={onCancel}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h3>{question ? 'Edit Question' : 'Add New Question'}</h3>
        <form onSubmit={handleSubmit}>
          <div style={styles.formGroup}>
            <label>Question Text: *</label>
            <textarea
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              required
              rows="3"
              style={styles.textarea}
            />
          </div>

          <div style={styles.formGroup}>
            <label>Options: *</label>
            {options.map((option, index) => (
              <div key={index} style={styles.optionRow}>
                <input
                  type="radio"
                  name="correct"
                  checked={correctIndex === index}
                  onChange={() => setCorrectIndex(index)}
                  style={styles.radio}
                />
                <input
                  type="text"
                  value={option}
                  onChange={(e) => handleOptionChange(index, e.target.value)}
                  placeholder={`Option ${index + 1}`}
                  style={styles.optionInput}
                />
                {index === correctIndex && <span style={styles.correctLabel}>(Correct)</span>}
              </div>
            ))}
          </div>

          <div style={styles.formGroup}>
            <label>Level: *</label>
            <select
              value={level}
              onChange={(e) => setLevel(Number(e.target.value))}
              style={styles.select}
            >
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={3}>3</option>
              <option value={4}>4</option>
            </select>
          </div>

          <div style={styles.formGroup}>
            <label>User Type: * (select one or more)</label>
            <div style={styles.checkboxGroup}>
              <label style={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={usertype.includes('practitioner')}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setUsertype([...usertype, 'practitioner']);
                    } else {
                      setUsertype(usertype.filter(ut => ut !== 'practitioner'));
                    }
                  }}
                  style={styles.checkbox}
                />
                Practitioner
              </label>
              <label style={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={usertype.includes('patient')}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setUsertype([...usertype, 'patient']);
                    } else {
                      setUsertype(usertype.filter(ut => ut !== 'patient'));
                    }
                  }}
                  style={styles.checkbox}
                />
                Patient
              </label>
              <label style={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={usertype.includes('youth')}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setUsertype([...usertype, 'youth']);
                    } else {
                      setUsertype(usertype.filter(ut => ut !== 'youth'));
                    }
                  }}
                  style={styles.checkbox}
                />
                Youth
              </label>
            </div>
          </div>

          <div style={styles.formGroup}>
            <label>Explanation (optional):</label>
            <textarea
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              rows="2"
              style={styles.textarea}
            />
          </div>

          <div style={styles.buttonGroup}>
            <button type="submit" style={styles.saveButton}>Save</button>
            <button type="button" onClick={onCancel} style={styles.cancelButton}>Cancel</button>
          </div>
        </form>
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
  formGroup: {
    marginBottom: '1rem'
  },
  textarea: {
    width: '100%',
    padding: '0.5rem',
    border: '1px solid #ccc',
    borderRadius: '4px',
    boxSizing: 'border-box',
    fontFamily: 'inherit'
  },
  optionRow: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: '0.5rem'
  },
  radio: {
    marginRight: '0.5rem'
  },
  optionInput: {
    flex: 1,
    padding: '0.5rem',
    border: '1px solid #ccc',
    borderRadius: '4px',
    marginRight: '0.5rem'
  },
  correctLabel: {
    color: 'green',
    fontSize: '0.875rem'
  },
  select: {
    width: '100%',
    padding: '0.5rem',
    border: '1px solid #ccc',
    borderRadius: '4px',
    boxSizing: 'border-box'
  },
  checkboxGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    marginTop: '0.5rem'
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    cursor: 'pointer',
    fontSize: '1rem'
  },
  checkbox: {
    marginRight: '0.5rem',
    cursor: 'pointer',
    width: '18px',
    height: '18px'
  },
  buttonGroup: {
    display: 'flex',
    gap: '1rem',
    marginTop: '1.5rem'
  },
  saveButton: {
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

