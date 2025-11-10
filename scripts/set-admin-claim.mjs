// Usage:
//   Set admin:   node scripts/set-admin-claim.mjs user@example.com [--key=C:\path\to\service-account.json]
//   Unset admin: node scripts/set-admin-claim.mjs user@example.com --unset [--key=...]
//
// Auth:
// - Preferred: set env var GOOGLE_APPLICATION_CREDENTIALS to your service account JSON
//   PowerShell: $env:GOOGLE_APPLICATION_CREDENTIALS="C:\\secrets\\firebase-admin-key.json"
//   macOS/Linux: export GOOGLE_APPLICATION_CREDENTIALS="$HOME/secrets/firebase-admin-key.json"
// - Or pass --key=PATH to the service account JSON file

import admin from 'firebase-admin';
import fs from 'node:fs';

function parseArgs(argv = []) {
  const out = { email: null, keyPath: null, unset: false };
  for (const a of argv) {
    if (a === '--unset') out.unset = true;
    else if (a.startsWith('--key=')) out.keyPath = a.slice('--key='.length);
    else if (!out.email) out.email = a;
  }
  return out;
}

function printUsage() {
  console.log(`\nSet or remove custom claim admin for a Firebase user\n\n` +
    `Examples:\n` +
    `  node scripts/set-admin-claim.mjs user@example.com\n` +
    `  node scripts/set-admin-claim.mjs user@example.com --unset\n` +
    `  node scripts/set-admin-claim.mjs user@example.com --key=C:\\secrets\\firebase-admin-key.json\n\n` +
    `Auth options:\n` +
    `  - Set env GOOGLE_APPLICATION_CREDENTIALS to service account JSON\n` +
    `  - Or pass --key=PATH to service account JSON\n`);
}

function initAdminOrThrow(keyPath) {
  // Prefer explicit key if provided
  if (keyPath) {
    const raw = fs.readFileSync(keyPath, 'utf8');
    const serviceAccount = JSON.parse(raw);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id
    });
    return;
  }
  // Next try Application Default Credentials when env is configured
  const hasADC = !!process.env.GOOGLE_APPLICATION_CREDENTIALS || !!process.env.GOOGLE_CLOUD_PROJECT || !!process.env.GCLOUD_PROJECT || !!process.env.FIREBASE_CONFIG;
  if (hasADC) {
    admin.initializeApp({ credential: admin.credential.applicationDefault() });
    return;
  }
  throw new Error('Missing credentials. Set GOOGLE_APPLICATION_CREDENTIALS or pass --key=PATH');
}

async function main() {
  const { email, keyPath, unset } = parseArgs(process.argv.slice(2));
  if (!email) {
    printUsage();
    process.exit(1);
  }

  try {
    initAdminOrThrow(keyPath);
  } catch (err) {
    console.error('Failed to initialize Firebase Admin SDK:', err.message);
    process.exit(1);
  }

  try {
    const user = await admin.auth().getUserByEmail(email);
    const nextClaims = { ...(user.customClaims || {}) };
    if (unset) {
      delete nextClaims.admin;
    } else {
      nextClaims.admin = true;
    }
    await admin.auth().setCustomUserClaims(user.uid, nextClaims);
    const updated = await admin.auth().getUser(user.uid);
    console.log('Success. Claims for', email, '=>', updated.customClaims || {});
    console.log('Note: Sign out and sign back in for the client to see updated claims.');
    process.exit(0);
  } catch (err) {
    console.error('Error setting custom claims:', err.message);
    process.exit(1);
  }
}

main();
