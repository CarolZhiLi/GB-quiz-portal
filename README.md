# Quiz Content Management Portal

A functional web portal for managing quiz questions in the Granville Biomedical mobile app. This portal provides CRUD operations and bulk upload functionality for quiz content.

## Features

- **User Authentication**: Secure login with Firebase Authentication
- **Question Management**: Create, read, update, and delete quiz questions
- **Bulk Upload**: Upload multiple questions from CSV or Excel files
- **Protected Routes**: Only authenticated admin users can access the portal

## Admin Setup (Quick Start)

- Configure Firebase env vars in `.env.local` (see step 2 below) and enable Email/Password auth in Firebase Console.
- Install Admin SDK locally for scripts: `npm i -D firebase-admin`.
- Create a service account key: Firebase Console → Project Settings → Service accounts → Generate new private key. Save it locally, do not commit.
- Grant admin to your account (Windows example):
  - `node scripts\set-admin-claim.mjs your-email@example.com --key="C:\\path\\to\\service-account.json"`
- macOS/Linux:
  - `node scripts/set-admin-claim.mjs your-email@example.com --key="$HOME/path/to/service-account.json"`
- Sign out and sign back in to refresh claims. Verify via:
  - Open `/admin-review` (should load), or list admins with `node scripts/list-admins.mjs --key="C:\\path\\to\\service-account.json"`


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

Two‑stage upload is implemented with a live collection and a staging area:

- Live: `quizQuestions` (public read, admin‑only writes)
- Staging: `stagingBatches/{batchId}` and `stagingBatches/{batchId}/questions` (public read, writes allowed for batch creator and admins)

Example (matches the app’s default rules):

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isSignedIn() { return request.auth != null; }
    function isAdmin() { return isSignedIn() && (request.auth.token.admin == true); }

    // Live questions: public read, admin-only write
    match /quizQuestions/{id} {
      allow read: if true;
      allow create, update, delete: if isAdmin();
    }

    // Staging batches
    match /stagingBatches/{batchId} {
      allow read: if true; // adjust to isAdmin() if you want private
      allow create: if true; // for production, consider: if isSignedIn();
      allow update, delete: if isAdmin() || (isSignedIn() && request.auth.uid == resource.data.createdByUid) || (!isSignedIn() && resource.data.createdByUid == null);
    }

    // Staged questions
    match /stagingBatches/{batchId}/questions/{qid} {
      allow read: if true;
      allow create, update, delete: if isAdmin() || (isSignedIn() && request.auth.uid == get(/databases/$(database)/documents/stagingBatches/$(batchId)).data.createdByUid) || (!isSignedIn() && get(/databases/$(database)/documents/stagingBatches/$(batchId)).data.createdByUid == null);
    }
  }
}
```

Deploy rules with Firebase CLI:

```
firebase deploy --only firestore:rules
```

### 5. Set Admin Custom Claim

You need to set the `admin: true` custom claim for accounts that can publish to the live collection and access the Admin Review page.

Options:

1) Using Admin SDK in a small script (recommended)

Create `setAdminClaim.mjs` and run with Node (this repo uses ESM by default):

```js
import admin from 'firebase-admin';
import serviceAccount from './path-to-service-account-key.json' assert { type: 'json' };

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const email = 'your-admin@email.com';
const claims = { admin: true };

const user = await admin.auth().getUserByEmail(email);
await admin.auth().setCustomUserClaims(user.uid, claims);
console.log('Custom claims set for', email, claims);
process.exit(0);
```

Then run:

```
node setAdminClaim.mjs
```

2) Programmatically in a server environment (Cloud Functions, backend service)
- Use the Admin SDK and call `setCustomUserClaims(uid, { admin: true })` during provisioning.

After setting claims, the user must sign out and sign back in to refresh the ID token so the claim is visible to the client.

Verify admin status quickly:

- List admins via script: `node scripts/list-admins.mjs --key="C:\\path\\to\\service-account.json"`
- Or in the browser console (for the current user only): `await (await auth.currentUser.getIdTokenResult(true)).claims`

## Admin Login and Usage

Admin users can log in and approve/reject staged changes before they are published to the live collection.

- Login
  - Navigate to `/login` and sign in with Email/Password.
  - Ensure this account has the custom claim `admin: true` (see above).

- Admin Review
  - Navigate to `/admin-review` (visible only for admins).
  - The left pane lists staging batches (status pending/approved/rejected) with counts and creator info.
  - Select a batch to preview questions.
  - Approve: publishes staged questions to `quizQuestions`.
    - Supports create, update, and delete actions from staging:
      - `create`: creates a new document in `quizQuestions`.
      - `update`: updates the target document (merge semantics).
      - `delete`: deletes the target document.
  - Reject: marks the batch rejected (optionally add a note).

- Non‑admin behavior
  - Dashboard create/update/delete actions are staged automatically (they will not modify `quizQuestions`).
  - Bulk uploads always go to staging; a batch is created and awaits admin approval.

- Troubleshooting
  - “Missing or insufficient permissions” on Approve usually means the current user isn’t an admin or the new rules weren’t deployed.
  - Deploy rules and ensure you are logged in with an account that has `admin: true`. Sign out/in to refresh the token.

## Two‑Stage Upload Workflow

- Staging vs Live
  - Live collection: `quizQuestions` (public read, admin‑only writes)
  - Staging area: `stagingBatches/{batchId}` with `stagingBatches/{batchId}/questions`

- How data is staged
  - Bulk Upload always writes to a new staging batch and stores each parsed row in the batch’s `questions` subcollection.
  - Non‑admin Dashboard actions (create/update/delete) create a single‑item staging batch with `__action` and, for updates/deletes, `__targetId`.

- Review and publish
  - Admin visits `/admin-review`, selects a batch, and Approves or Rejects.
  - Approve processing:
    - `create` → creates a new doc in `quizQuestions`.
    - `update` → merges staged fields into the target `quizQuestions/{__targetId}`.
    - `delete` → deletes `quizQuestions/{__targetId}`.
  - Publishing runs in chunks under Firestore’s 500 write/commit limit.

- Notes
  - `imageUrl` is optional; if empty it is omitted on publish (no `undefined` fields).
  - After approval, Dashboard displays newly published items from `quizQuestions`.

- Troubleshooting
  - “Missing or insufficient permissions”: publish requires `admin: true` and deployed rules.
  - Admin claim not recognized: sign out/in; the app forces token refresh on login.
  - Wrong project: ensure `.env.local` and the service account key target the same Firebase project.

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


