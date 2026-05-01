"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Avatar from "@/components/Avatar";
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
    <nav className="flex items-center justify-between gap-2 border-b border-slate-200 bg-white/80 px-4 py-3 shadow-sm backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/80 sm:px-6">
      {/* Left cluster — mark, wordmark (sm+ only so it doesn't clip on mobile), role pill */}
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <Link
          href={userProfile ? `/dashboard/${userProfile.role}` : "/"}
          className="group flex shrink-0 items-center gap-2"
        >
          {/* Brand mark — plain <img> (SVG, no Next.js Image optimization needed). */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-mark.svg"
            alt="SpeakSpace"
            width={32}
            height={32}
            className="h-8 w-8 transition group-hover:opacity-90"
          />
          {/* Wordmark hidden at mobile widths — the mark alone carries the brand
              and we reclaim the space for the role pill + Log out. */}
          <h1 className="hidden text-lg font-bold tracking-tight text-slate-900 sm:block dark:text-white">
            SpeakSpace
          </h1>
        </Link>
        {userProfile && (
          <span className="shrink-0 rounded-full bg-teal-100 px-2.5 py-1 text-xs font-medium capitalize text-teal-700 dark:bg-teal-900/40 dark:text-teal-300 sm:px-3">
            {userProfile.role}
          </span>
        )}
      </div>

      {/* Right cluster — theme toggle, avatar, Log out */}
      <div className="flex shrink-0 items-center gap-1 sm:gap-2">
        <button
          onClick={toggleTheme}
          aria-label="Toggle dark mode"
          title={theme === "dark" ? "Switch to light" : "Switch to dark"}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
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
            className="flex shrink-0 items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-slate-700 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 sm:px-3"
          >
            <Avatar
              photoURL={userProfile.photoURL}
              displayName={userProfile.displayName}
              className="h-7 w-7 rounded-full"
              textClassName="text-xs"
            />
            <span className="hidden sm:inline">{userProfile.displayName}</span>
          </Link>
        )}
        <Link
          href="/policies"
          className="hidden shrink-0 whitespace-nowrap rounded-lg px-2 py-2 text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200 sm:inline-block"
        >
          Policies
        </Link>
        <button
          onClick={handleLogout}
          className="shrink-0 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 sm:px-4"
        >
          Log out
        </button>
      </div>
    </nav>
  );
}
