"use client";

import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ClientSidebar } from "@/components/shell/client-sidebar";
import { ClientBottomNav } from "@/components/shell/client-bottom-nav";
import { AppHeader } from "@/components/shell/app-header";
import { api } from "@/lib/api/client";
import type { AuthUser } from "@/types/auth";

const STORAGE_KEY = "client-sidebar-collapsed";

export function ClientShell({
  title = "Αρχική",
  user,
  logout,
  paymentApproved,
  unreadNotifications,
  children,
}: {
  title?: string;
  user: AuthUser | null;
  logout: () => Promise<void>;
  paymentApproved: boolean;
  unreadNotifications?: number;
  active?: string;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);

  useEffect(() => {
    Promise.resolve().then(() => {
      if (window.localStorage.getItem(STORAGE_KEY) === "true") setCollapsed(true);
    });
  }, []);

  useEffect(() => {
    if (user?.role !== "client") return;
    const loadUnreadMessages = () => api
      .get<{ unread?: number }>("/clients/me/messages/unread-count")
      .then((data) => setUnreadMessages(Number(data.unread || 0)))
      .catch(() => setUnreadMessages(0));
    void loadUnreadMessages();
    const interval = window.setInterval(() => void loadUnreadMessages(), 10000);
    return () => window.clearInterval(interval);
  }, [user?.id, user?.role]);

  function toggle() {
    setCollapsed((previous) => {
      const next = !previous;
      window.localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  }

  return (
    <div className="flex min-h-[100dvh]">
      <ClientSidebar
        user={user}
        logout={logout}
        paymentApproved={paymentApproved}
        unreadNotifications={unreadNotifications}
        unreadMessages={unreadMessages}
        collapsed={collapsed}
        onToggle={toggle}
      />
      <div className={cn("flex min-w-0 flex-1 flex-col transition-[padding] duration-200", collapsed ? "lg:pl-16" : "lg:pl-56")}>
        <AppHeader title={title} user={user} logout={logout} />
        <main className="min-w-0 flex-1 bg-muted/30 p-4 pb-28 sm:p-6 sm:pb-28 lg:p-6">{children}</main>
      </div>
      <ClientBottomNav paymentApproved={paymentApproved} unreadNotifications={unreadNotifications} unreadMessages={unreadMessages} />
    </div>
  );
}
