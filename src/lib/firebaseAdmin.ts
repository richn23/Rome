import { initializeApp, getApps, cert, App } from "firebase-admin/app";
import { getAuth, Auth } from "firebase-admin/auth";
import { getFirestore, Firestore } from "firebase-admin/firestore";

/**
 * Firebase Admin SDK helpers.
 *
 * Reads `FIREBASE_ADMIN_KEY` (a stringified service-account JSON) from the
 * environment. In production this lives as a Vercel env var. Locally, it
 * needs to be set in `.env.local` for any /api/admin route to work.
 *
 * Throws on first call if the env var is missing or malformed — that's
 * deliberate, so the caller can surface the misconfiguration.
 */

let cachedApp: App | null = null;

function getAdminApp(): App {
  if (cachedApp) return cachedApp;
  const existing = getApps();
  if (existing.length > 0) {
    cachedApp = existing[0];
    return cachedApp;
  }
  const raw = process.env.FIREBASE_ADMIN_KEY;
  if (!raw) {
    throw new Error(
      "FIREBASE_ADMIN_KEY is not set. Add it to Vercel env vars (or .env.local for local dev).",
    );
  }
  let credentials;
  try {
    credentials = JSON.parse(raw);
  } catch {
    throw new Error("FIREBASE_ADMIN_KEY is not valid JSON.");
  }
  cachedApp = initializeApp({ credential: cert(credentials) });
  return cachedApp;
}

export function getAdminAuth(): Auth {
  return getAuth(getAdminApp());
}

export function getAdminFirestore(): Firestore {
  return getFirestore(getAdminApp());
}
