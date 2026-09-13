"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getAuthRedirect, useAuth } from "@/lib/auth/auth-context";

export type ProtectedRouteAllow = "coach" | "client-active" | "client-pending" | "client-expired";

function LoadingScreen() {
  return (
    <div className="grid min-h-screen place-items-center bg-slate-50 text-sm font-bold text-slate-500">
      Φόρτωση...
    </div>
  );
}

export function ProtectedRoute({ children, allow }: { children: ReactNode; allow?: ProtectedRouteAllow }) {
  const { user, authReady } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const needsOnboarding = user?.role === "client" && !user?.onboardingCompleted;
  const redirectTo = (() => {
    if (!authReady) return null;
    if (!user) return "/login";
    if (needsOnboarding && pathname !== "/client-onboarding") return "/client-onboarding";
    if (user.role === "client" && user.onboardingCompleted && pathname === "/client-onboarding") {
      return getAuthRedirect(user);
    }
    if (allow === "coach" && !["coach", "admin"].includes(user.role)) return getAuthRedirect(user);
    if (allow === "client-active" && user.role === "client" && user.status !== "active") return getAuthRedirect(user);
    if (allow === "client-pending" && !(user.role === "client" && user.status === "pending_payment")) {
      return getAuthRedirect(user);
    }
    if (allow === "client-expired" && !(user.role === "client" && user.status === "expired")) {
      return getAuthRedirect(user);
    }
    return null;
  })();

  useEffect(() => {
    if (redirectTo) router.replace(redirectTo);
  }, [redirectTo, router]);

  if (!authReady || !user || redirectTo) return <LoadingScreen />;

  return <>{children}</>;
}

export function HomeRedirect() {
  const { user, authReady } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (authReady) router.replace(getAuthRedirect(user));
  }, [authReady, user, router]);

  return <LoadingScreen />;
}
