"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

export default function Navbar() {
  const { userProfile, logout } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    toast.success("Logged out");
    router.push("/login");
  };

  return (
    <nav className="flex items-center justify-between border-b border-teal-100 bg-white px-6 py-3 shadow-sm">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-bold text-teal-700">SpeakSpace</h1>
        {userProfile && (
          <span className="rounded-full bg-teal-100 px-3 py-1 text-xs font-medium text-teal-700 capitalize">
            {userProfile.role}
          </span>
        )}
      </div>
      <div className="flex items-center gap-4">
        {userProfile && (
          <span className="text-sm text-gray-600">{userProfile.displayName}</span>
        )}
        <button
          onClick={handleLogout}
          className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-100"
        >
          Log out
        </button>
      </div>
    </nav>
  );
}
