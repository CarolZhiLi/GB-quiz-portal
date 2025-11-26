import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { collection, addDoc, doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../contexts/AuthContext";

// Edit Question Form Component
function EditQuestionForm({ question, onSave, onCancel }) {
  const [questionText, setQuestionText] = useState(question.questionText || "");
  const [options, setOptions] = useState(question.options || ["", "", "", ""]);
  const [correctIndex, setCorrectIndex] = useState(question.correctIndex || 0);
  const [explanation, setExplanation] = useState(question.explanation || "");

  function handleOptionChange(index, value) {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  }

  function handleSubmit(e) {
    e.preventDefault();

    if (!questionText.trim()) {
      alert("Question text is required");
      return;
    }

    if (options.filter((opt) => opt.trim()).length < 2) {
      alert("At least 2 options are required");
      return;
    }

    if (!options[correctIndex] || !options[correctIndex].trim()) {
      alert("Correct answer option cannot be empty");
      return;
    }

    onSave({
      questionText: questionText.trim(),
      options: options.map((opt) => opt.trim()),
      correctIndex,
      explanation: explanation.trim(),
    });
  }

  return (
    <form onSubmit={handleSubmit} style={styles.editForm}>
      <div style={styles.formGroup}>
        <label style={styles.label}>Question Text: *</label>
        <textarea
          value={questionText}
          onChange={(e) => setQuestionText(e.target.value)}
          required
          rows="3"
          style={styles.textarea}
        />
      </div>

      <div style={styles.formGroup}>
        <label style={styles.label}>Options: *</label>
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
            {index === correctIndex && (
              <span style={styles.correctLabel}>(Correct)</span>
            )}
          </div>
        ))}
      </div>

      <div style={styles.formGroup}>
        <label style={styles.label}>Explanation (optional):</label>
        <textarea
          value={explanation}
          onChange={(e) => setExplanation(e.target.value)}
          rows="2"
          style={styles.textarea}
        />
      </div>

      <div style={styles.editButtonGroup}>
        <button type="submit" style={styles.saveEditButton}>
          Save Changes
        </button>
        <button type="button" onClick={onCancel} style={styles.cancelEditButton}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export function QuizGenerator() {
  const navigate = useNavigate();
  const { isAdmin, currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [numQuestions, setNumQuestions] = useState(5);
  const [selectedLevel, setSelectedLevel] = useState("1");
  const [selectedUserType, setSelectedUserType] = useState(["practitioner"]);
  const [generatedQuestions, setGeneratedQuestions] = useState([]);
  const [error, setError] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [apiProvider, setApiProvider] = useState("gemini"); // gemini
  const [editingIndex, setEditingIndex] = useState(null);

  function buildBaseQuestionPayload(question) {
    return {
      questionText: question.questionText,
      options: question.options,
      correctIndex: question.correctIndex,
      level: Number(selectedLevel),
      usertype: [...selectedUserType],
      explanation: question.explanation || ""
    };
  }

  function buildLiveQuestionPayload(question) {
    const base = buildBaseQuestionPayload(question);
    const timestamp = new Date();
    return {
      ...base,
      createdAt: timestamp,
      updatedAt: timestamp
    };
  }

  function buildStagingQuestionPayload(question) {
    const base = buildBaseQuestionPayload(question);
    const timestamp = new Date();
    return {
      ...base,
      createdAt: timestamp,
      updatedAt: timestamp,
      published: false,
      publishedBatchId: null,
      __action: "create",
      __targetId: null
    };
  }

  async function persistGeneratedQuestions(questions) {
    if (!db) {
      throw new Error("Firebase not configured");
    }
    if (!questions.length) {
      return { destination: isAdmin ? "live" : "staging", count: 0 };
    }

    if (isAdmin) {
      let success = 0;
      for (const question of questions) {
        await addDoc(collection(db, "quizQuestions"), buildLiveQuestionPayload(question));
        success++;
      }
      return { destination: "live", count: success };
    }

    const batchRef = await addDoc(collection(db, "stagingBatches"), {
      status: "pending",
      createdAt: new Date(),
      createdByUid: currentUser?.uid || null,
      createdByEmail: currentUser?.email || null,
      totals: { success: 0, error: 0, total: questions.length },
      notes: "AI generator submission"
    });

    let success = 0;
    for (const question of questions) {
      await addDoc(
        collection(db, "stagingBatches", batchRef.id, "questions"),
        buildStagingQuestionPayload(question)
      );
      success++;
    }

    await updateDoc(doc(db, "stagingBatches", batchRef.id), {
      totals: { success, error: 0, total: questions.length },
      updatedAt: new Date()
    });

    return { destination: "staging", count: success, batchId: batchRef.id };
  }

  useEffect(() => {
    // Load API key from env
    const savedKey = localStorage.getItem("ai_api_key");
    if (savedKey) {
      setApiKey(savedKey);
    } else {
      const envKey =
        import.meta.env.VITE_AI_API_KEY ||
        import.meta.env.EXPO_PUBLIC_AI_API_KEY ||
        import.meta.env.VITE_GEMINI_API_KEY ||
        import.meta.env.EXPO_PUBLIC_GEMINI_API_KEY;
      if (envKey) {
        setApiKey(envKey);
      }
    }
  }, []);

  async function generateQuestions() {
    if (!prompt.trim()) {
      setError("Please enter a prompt");
      return;
    }

    if (!apiKey) {
      setError("Please enter your AI API key or set it in .env file");
      return;
    }

    setGenerating(true);
    setError("");
    setGeneratedQuestions([]);

    try {
      const questions = await callAIAPI(
        prompt,
        numQuestions,
        selectedLevel,
        selectedUserType
      );
      setGeneratedQuestions(questions);
    } catch (err) {
      console.error("Error generating questions:", err);
      setError("Failed to generate questions: " + err.message);
    } finally {
      setGenerating(false);
    }
  }

  async function callAIAPI(promptText, count, level, userTypes) {
    const systemPrompt = `You are a quiz question generator. Generate ${count} multiple-choice quiz questions based on the user's prompt.

Requirements:
- Each question must have exactly 4 options (A, B, C, D)
- One option must be clearly the correct answer
- Include an explanation for the correct answer
- Questions should be appropriate for level ${level}
- Questions should be relevant for: ${userTypes.join(", ")}

Return ONLY a valid JSON array with this exact structure:
[
  {
    "questionText": "Question text here",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctIndex": 0,
    "explanation": "Explanation of why the correct answer is right"
  }
]

Do not include any text before or after the JSON array.`;

    const userPrompt = `Generate ${count} quiz questions about: ${promptText}`;
    return await callGeminiStudio(systemPrompt, userPrompt, apiKey);
  }

  async function callGeminiStudio(systemPrompt, userPrompt, key) {
    // Combine system prompt and user prompt for Gemini
    const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: fullPrompt,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 8192,
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        error.error?.message || `Gemini API error: ${response.statusText}`
      );
    }

    const data = await response.json();
    const content = data.candidates[0].content.parts[0].text;

    // Parse JSON response
    let parsed;
    try {
      parsed = JSON.parse(content);
      // Handle if Gemini returns { questions: [...] } format
      if (parsed.questions) {
        return parsed.questions;
      }
      // Handle if it's already an array
      if (Array.isArray(parsed)) {
        return parsed;
      }
      // Handle if it's a single object
      return [parsed];
    } catch (e) {
      // Try to extract JSON from markdown code blocks
      const jsonMatch =
        content.match(/```json\s*([\s\S]*?)\s*```/) ||
        content.match(/```\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[1]);
        return parsed.questions || (Array.isArray(parsed) ? parsed : [parsed]);
      }
      throw new Error("Failed to parse AI response as JSON: " + e.message);
    }
  }

  async function saveQuestion(question, index) {
    if (!db) {
      alert("Firebase not configured");
      return;
    }

    try {
      const result = await persistGeneratedQuestions([question]);
      const updated = generatedQuestions.filter((_, i) => i !== index);
      setGeneratedQuestions(updated);
      if (result.destination === "live") {
        alert("Question saved successfully!");
      } else {
        alert(`Question submitted for admin review. Batch: ${result.batchId}`);
      }
    } catch (error) {
      console.error("Error saving question:", error);
      alert("Error saving question: " + error.message);
    }
  }

  async function saveAllQuestions() {
    if (!db) {
      alert("Firebase not configured");
      return;
    }

    if (generatedQuestions.length === 0) {
      alert("No questions to save");
      return;
    }

    try {
      setLoading(true);
      const result = await persistGeneratedQuestions(generatedQuestions);
      setGeneratedQuestions([]);
      if (result.destination === "live") {
        alert(`Successfully saved ${result.count} questions!`);
      } else {
        alert(
          `Submitted ${result.count} questions for admin review. Batch: ${result.batchId}`
        );
      }
    } catch (error) {
      console.error("Error saving questions:", error);
      alert("Error saving questions: " + error.message);
    } finally {
      setLoading(false);
    }
  }

  function handleUserTypeChange(type) {
    if (selectedUserType.includes(type)) {
      setSelectedUserType(selectedUserType.filter((t) => t !== type));
    } else {
      setSelectedUserType([...selectedUserType, type]);
    }
  }

  function handleEditQuestion(index) {
    setEditingIndex(index);
  }

  function handleSaveEdit(index, updatedQuestion) {
    const updated = [...generatedQuestions];
    updated[index] = updatedQuestion;
    setGeneratedQuestions(updated);
    setEditingIndex(null);
  }

  function handleCancelEdit() {
    setEditingIndex(null);
  }

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1>AI Quiz Generator</h1>
        <button onClick={() => navigate("/")} style={styles.backButton}>
          Back to Dashboard
        </button>
      </header> 

      <div style={styles.formSection}>
        <h3>Generate Questions</h3>

        <div style={styles.formGroup}>
          <label style={styles.label}>Prompt/Topic: *</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g., 'Generate questions about cardiovascular health' or 'Create quiz questions on diabetes management'"
            rows="3"
            style={styles.textarea}
            required
          />
        </div>

        <div style={styles.formRow}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Number of Questions:</label>
            <input
              type="number"
              min="1"
              max="20"
              value={numQuestions}
              onChange={(e) => setNumQuestions(Number(e.target.value))}
              style={styles.numberInput}
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Level:</label>
            <select
              value={selectedLevel}
              onChange={(e) => setSelectedLevel(e.target.value)}
              style={styles.select}
            >
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
              <option value="4">4</option>
            </select>
          </div>
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>User Type: *</label>
          <div style={styles.checkboxGroup}>
            {["practitioner", "patient", "youth"].map((type) => (
              <label key={type} style={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={selectedUserType.includes(type)}
                  onChange={() => handleUserTypeChange(type)}
                  style={styles.checkbox}
                />
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </label>
            ))}
          </div>
        </div>

        {error && <div style={styles.errorBox}>{error}</div>}

        <button
          onClick={generateQuestions}
          disabled={
            generating || !prompt.trim() || selectedUserType.length === 0
          }
          style={styles.generateButton}
        >
          {generating ? "Generating Questions..." : "Generate Questions"}
        </button>
      </div>

      {generatedQuestions.length > 0 && (
        <div style={styles.resultsSection}>
          <div style={styles.resultsHeader}>
            <h2>Generated Questions ({generatedQuestions.length})</h2>
            <button
              onClick={saveAllQuestions}
              disabled={loading}
              style={styles.saveAllButton}
            >
              {loading ? "Saving..." : "Save All Questions"}
            </button>
          </div>

          <div style={styles.questionsList}>
            {generatedQuestions.map((question, index) => (
              <div key={index} style={styles.questionCard}>
                {editingIndex === index ? (
                  <EditQuestionForm
                    question={question}
                    onSave={(updated) => handleSaveEdit(index, updated)}
                    onCancel={handleCancelEdit}
                  />
                ) : (
                  <>
                    <div style={styles.questionHeader}>
                      <span style={styles.questionNumber}>
                        Question {index + 1}
                      </span>
                      <div style={styles.buttonGroup}>
                        <button
                          onClick={() => handleEditQuestion(index)}
                          style={styles.editButton}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => saveQuestion(question, index)}
                          style={styles.saveButton}
                        >
                          Save This Question
                        </button>
                      </div>
                    </div>
                    <p style={styles.questionText}>{question.questionText}</p>
                    <div style={styles.optionsList}>
                      {question.options?.map((option, optIndex) => (
                        <div
                          key={optIndex}
                          style={{
                            ...styles.option,
                            ...(optIndex === question.correctIndex
                              ? styles.correctOption
                              : {}),
                          }}
                        >
                          {String.fromCharCode(65 + optIndex)}. {option}
                          {optIndex === question.correctIndex && (
                            <span style={styles.correctBadge}>✓ Correct</span>
                          )}
                        </div>
                      ))}
                    </div>
                    {question.explanation && (
                      <div style={styles.explanation}>
                        <strong>Explanation:</strong> {question.explanation}
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    padding: "2rem",
    maxWidth: "1200px",
    margin: "0 auto",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "2rem",
    paddingBottom: "1rem",
    borderBottom: "2px solid #ccc",
  },
  backButton: {
    padding: "0.5rem 1rem",
    backgroundColor: "#6c757d",
    color: "white",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
  },
  configSection: {
    backgroundColor: "white",
    padding: "1.5rem",
    borderRadius: "4px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
    marginBottom: "2rem",
  },
  formSection: {
    backgroundColor: "white",
    padding: "1.5rem",
    borderRadius: "4px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
    marginBottom: "2rem",
  },
  formGroup: {
    marginBottom: "1rem",
  },
  formRow: {
    display: "flex",
    gap: "1rem",
  },
  label: {
    display: "block",
    marginBottom: "0.5rem",
    fontWeight: "bold",
  },
  textarea: {
    width: "100%",
    padding: "0.75rem",
    border: "1px solid #ccc",
    borderRadius: "4px",
    boxSizing: "border-box",
    fontFamily: "inherit",
    fontSize: "1rem",
  },
  input: {
    width: "100%",
    padding: "0.5rem",
    border: "1px solid #ccc",
    borderRadius: "4px",
    boxSizing: "border-box",
  },
  select: {
    width: "100%",
    padding: "0.5rem",
    border: "1px solid #ccc",
    borderRadius: "4px",
    boxSizing: "border-box",
  },
  numberInput: {
    width: "100px",
    padding: "0.5rem",
    border: "1px solid #ccc",
    borderRadius: "4px",
  },
  checkboxGroup: {
    display: "flex",
    gap: "1rem",
    marginTop: "0.5rem",
  },
  checkboxLabel: {
    display: "flex",
    alignItems: "center",
    cursor: "pointer",
  },
  checkbox: {
    marginRight: "0.5rem",
    cursor: "pointer",
  },
  hint: {
    display: "block",
    marginTop: "0.25rem",
    color: "#666",
    fontSize: "0.875rem",
  },
  errorBox: {
    padding: "1rem",
    backgroundColor: "#f8d7da",
    color: "#721c24",
    borderRadius: "4px",
    marginBottom: "1rem",
  },
  generateButton: {
    padding: "0.75rem 2rem",
    backgroundColor: "#6f42c1",
    color: "white",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: "1rem",
    fontWeight: "bold",
    marginTop: "1rem",
  },
  resultsSection: {
    backgroundColor: "white",
    padding: "1.5rem",
    borderRadius: "4px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
  },
  resultsHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "1.5rem",
  },
  saveAllButton: {
    padding: "0.75rem 1.5rem",
    backgroundColor: "#28a745",
    color: "white",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: "1rem",
  },
  questionsList: {
    marginTop: "1rem",
  },
  questionCard: {
    border: "1px solid #ddd",
    borderRadius: "4px",
    padding: "1.5rem",
    marginBottom: "1.5rem",
    backgroundColor: "#f8f9fa",
  },
  questionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "1rem",
    paddingBottom: "0.5rem",
    borderBottom: "1px solid #ddd",
  },
  buttonGroup: {
    display: "flex",
    gap: "0.5rem",
  },
  questionNumber: {
    fontWeight: "bold",
    fontSize: "1.1rem",
    color: "#6f42c1",
  },
  editButton: {
    padding: "0.5rem 1rem",
    backgroundColor: "#ffc107",
    color: "#000",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: "0.875rem",
  },
  saveButton: {
    padding: "0.5rem 1rem",
    backgroundColor: "#007bff",
    color: "white",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: "0.875rem",
  },
  questionText: {
    fontSize: "1.1rem",
    marginBottom: "1rem",
    fontWeight: "500",
  },
  optionsList: {
    marginBottom: "1rem",
  },
  option: {
    padding: "0.75rem",
    marginBottom: "0.5rem",
    backgroundColor: "white",
    borderRadius: "4px",
    border: "1px solid #ddd",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  correctOption: {
    backgroundColor: "#d4edda",
    borderColor: "#28a745",
  },
  correctBadge: {
    color: "#28a745",
    fontWeight: "bold",
    fontSize: "0.875rem",
  },
  explanation: {
    marginTop: "1rem",
    padding: "1rem",
    backgroundColor: "#e7f3ff",
    borderRadius: "4px",
    fontSize: "0.9rem",
    color: "#004085",
  },
  editForm: {
    padding: "1rem",
  },
  optionRow: {
    display: "flex",
    alignItems: "center",
    marginBottom: "0.5rem",
  },
  radio: {
    marginRight: "0.5rem",
  },
  optionInput: {
    flex: 1,
    padding: "0.5rem",
    border: "1px solid #ccc",
    borderRadius: "4px",
    marginRight: "0.5rem",
  },
  correctLabel: {
    color: "green",
    fontSize: "0.875rem",
  },
  editButtonGroup: {
    display: "flex",
    gap: "1rem",
    marginTop: "1rem",
  },
  saveEditButton: {
    padding: "0.5rem 1rem",
    backgroundColor: "#28a745",
    color: "white",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: "0.875rem",
  },
  cancelEditButton: {
    padding: "0.5rem 1rem",
    backgroundColor: "#6c757d",
    color: "white",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: "0.875rem",
  },
};
