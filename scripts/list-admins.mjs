// Usage:
//   node scripts/list-admins.mjs [--key=C:\path\to\service-account.json] [--role=operational] [--all]
//
// - Without --all: prints only users whose matching custom claim is true (defaults to admin)
// - With --all: prints every user and their custom claims
//
// Auth options:
//   Set env GOOGLE_APPLICATION_CREDENTIALS to service account JSON, or pass --key=PATH

import admin from 'firebase-admin';
import fs from 'node:fs';

const VALID_ROLES = ['admin', 'operational'];

function parseArgs(argv = []) {
  const out = { keyPath: null, all: false, role: 'admin' };
  for (const a of argv) {
    if (a === '--all') out.all = true;
    else if (a.startsWith('--key=')) out.keyPath = a.slice('--key='.length);
    else if (a.startsWith('--role=')) out.role = a.slice('--role='.length).toLowerCase();
  }
  return out;
}

function initAdminOrThrow(keyPath) {
  if (keyPath) {
    const raw = fs.readFileSync(keyPath, 'utf8');
    const serviceAccount = JSON.parse(raw);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id
    });
    return;
  }
  const hasADC = !!process.env.GOOGLE_APPLICATION_CREDENTIALS || !!process.env.GOOGLE_CLOUD_PROJECT || !!process.env.GCLOUD_PROJECT || !!process.env.FIREBASE_CONFIG;
  if (hasADC) {
    admin.initializeApp({ credential: admin.credential.applicationDefault() });
    return;
  }
  throw new Error('Missing credentials. Set GOOGLE_APPLICATION_CREDENTIALS or pass --key=PATH');
}

async function listAllUsers() {
  const out = [];
  let nextPageToken = undefined;
  do {
    const res = await admin.auth().listUsers(1000, nextPageToken);
    out.push(...res.users);
    nextPageToken = res.pageToken;
  } while (nextPageToken);
  return out;
}

function printUsers(users, { all, role }) {
  const filtered = all ? users : users.filter((u) => u.customClaims && u.customClaims[role] === true);
  if (!filtered.length) {
    console.log(all ? 'No users found.' : `No ${role} users found.`);
    return;
  }
  for (const u of filtered) {
    console.log('- email:', u.email || '(no email)');
    console.log('  uid  :', u.uid);
    console.log('  claims:', u.customClaims || {});
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!VALID_ROLES.includes(args.role)) {
    console.error(`Role must be one of: ${VALID_ROLES.join(', ')}`);
    process.exit(1);
  }
  try {
    initAdminOrThrow(args.keyPath);
  } catch (e) {
    console.error('Failed to initialize Firebase Admin SDK:', e.message);
    process.exit(1);
  }
  try {
    const users = await listAllUsers();
    printUsers(users, args);
    process.exit(0);
  } catch (e) {
    console.error('Failed to list users:', e.message);
    process.exit(1);
  }
}

main();

