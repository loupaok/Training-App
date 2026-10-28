"use client";

import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ClientSidebar } from "@/components/shell/client-sidebar";
import { ClientBottomNav } from "@/components/shell/client-bottom-nav";
import { AppHeader } from "@/components/shell/app-header";
import { api } from "@/lib/api/client";
import type { AuthUser } from "@/types/auth";
import { Clock3 } from "lucide-react";

const STORAGE_KEY = "client-sidebar-collapsed";

export function ClientShell({
  title = "Αρχική",
  user,
  logout,
  paymentApproved,
  subscriptionStatus,
  daysRemaining,
  unreadNotifications,
  children,
}: {
  title?: string;
  user: AuthUser | null;
  logout: () => Promise<void>;
  paymentApproved: boolean;
  subscriptionStatus?: string | null;
  daysRemaining?: number | null;
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
        subscriptionStatus={subscriptionStatus}
        daysRemaining={daysRemaining}
        unreadNotifications={unreadNotifications}
        unreadMessages={unreadMessages}
        collapsed={collapsed}
        onToggle={toggle}
      />
      <div className={cn("flex min-w-0 flex-1 flex-col transition-[padding] duration-200", collapsed ? "lg:pl-16" : "lg:pl-[248px]")}>
        <AppHeader title={title} user={user} logout={logout} />
        <main data-client-page-content className="min-w-0 flex-1 bg-background p-4 pb-28 sm:p-6 sm:pb-28 lg:p-7">{children}</main>
      </div>
      <ClientBottomNav paymentApproved={paymentApproved} unreadNotifications={unreadNotifications} unreadMessages={unreadMessages} />
      <ClientActiveClock />
    </div>
  );
}

function ClientActiveClock() {
  const [clock, setClock] = useState<{ mode: "timer" | "stopwatch"; running: boolean; duration: number; startedAt: number; elapsedBeforeStart: number } | null>(null);
  const [now, setNow] = useState(0);

  useEffect(() => {
    const load = () => {
      try { setClock(JSON.parse(window.localStorage.getItem("sp-workout-manual-clock") || "null")); } catch { setClock(null); }
    };
    load();
    const id = window.setInterval(() => { load(); setNow(Date.now()); }, 250);
    return () => window.clearInterval(id);
  }, []);

  if (!clock?.running) return null;
  const elapsed = clock.elapsedBeforeStart + Math.max(0, now - clock.startedAt);
  const seconds = clock.mode === "timer" ? Math.max(0, clock.duration - Math.floor(elapsed / 1000)) : Math.floor(elapsed / 1000);
  const display = clock.mode === "timer"
    ? `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`
    : `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}:${String(Math.floor((elapsed % 1000) / 10)).padStart(2, "0")}`;
  return <button type="button" onClick={() => { window.location.assign("/client-program?clock=1"); }} className="fixed bottom-[92px] right-[14px] z-40 flex h-14 items-center gap-2 rounded-full bg-[var(--sp-emphasis)] px-3 pr-4 text-[var(--sp-emphasis-foreground)] shadow-xl transition-transform active:scale-95 dark:border dark:border-border" aria-label="Άνοιγμα ενεργού χρονομέτρου"><span className="grid h-10 w-10 place-items-center rounded-full border-2 border-accent text-accent"><Clock3 className="h-4 w-4" /></span><span><span className="block text-[10px] font-bold uppercase tracking-[.8px] text-muted-foreground">{clock.mode === "timer" ? "Αντίστροφη" : "Χρονόμετρο"}</span><span className="block font-mono text-[16px] font-extrabold italic text-accent">{display}</span></span></button>;
}
