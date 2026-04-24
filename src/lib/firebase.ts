import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

/**
 * Firebase requires at minimum `apiKey` + `projectId` to bootstrap anything
 * useful. If either is missing (Vercel env vars not set, local .env missing)
 * we export nulls rather than throwing on import — components gracefully
 * degrade via the `isFirebaseReady` flag. Avoids blowing up static pre-render.
 */
const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId
);

let app: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;
let storageInstance: FirebaseStorage | null = null;

if (isFirebaseConfigured) {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  authInstance = getAuth(app);
  dbInstance = getFirestore(app);
  storageInstance = getStorage(app);
} else if (typeof window !== "undefined") {
  // Runtime-only warning; don't spam during build/prerender.
  console.warn(
    "[firebase] NEXT_PUBLIC_FIREBASE_API_KEY or _PROJECT_ID missing — " +
      "Firebase features are disabled."
  );
}

export const auth: Auth | null = authInstance;
/**
 * Firestore handle. Typed as non-null for ergonomic call sites; at runtime it
 * may be a placeholder when Firebase isn't configured (static build / missing
 * env). Guard with `isFirebaseReady` if you need to be safe.
 */
export const db: Firestore = (dbInstance ?? ({} as Firestore));
export const storage: FirebaseStorage = (storageInstance ?? ({} as FirebaseStorage));
export const isFirebaseReady = isFirebaseConfigured;
export default app;
