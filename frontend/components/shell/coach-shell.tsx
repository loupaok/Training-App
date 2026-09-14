"use client";

import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { CoachSidebar } from "@/components/shell/coach-sidebar";
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
      <div className={cn("flex flex-1 flex-col transition-[padding] duration-200", collapsed ? "pl-16" : "pl-56")}>
        <AppHeader title={title} user={user} logout={logout} />
        <main className="flex-1 bg-muted/30 p-6">{children}</main>
      </div>
    </div>
  );
}
