# Firebase Hosting Setup Guide

This guide will help you deploy your Quiz Management Portal to Firebase Hosting.

## Prerequisites

1. **Firebase CLI** - Install if you don't have it:
   ```bash
   npm install -g firebase-tools
   ```

2. **Firebase Project Access** - You need:
   - Access to the Firebase project (as a developer)
   - The Firebase Project ID (from your `.env` file: `VITE_FIREBASE_PROJECT_ID` or `EXPO_PUBLIC_FIREBASE_PROJECT_ID`)

## Step-by-Step Instructions

### Step 1: Login to Firebase CLI

```bash
firebase login
```

This will open a browser window for you to authenticate with your Google account.

### Step 2: Update Project ID

Edit `.firebaserc` and replace `YOUR_PROJECT_ID` with your actual Firebase Project ID:

```json
{
  "projects": {
    "default": "your-actual-project-id"
  }
}
```

You can find your Project ID in:
- Your `.env` file (look for `VITE_FIREBASE_PROJECT_ID` or `EXPO_PUBLIC_FIREBASE_PROJECT_ID`)
- Firebase Console → Project Settings → General

### Step 3: Initialize Firebase Hosting (if not already done)

If Firebase Hosting is not enabled in your project, you may need an admin to:
1. Go to Firebase Console → Hosting
2. Click "Get Started"
3. Follow the setup wizard

**As a developer**, you can try to initialize it yourself:
```bash
firebase init hosting
```

If you get a permissions error, ask your admin to enable Hosting for you.

### Step 4: Build Your Project

Build your React app for production:

```bash
npm run build
```

This creates a `dist/` folder with your production-ready files.

### Step 5: Deploy to Firebase Hosting

Deploy your site:

```bash
firebase deploy --only hosting
```

If you also want to deploy Firestore rules at the same time:

```bash
firebase deploy
```

### Step 6: Access Your Site

After deployment, Firebase will give you a URL like:
```
https://your-project-id.web.app
```
or
```
https://your-project-id.firebaseapp.com
```

## Important Notes for Developers (Non-Admin)

### What You CAN Do:
- ✅ Deploy to Firebase Hosting (if you have hosting permissions)
- ✅ Deploy Firestore rules (if you have Firestore permissions)
- ✅ View deployment history
- ✅ Preview deployments

### What You MAY Need Admin Help For:
- ❌ Enable Firebase Hosting in the project (first time setup)
- ❌ Set up custom domain
- ❌ Configure custom domain SSL certificates
- ❌ Change billing settings
- ❌ Add/remove team members

### If You Get Permission Errors:

If you see errors like:
- `Error: HTTP Error: 403, Permission denied`
- `Error: You do not have permission to access this project`

**Solutions:**
1. Ask your Firebase project admin to grant you the "Firebase Hosting Admin" role
2. Or ask them to deploy for you using the same commands above

## Environment Variables for Production

⚠️ **Important**: Your `.env` file is NOT deployed. Environment variables are baked into the build during `npm run build`.

Make sure your `.env` file has all the correct values before building:

```env
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
```

## Deployment Workflow

For future updates:

1. Make your code changes
2. Build: `npm run build`
3. Deploy: `firebase deploy --only hosting`

Or deploy everything (hosting + rules):
```bash
firebase deploy
```

## Troubleshooting

### Build fails
- Check that all dependencies are installed: `npm install`
- Check for TypeScript/ESLint errors

### Deploy fails with permission error
- Verify you're logged in: `firebase login`
- Check your project ID in `.firebaserc`
- Ask admin to verify your permissions

### Site loads but Firebase doesn't work
- Check browser console for errors
- Verify environment variables were included in build
- Check that Firestore rules are deployed

### Can't find project
- List your projects: `firebase projects:list`
- Use the correct project ID from your `.env` file

## Quick Reference Commands

```bash
# Login
firebase login

# List projects
firebase projects:list

# Use a specific project
firebase use <project-id>

# Build
npm run build

# Deploy hosting only
firebase deploy --only hosting

# Deploy everything
firebase deploy

# View deployment history
firebase hosting:channel:list

# Preview a deployment
firebase hosting:channel:deploy preview-channel-name
```

