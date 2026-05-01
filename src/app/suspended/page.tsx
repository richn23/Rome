"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";

export default function SuspendedPage() {
  const { userProfile, logout } = useAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    await logout();
    router.replace("/login");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 shadow-sm">
        <div className="mb-4 inline-flex rounded-full bg-red-100 dark:bg-red-900/30 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-red-700 dark:text-red-300">
          Account suspended
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          Your account has been suspended.
        </h1>
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
          {userProfile?.displayName ? `Hi ${userProfile.displayName}, ` : ""}
          access to SpeakSpace has been paused for your account. If you believe this
          is a mistake, please contact support.
        </p>
        <button
          onClick={handleSignOut}
          className="mt-6 w-full rounded-lg bg-slate-900 dark:bg-slate-100 px-4 py-2 text-sm font-semibold text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
