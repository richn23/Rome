import type { User } from "firebase/auth";
import { Timestamp } from "firebase/firestore";
import type { UserProfile, UserRole } from "@/types";

const DEV_UID = "dev-bypass-user";

/** Enable only when running `next dev` and NEXT_PUBLIC_DEV_AUTH_BYPASS=true in .env.local */
export function isDevAuthBypassEnabled(): boolean {
  return (
    process.env.NODE_ENV === "development" &&
    process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS === "true"
  );
}

function parseDevRole(raw: string | undefined): UserRole {
  if (raw === "speaker" || raw === "learner" || raw === "admin") return raw;
  return "learner";
}

export function getDevBypassRole(): UserRole {
  return parseDevRole(process.env.NEXT_PUBLIC_DEV_AUTH_ROLE);
}

export function getDevBypassUser(): User {
  return {
    uid: DEV_UID,
    email: "dev@localhost.local",
    emailVerified: true,
    displayName: "Dev User",
    isAnonymous: false,
    metadata: {} as User["metadata"],
    providerData: [],
    refreshToken: "",
    tenantId: null,
    delete: async () => {},
    getIdToken: async () => "dev-token",
    getIdTokenResult: async () => ({}) as Awaited<ReturnType<User["getIdTokenResult"]>>,
    reload: async () => {},
    toJSON: () => ({}),
    phoneNumber: null,
    photoURL: null,
    providerId: "password",
  } as User;
}

export function getDevBypassProfile(role: UserRole): UserProfile {
  const base: UserProfile = {
    uid: DEV_UID,
    role,
    displayName: "Dev User",
    email: "dev@localhost.local",
    photoURL: "",
    createdAt: Timestamp.now(),
  };

  if (role === "learner") {
    return { ...base, level: "2a" };
  }

  if (role === "speaker") {
    return {
      ...base,
      status: "offline",
      hourlyRate: 15,
      rating: 0,
      totalSessions: 0,
    };
  }

  return base;
}
