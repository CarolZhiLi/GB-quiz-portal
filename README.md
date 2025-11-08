# Quiz Content Management Portal

A functional web portal for managing quiz questions in the Granville Biomedical mobile app. This portal provides CRUD operations and bulk upload functionality for quiz content.

## Features

- **User Authentication**: Secure login with Firebase Authentication
- **Question Management**: Create, read, update, and delete quiz questions
- **Bulk Upload**: Upload multiple questions from CSV or Excel files
- **Protected Routes**: Only authenticated admin users can access the portal

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Firebase

This project reads Firebase credentials from environment variables (Vite-style).

1. In Firebase Console, create a project and enable Firestore (in production or test as needed)
2. Create a Web App in the project to get the config values
3. Copy `.env.example` to `.env.local` at the repo root
4. Fill in your values:

```
VITE_FIREBASE_API_KEY=YOUR_API_KEY
VITE_FIREBASE_AUTH_DOMAIN=YOUR_PROJECT_ID.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=YOUR_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET=YOUR_PROJECT_ID.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=YOUR_SENDER_ID
VITE_FIREBASE_APP_ID=YOUR_APP_ID
```

The app initializes Firebase from these values in `src/firebase/config.js:6-12` and logs basic debug info on startup.

### 3. Set Up Firebase Authentication

1. In Firebase Console, enable Email/Password authentication
2. Create an admin user account
3. Set up custom claims (see Security Rules section below)

### 4. Configure Firestore Security Rules

For development you can start with permissive rules (see `firestore.rules`), but for production lock them down. A common pattern is:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /quizQuestions/{questionId} {
      allow read: if request.auth != null; // authenticated users can read
      allow write: if request.auth != null && request.auth.token.isAdmin == true; // only admins write
    }
  }
}
```

Deploy rules with Firebase CLI:

```
firebase deploy --only firestore:rules
```

### 5. Set Admin Custom Claim

You need to set the `isAdmin` custom claim for your admin user. This can be done via:

**Option A: Firebase Console (for development)**
- Use Firebase Admin SDK in a Node.js script

**Option B: Firebase CLI**
```bash
firebase auth:export users.json
# Then use Firebase Admin SDK to set the claim
```

**Option C: Quick setup script** (create `setAdminClaim.js`):
```javascript
const admin = require('firebase-admin');
const serviceAccount = require('./path-to-service-account-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

admin.auth().getUserByEmail('your-admin@email.com')
  .then((user) => {
    return admin.auth().setCustomUserClaims(user.uid, { isAdmin: true });
  })
  .then(() => {
    console.log('Admin claim set successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error setting admin claim:', error);
    process.exit(1);
  });
```

## Running the Application

### Development

```bash
npm run dev
```

The application will be available at `http://localhost:3000`.

On startup, check the browser console for:
- `FIREBASE CONFIG DEBUG` values
- `✅ Firebase initialized successfully` (means your env vars are set correctly)

### Production Build

```bash
npm run build
```

### Deploy to Firebase Hosting

1. Install Firebase CLI: `npm install -g firebase-tools`
2. Login: `firebase login`
3. Initialize: `firebase init hosting`
4. Build: `npm run build`
5. Deploy: `firebase deploy --only hosting`

## Usage

### Login

1. Navigate to the portal URL
2. Enter your admin email and password
3. Click "Login"

### Adding a Question

1. Click "Add New Question" button
2. Fill in the form:
   - Question Text (required)
   - Options (at least 2, mark the correct one with radio button)
   - Difficulty (Easy, Medium, or Hard)
   - Explanation (optional)
3. Click "Save"

### Editing a Question

1. Find the question in the table
2. Click "Edit" button
3. Modify the fields
4. Click "Save"

### Deleting a Question

1. Find the question in the table
2. Click "Delete" button
3. Confirm the deletion

### Bulk Upload

1. Click "Bulk Upload" button
2. Download the template Excel file (optional)
3. Fill in your questions following the template format
4. Upload your CSV or Excel file
5. Review the upload results

### Template Format

The template includes the following columns:
- `questionText`: The question text
- `option1`, `option2`, `option3`, `option4`: The answer options
- `correctIndex`: The index of the correct answer (0-3)
- `difficulty`: Easy, Medium, or Hard
- `explanation`: Optional explanation text

## Project Structure

```
quiz_management/
├── src/
│   ├── components/
│   │   ├── Login.jsx
│   │   ├── Dashboard.jsx
│   │   ├── QuestionForm.jsx
│   │   ├── BulkUpload.jsx
│   │   └── ProtectedRoute.jsx
│   ├── contexts/
│   │   └── AuthContext.jsx
│   ├── firebase/
│   │   └── config.js
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
├── package.json
├── vite.config.js
└── README.md
```

## Technologies Used

- React 18
- Vite
- Firebase (Authentication, Firestore)
- React Router
- SheetJS (xlsx) for Excel parsing
- PapaParse for CSV parsing

## Notes

- The UI is intentionally simple and functional, focusing on usability over aesthetics
- All data is stored in the `quizQuestions` collection in Firestore
- Questions require a minimum of 2 options
- The correct answer is specified by index (0-based)

### Firestore Collections

- `quizQuestions`
  - Fields: `questionText` (string), `options` (array<string>), `correctIndex` (number), `level` (number 1–4), `usertype` (array of `practitioner|patient|youth`), `explanation` (string), `createdAt` (timestamp), `updatedAt` (timestamp)
  - Used in:
    - `src/components/Dashboard.jsx` for CRUD
    - `src/components/BulkUpload.jsx` for bulk import


