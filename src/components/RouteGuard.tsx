"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { UserRole } from "@/types";

interface RouteGuardProps {
  allowedRole: UserRole | UserRole[];
  children: React.ReactNode;
}

function isAllowed(role: UserRole, allowed: UserRole | UserRole[]): boolean {
  return Array.isArray(allowed) ? allowed.includes(role) : role === allowed;
}

export default function RouteGuard({ allowedRole, children }: RouteGuardProps) {
  const { user, userProfile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (userProfile && !isAllowed(userProfile.role, allowedRole)) {
      router.replace(`/dashboard/${userProfile.role}`);
    }
  }, [user, userProfile, loading, allowedRole, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-teal-600 text-lg">Loading...</div>
      </div>
    );
  }

  if (!user || !userProfile || !isAllowed(userProfile.role, allowedRole)) {
    return null;
  }

  return <>{children}</>;
}
