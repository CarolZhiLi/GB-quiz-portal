# Quiz Content Management Portal

A functional web portal for managing quiz questions in the Granville Biomedical mobile app. This portal provides CRUD operations and bulk upload functionality for quiz content.

## Features

- **User Authentication**: Secure login with Firebase Authentication
- **Question Management**: Create, read, update, and delete quiz questions
- **Bulk Upload**: Upload multiple questions from CSV or Excel files
- **Protected Routes**: Only authenticated operational or admin users can access the portal; operational users can edit/submit content while admin users can also approve and publish it
- **Role-aware UI**: Built-in header with logout for signed-in users plus an Access Denied view for accounts lacking the required custom claims

## Role Setup (Quick Start)

- Configure Firebase env vars in `.env.local` (see step 2 below) and enable Email/Password auth in Firebase Console.
- Install the Admin SDK locally for scripts: `npm i -D firebase-admin`.
- Create a service account key: Firebase Console → Project Settings → Service accounts → Generate new private key. Save it locally and keep it out of version control.
- Assign the `operational` and/or `admin` custom claim to your account (Windows example):
  - `node scripts\set-admin-claim.mjs your-email@example.com --role=operational --key="C:\\path\\to\\service-account.json"`
  - `node scripts\set-admin-claim.mjs your-email@example.com --key="C:\\path\\to\\service-account.json"`
  - macOS/Linux:
    - `node scripts/set-admin-claim.mjs your-email@example.com --role=operational --key="$HOME/path/to/service-account.json"`
    - `node scripts/set-admin-claim.mjs your-email@example.com --key="$HOME/path/to/service-account.json"`
- Sign out and sign back in after changing roles so the ID token refreshes.
- Verify the role(s):
  - Load `/admin-review` to confirm admin access, or run `node scripts/list-admins.mjs --role=operational --key="C:\\path\\to\\service-account.json"` to inspect the operational claim (omit `--role` to list admins).


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
    function isSignedIn() {
      return request.auth != null;
    }

    function isAdmin() {
      return isSignedIn() && (request.auth.token.admin == true);
    }

    function isOperational() {
      return isSignedIn() && (request.auth.token.operational == true);
    }

    function canModifyStaging() {
      return isAdmin() || isOperational();
    }

    // Live Quiz Questions - public read, admin-only writes
    match /quizQuestions/{questionId} {
      allow read: if true;
      allow create, update, delete: if isAdmin();
    }
    
    match /subscriptions/{userId} {
  allow create: if isSignedIn() && request.auth.uid == userId;
  allow read, update: if isAdmin() || (isSignedIn() && request.auth.uid == userId);
  allow delete: if isAdmin();
}

    // Staging batches metadata
    match /stagingBatches/{batchId} {
      // Batch metadata remains readable by anyone.
      allow read: if true;

      // Only operational or admin users can write batches.
      allow create: if canModifyStaging();

      // Updates/deletes are allowed for admin users or the original creator (who must also hold a portal role).
      allow update, delete: if canModifyStaging() && (
        isAdmin() ||
        (isSignedIn() && request.auth.uid == resource.data.createdByUid)
      );
    }

    // Staging questions under a batch
    match /stagingBatches/{batchId}/questions/{qid} {
      // Anyone can read staged question docs (adjust as needed)
      allow read: if true;

      // Writes allowed only for portal participants owning the parent batch (or admin).
      allow create, update, delete: if canModifyStaging() && (
        isAdmin() ||
        (isSignedIn() && request.auth.uid == get(/databases/$(database)/documents/stagingBatches/$(batchId)).data.createdByUid)
      );
    }
  }
}
```

Deploy rules with Firebase CLI:

```
firebase deploy --only firestore:rules
```

### 5. Assign Portal Roles via Custom Claims

Portal access is granted through Firebase custom claims: `operational` users can create/edit staging batches and submit them for review, while `admin` users can also approve and publish to the live `quizQuestions` collection. You can use the built-in helper script to manage both roles:

- Grant the `operational` role (Windows example):  
  `node scripts\set-admin-claim.mjs user@example.com --role=operational --key="C:\\path\\to\\service-account.json"`
- Grant the `admin` role (defaults to admin if `--role` is omitted):
  `node scripts\set-admin-claim.mjs user@example.com --key="C:\\path\\to\\service-account.json"`
- Remove either role with `--unset` (e.g., `node scripts\set-admin-claim.mjs user@example.com --role=operational --unset --key=...`).

After changing claims, sign out and sign back in so the ID token refreshes and reflects the new role.

Verify roles:
- `node scripts/list-admins.mjs --role=operational --key="C:\\path\\to\\service-account.json"` lists users with the operational role (omit `--role` to show admins).
- In the browser console (current user only): `await (await auth.currentUser.getIdTokenResult(true)).claims`

## Portal Login and Role Behavior

Only authenticated users with the `operational` or `admin` claim can enter the portal. Normal Firebase accounts without either role land on an access denied page and cannot reach the dashboard, quiz generator, or admin review views.

- **Login**
  - Navigate to `/login` and sign in with Email/Password.
  - The email/password account must bear the `operational` and/or `admin` custom claim (see above).
- **Operational workflow**
  - Operational users can access the Dashboard, generate questions, bulk upload, and edit staging batches they own.
  - All changes are staged for approval; operational users cannot publish directly to `quizQuestions`.
  - Operational users do not see the `/admin-review` page.

- **Admin workflow**
  - Admin users also see the Dashboard and generator plus the `/admin-review` route.
  - The Admin Review page lets them approve or reject staged batches, which publishes approved items to `quizQuestions`.
  - Approving a batch handles `create`, `update`, and `delete` actions from staging and chunks writes to avoid Firestore limits.

- **Non-role accounts**
  - Signing in with an account that lacks both roles results in an access denied notice.
  - Ensure the account has the correct role claim and that the browser has reloaded after signing out/in.
- **Troubleshooting**
  - "Missing or insufficient permissions" when approving a batch usually means your token lacks `admin: true` or the new rules were not deployed.
  - Confirm you are using the right Firebase project (check `.env.local` vs the service account key).

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


