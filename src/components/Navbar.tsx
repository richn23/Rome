"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";

export default function Navbar() {
  const { userProfile, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    toast.success("Logged out");
    router.push("/login");
  };

  const profileHref =
    userProfile?.role === "learner"
      ? "/dashboard/learner/profile"
      : userProfile?.role === "speaker"
      ? "/dashboard/speaker/profile"
      : "/dashboard/admin";

  return (
    <nav className="flex items-center justify-between border-b border-teal-100 bg-white px-6 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="flex items-center gap-3">
        <Link href={userProfile ? `/dashboard/${userProfile.role}` : "/"}>
          <h1 className="text-xl font-bold text-teal-700 hover:text-teal-800 dark:text-teal-400 dark:hover:text-teal-300">
            SpeakSpace
          </h1>
        </Link>
        {userProfile && (
          <span className="rounded-full bg-teal-100 px-3 py-1 text-xs font-medium text-teal-700 capitalize dark:bg-teal-900/40 dark:text-teal-300">
            {userProfile.role}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={toggleTheme}
          aria-label="Toggle dark mode"
          title={theme === "dark" ? "Switch to light" : "Switch to dark"}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
        >
          {theme === "dark" ? (
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v2m0 14v2m9-9h-2M5 12H3m15.364-6.364l-1.414 1.414M6.05 17.95l-1.414 1.414m0-13.728l1.414 1.414M17.95 17.95l1.414 1.414M12 7a5 5 0 100 10 5 5 0 000-10z"/>
            </svg>
          ) : (
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/>
            </svg>
          )}
        </button>
        {userProfile && (
          <Link
            href={profileHref}
            className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {userProfile.photoURL ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={userProfile.photoURL}
                alt=""
                className="h-7 w-7 rounded-full object-cover"
              />
            ) : (
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-teal-400 to-cyan-500 text-xs font-bold text-white">
                {userProfile.displayName?.charAt(0).toUpperCase() || "?"}
              </span>
            )}
            <span className="hidden sm:inline">{userProfile.displayName}</span>
          </Link>
        )}
        <button
          onClick={handleLogout}
          className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-100 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          Log out
        </button>
      </div>
    </nav>
  );
}
