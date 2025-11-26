# Quiz Content Management Portal

A functional web portal for managing quiz questions in the Granville Biomedical mobile app. This portal provides CRUD operations and bulk upload functionality for quiz content.


## Role Setup (Quick Start)

Please refer role setup manual.


## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Firebase

Fill in environment variables (Vite-style).
1. Copy `.env.example` to `.env.local` at the repo root
2. Fill in the required values by refering the environment file.


## Running the Application

### Development

```bash
npm run dev
```

The application will be available at `http://localhost:3000`.

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


## Portal Login and Role Behavior

Only authenticated users with the `operational` or `admin` claim can enter the portal. Normal Firebase accounts without either role land on an access denied page and cannot reach the dashboard, quiz generator, or admin review views.

- **Login**
  - Navigate to `/login` and sign in with Email/Password.
  - The email/password account must bear the `operational` and/or `admin` custom claim.
- **Operational workflow**
  - Operational users can access the Dashboard, generate questions, bulk upload, and edit staging batches they own.
  - All changes are staged for approval; operational users cannot publish directly to `quizQuestions`.
  - Operational users do not see the `/admin-review` page.

- **Admin workflow**
  - Admin users also see the Dashboard and generator plus the `/admin-review` route.
  - The Admin Review page lets them approve or reject staged batches, which publishes approved items to `quizQuestions`.
  - Approving a batch handles `create`, `update`, and `delete` actions from staging and chunks writes to avoid Firestore limits.

