import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminAuth, getAdminFirestore } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";

/**
 * POST /api/admin/users
 *
 * Admin-only endpoint to create a new user. Verifies the caller's Firebase
 * ID token, confirms `users/{uid}.role === "admin"`, then provisions the
 * account via the Admin SDK and writes the matching Firestore profile doc.
 *
 * Returns a one-time password-reset link the admin can hand to the new user.
 */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Missing auth token" }, { status: 401 });
    }
    const idToken = authHeader.slice("Bearer ".length);

    let adminAuth, adminDb;
    try {
      adminAuth = getAdminAuth();
      adminDb = getAdminFirestore();
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Admin SDK init failed" },
        { status: 500 },
      );
    }

    let decoded;
    try {
      decoded = await adminAuth.verifyIdToken(idToken);
    } catch {
      return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
    }

    const callerSnap = await adminDb.collection("users").doc(decoded.uid).get();
    if (!callerSnap.exists || callerSnap.data()?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden — admin only" }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const { email, displayName, role, level } = body as {
      email?: string;
      displayName?: string;
      role?: string;
      level?: string;
    };

    if (!email?.trim() || !displayName?.trim() || !role) {
      return NextResponse.json(
        { error: "email, displayName, and role are required" },
        { status: 400 },
      );
    }
    if (!["learner", "speaker", "admin"].includes(role)) {
      return NextResponse.json({ error: "role must be learner, speaker, or admin" }, { status: 400 });
    }

    // Random temporary password — the new user will reset it via the link below.
    const tempPassword = randomBytes(16).toString("hex");

    let userRecord;
    try {
      userRecord = await adminAuth.createUser({
        email: email.trim(),
        password: tempPassword,
        displayName: displayName.trim(),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create user";
      const code = (err as { code?: string }).code;
      const status = code === "auth/email-already-exists" ? 409 : 500;
      return NextResponse.json({ error: message, code }, { status });
    }

    type UserDoc = {
      uid: string;
      email: string;
      displayName: string;
      role: string;
      photoURL: string;
      level?: string;
      createdAt: FieldValue;
    };
    const userDoc: UserDoc = {
      uid: userRecord.uid,
      email: email.trim(),
      displayName: displayName.trim(),
      role,
      photoURL: "",
      createdAt: FieldValue.serverTimestamp(),
    };
    if (role === "learner" && typeof level === "string" && level.trim()) {
      userDoc.level = level.trim();
    }
    await adminDb.collection("users").doc(userRecord.uid).set(userDoc);

    let resetLink: string | null = null;
    try {
      resetLink = await adminAuth.generatePasswordResetLink(email.trim());
    } catch {
      // Non-fatal — the user can still log in with the temp password if absolutely needed,
      // or the admin can trigger a reset later from the Firebase console.
    }

    return NextResponse.json({
      uid: userRecord.uid,
      email: email.trim(),
      displayName: displayName.trim(),
      role,
      level: userDoc.level ?? null,
      resetLink,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error" },
      { status: 500 },
    );
  }
}
