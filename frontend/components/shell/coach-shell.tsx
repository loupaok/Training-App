"use client";

import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { CoachSidebar } from "@/components/shell/coach-sidebar";
import { CoachBottomNav } from "@/components/shell/coach-bottom-nav";
import { AppHeader } from "@/components/shell/app-header";
import type { AuthUser } from "@/types/auth";

const STORAGE_KEY = "coach-sidebar-collapsed";

export function CoachShell({
  title,
  user,
  logout,
  children,
}: {
  title: string;
  user: AuthUser | null;
  logout: () => Promise<void>;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);

  // Read the persisted preference after mount — reading localStorage during the initial render
  // would mismatch the server-rendered HTML (which always starts expanded).
  useEffect(() => {
    Promise.resolve().then(() => {
      if (window.localStorage.getItem(STORAGE_KEY) === "true") setCollapsed(true);
    });
  }, []);

  function toggle() {
    setCollapsed((previous) => {
      const next = !previous;
      window.localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  }

  return (
    <div className="flex min-h-screen">
      <CoachSidebar user={user} logout={logout} collapsed={collapsed} onToggle={toggle} />
      <div className={cn("flex min-w-0 flex-1 flex-col transition-[padding] duration-200 lg:pl-56", collapsed && "lg:pl-16")}>
        <AppHeader title={title} user={user} logout={logout} />
        <main className="min-w-0 flex-1 bg-muted/30 p-4 pb-28 sm:p-6 sm:pb-28 lg:p-6">{children}</main>
      </div>
      <CoachBottomNav user={user} />
    </div>
  );
}
