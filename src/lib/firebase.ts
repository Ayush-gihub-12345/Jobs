import { initializeApp } from "firebase/app";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, updateProfile, signOut as firebaseSignOut,
  onAuthStateChanged, setPersistence, browserLocalPersistence, type User,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const firebaseConfigured = !!firebaseConfig.apiKey && !!firebaseConfig.projectId;

const app = firebaseConfigured ? initializeApp(firebaseConfig) : null;
export const auth = app ? getAuth(app) : null;
// Session persists across browser restarts (not just the current tab) — sign in once, stay
// signed in until an explicit sign-out, same expectation as any SaaS product.
if (auth) void setPersistence(auth, browserLocalPersistence);

export function watchAuth(cb: (user: User | null) => void) {
  if (!auth) { cb(null); return () => {}; }
  return onAuthStateChanged(auth, cb);
}

export async function signInGoogle() {
  if (!auth) throw new Error("Firebase is not configured");
  await signInWithPopup(auth, new GoogleAuthProvider());
}

export async function signInEmail(email: string, password: string) {
  if (!auth) throw new Error("Firebase is not configured");
  await signInWithEmailAndPassword(auth, email, password);
}

export async function signUpEmail(email: string, password: string, name: string) {
  if (!auth) throw new Error("Firebase is not configured");
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  if (name) await updateProfile(cred.user, { displayName: name });
}

export async function signOut() {
  if (!auth) return;
  await firebaseSignOut(auth);
}

export type { User };
