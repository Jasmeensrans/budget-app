import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore';

/**
 * Firebase setup. Values come from environment variables (see .env.example):
 * locally from .env.local, on GitHub Pages from repository secrets.
 * These values identify the project; they aren't secret. Access is protected by
 * Google sign-in plus the rules in firestore.rules.
 */
const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
};

/** Without a config the app runs in local mode: data stays in this browser. */
export const isFirebaseConfigured = Boolean(config.apiKey && config.authDomain && config.projectId && config.appId);

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

function ensureApp() {
  if (!isFirebaseConfigured) throw new Error('Firebase isn’t configured. Add your settings to .env.local.');
  if (!app) {
    app = initializeApp(config);
    auth = getAuth(app);
    // Keeps a copy on the device so the app opens instantly and works offline;
    // changes sync when the connection comes back.
    db = initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
      ignoreUndefinedProperties: true,
    });
  }
}

export function getFirebaseAuth(): Auth {
  ensureApp();
  return auth!;
}

export function getDb(): Firestore {
  ensureApp();
  return db!;
}
