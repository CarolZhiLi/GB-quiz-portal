import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';


const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || import.meta.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || import.meta.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || import.meta.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || import.meta.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || import.meta.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID || import.meta.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};


// Initialize Firebase - handle errors gracefully for viewing without config
let app, auth, db, storage;

try {
    // Debug: log what we're getting from env
    console.log('=== FIREBASE CONFIG DEBUG ===');
    console.log('Raw env check:', {
        VITE_FIREBASE_API_KEY_exists: !!import.meta.env.VITE_FIREBASE_API_KEY,
        EXPO_PUBLIC_FIREBASE_API_KEY_exists: !!import.meta.env.EXPO_PUBLIC_FIREBASE_API_KEY,
        VITE_FIREBASE_PROJECT_ID_exists: !!import.meta.env.VITE_FIREBASE_PROJECT_ID,
        EXPO_PUBLIC_FIREBASE_PROJECT_ID_exists: !!import.meta.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
        all_firebase_keys: Object.keys(import.meta.env).filter(k => k.includes('FIREBASE'))
    });
    console.log('Config object:', {
        hasApiKey: !!firebaseConfig.apiKey,
        hasProjectId: !!firebaseConfig.projectId,
        apiKeyType: typeof firebaseConfig.apiKey,
        apiKeyLength: firebaseConfig.apiKey?.length || 0,
        projectIdValue: firebaseConfig.projectId || 'undefined'
    });

    // Only initialize if config values are present and valid (not placeholders or undefined)
    const hasValidConfig = firebaseConfig.apiKey &&
        firebaseConfig.projectId &&
        firebaseConfig.apiKey !== 'undefined' &&
        firebaseConfig.projectId !== 'undefined' &&
        firebaseConfig.apiKey !== 'YOUR_API_KEY' &&
        firebaseConfig.projectId !== 'YOUR_PROJECT_ID' &&
        typeof firebaseConfig.apiKey === 'string' &&
        typeof firebaseConfig.projectId === 'string' &&
        firebaseConfig.apiKey.length > 0 &&
        firebaseConfig.projectId.length > 0;

    if (hasValidConfig) {
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);
        storage = getStorage(app);
        console.log('鉁?Firebase initialized successfully');
    } else {
        console.error('鉂?Firebase config validation failed!', {
            apiKey: firebaseConfig.apiKey ? 'present' : 'MISSING',
            projectId: firebaseConfig.projectId ? 'present' : 'MISSING',
            apiKeyType: typeof firebaseConfig.apiKey,
            projectIdType: typeof firebaseConfig.projectId,
            apiKeyLength: firebaseConfig.apiKey?.length || 0,
            projectIdLength: firebaseConfig.projectId?.length || 0
        });
        console.error('Make sure your .env file has VITE_FIREBASE_API_KEY and VITE_FIREBASE_PROJECT_ID');
        // Don't initialize Firebase if using placeholder values
        auth = null;
        db = null;
        storage = null;
        app = null;
    }
} catch (error) {
    console.error('鉂?Firebase initialization error:', error);
    auth = null;
    db = null;
    storage = null;
    app = null;
}

export { auth, db, storage };
export default app;


