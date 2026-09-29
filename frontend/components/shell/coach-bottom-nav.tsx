"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api/client";
import { coachNavSections, isActivePath, type CoachNavSection } from "@/lib/nav-config";
import type { AuthUser } from "@/types/auth";

const primaryKeys = new Set(["dashboard", "clients", "updates", "messages"]);

function visibleSections(user: AuthUser | null): CoachNavSection[] {
  const isAdmin = user?.role === "admin";
  const canSeeCoachSettings = isAdmin || user?.role === "coach";
  const canUseMessages = isAdmin || user?.role === "coach" || Boolean(user?.permissions?.includes("messages"));
  const canSendAnnouncements = isAdmin || Boolean(user?.permissions?.includes("send_announcements"));

  return coachNavSections
    .filter((section) =>
      (!section.coachOrAdminOnly || canSeeCoachSettings || (section.key === "management" && canSendAnnouncements)) &&
      (!section.adminOnly || isAdmin) &&
      (section.key !== "messages" || canUseMessages),
    )
    .flatMap((section) => {
      if (!section.children) return [section];
      if (!canSeeCoachSettings && !(section.key === "management" && canSendAnnouncements)) return [];
      return section.children
        .filter((child) => !child.adminOnly || isAdmin || (child.key === "manual-notifications" && canSendAnnouncements))
        .map((child) => ({ ...child, path: child.path, key: child.key }));
    })
    .filter((item) => Boolean(item.path));
}

export function CoachBottomNav({ user }: { user: AuthUser | null }) {
  const pathname = usePathname();
  const [unreadUpdates, setUnreadUpdates] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const items = useMemo(() => visibleSections(user), [user]);
  const primaryItems = items.filter((item) => primaryKeys.has(item.key)).slice(0, 4);
  const moreItems = items.filter((item) => !primaryItems.some((primary) => primary.key === item.key));
  const moreActive = moreItems.some((item) => isActivePath(pathname, item.path));

  useEffect(() => {
    const loadUpdates = () => api.get<{ totalUnread: number }>("/updates/stats").then((data) => setUnreadUpdates(Number(data.totalUnread || 0))).catch(() => {});
    void loadUpdates();
    const interval = window.setInterval(loadUpdates, 15000);
    window.addEventListener("coach-updates-read", loadUpdates);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("coach-updates-read", loadUpdates);
    };
  }, []);

  useEffect(() => {
    const canUseMessages = user?.role === "admin" || user?.role === "coach" || Boolean(user?.permissions?.includes("messages"));
    if (!canUseMessages) {
      setUnreadMessages(0);
      return;
    }
    const loadMessages = () => api.get<Array<{ unread_count?: number }>>("/clients/messages/inbox").then((rows) => setUnreadMessages(rows.reduce((sum, row) => sum + Number(row.unread_count || 0), 0))).catch(() => {});
    void loadMessages();
    const interval = window.setInterval(loadMessages, 15000);
    return () => window.clearInterval(interval);
  }, [user?.permissions, user?.role]);

  const unreadFor = (key: string) => key === "updates" ? unreadUpdates : key === "messages" ? unreadMessages : 0;

  return (
    <nav aria-label="Κύρια πλοήγηση" className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] supports-backdrop-filter:backdrop-blur lg:hidden">
      <div className={cn("mx-auto grid max-w-xl gap-1", primaryItems.length >= 4 ? "grid-cols-5" : primaryItems.length === 3 ? "grid-cols-4" : "grid-cols-3")}>
        {primaryItems.map((item) => <BottomItem key={item.key} item={item} active={isActivePath(pathname, item.path)} unread={unreadFor(item.key)} />)}
        <Sheet>
          <SheetTrigger render={<button type="button" className={cn("relative flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg px-1 text-[11px] font-medium transition-colors", moreActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground")} />}>
            <Menu className="h-5 w-5" />
            <span>Περισσότερα</span>
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-[80dvh] rounded-t-2xl p-0" showCloseButton>
            <SheetHeader className="border-b px-5 pb-4 pt-5 text-left">
              <SheetTitle>Περισσότερα</SheetTitle>
              <SheetDescription>Εργαλεία και ρυθμίσεις λογαριασμού.</SheetDescription>
            </SheetHeader>
            <div className="grid gap-1 overflow-y-auto p-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
              {moreItems.map((item) => <MoreItem key={item.key} item={item} active={isActivePath(pathname, item.path)} unread={unreadFor(item.key)} />)}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}

function BottomItem({ item, active, unread }: { item: { key: string; label: string; path?: string; icon?: CoachNavSection["icon"] }; active: boolean; unread: number }) {
  const Icon = item.icon;
  return (
    <Link href={item.path || "#"} className={cn("relative flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg px-1 text-[11px] font-medium transition-colors", active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
      {Icon && <Icon className="h-5 w-5" />}
      <span className="max-w-full truncate">{item.label}</span>
      {unread > 0 && <Badge className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full p-0 text-[9px]">{unread > 9 ? "9+" : unread}</Badge>}
    </Link>
  );
}

function MoreItem({ item, active, unread }: { item: { key: string; label: string; path?: string; icon?: CoachNavSection["icon"] }; active: boolean; unread: number }) {
  const Icon = item.icon;
  return (
    <Link href={item.path || "#"} className={cn("relative flex min-h-12 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors", active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
      {Icon && <Icon className="h-5 w-5" />}
      <span className="flex-1">{item.label}</span>
      {unread > 0 && <Badge className="rounded-full px-1.5 text-[10px]">{unread > 99 ? "99+" : unread}</Badge>}
    </Link>
  );
}
