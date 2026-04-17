"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { UserRole } from "@/types";

interface RouteGuardProps {
  allowedRole: UserRole;
  children: React.ReactNode;
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
    if (userProfile && userProfile.role !== allowedRole) {
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

  if (!user || !userProfile || userProfile.role !== allowedRole) {
    return null;
  }

  return <>{children}</>;
}
