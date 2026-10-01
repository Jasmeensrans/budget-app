import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { getDb, getFirebaseAuth, isFirebaseConfigured } from './firebase';
import { createFirestoreRepository } from './firestoreRepository';
import { connectRepository } from './live';
import { createLocalRepository } from './localRepository';

export interface SignedInUser {
  uid: string;
  email: string | null;
  name: string | null;
}

export type AuthState =
  | { status: 'loading' }
  /** No Firebase config: everything stays in this browser. */
  | { status: 'local' }
  | { status: 'signedOut' }
  | { status: 'signedIn'; user: SignedInUser };

const AuthContext = createContext<AuthState>({ status: 'loading' });

/** Connects the data layer to Firestore while someone is signed in. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(isFirebaseConfigured ? { status: 'loading' } : { status: 'local' });

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    return onAuthStateChanged(getFirebaseAuth(), (user) => {
      if (user) {
        connectRepository(createFirestoreRepository(getDb(), user.uid));
        setState({ status: 'signedIn', user: { uid: user.uid, email: user.email, name: user.displayName } });
      } else {
        connectRepository(createLocalRepository());
        setState({ status: 'signedOut' });
      }
    });
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}

export async function signInWithGoogle() {
  const auth = getFirebaseAuth();
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    await signInWithPopup(auth, provider);
  } catch (err) {
    // Some phone browsers block popups; fall back to a full-page redirect.
    const code = (err as { code?: string }).code;
    if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
      await signInWithRedirect(auth, provider);
      return;
    }
    throw err;
  }
}

export function signOut() {
  return firebaseSignOut(getFirebaseAuth());
}
