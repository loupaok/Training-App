"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api } from "@/lib/api/client";
import { buildClientNotifications, type ClientNotificationsResponse } from "@/lib/client-notifications";
import { getUnreadNotificationCount, clearUnreadNotifications, loadUnreadNotificationCount } from "@/lib/notification-count";
import type { AuthUser } from "@/types/auth";

interface AdminNotificationItem {
  id: number | string;
  title?: string;
  body?: string;
  client_id?: number | string;
  created_at?: string;
}

interface MenuRow {
  id: string;
  title: string;
  body: string;
  href: string | null;
}

function formatRelative(value?: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return "τώρα";
  if (minutes < 60) return `${minutes}λ`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}ω`;
  const days = Math.round(hours / 24);
  return `${days}η`;
}

export function NotificationsMenu({ user }: { user: AuthUser | null }) {
  const isClient = user?.role === "client";
  const notificationsPath = isClient ? "/client-notifications" : "/notifications";
  const pathname = usePathname();

  const [unreadCount, setUnreadCount] = useState(() => getUnreadNotificationCount());
  const [rows, setRows] = useState<MenuRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const updateCount = () => {
      loadUnreadNotificationCount()
        .then(setUnreadCount)
        .catch(() => setUnreadCount(getUnreadNotificationCount()));
    };
    const clearCount = () => setUnreadCount(0);
    updateCount();
    window.addEventListener("storage", updateCount);
    window.addEventListener("coach-notifications-read", clearCount);
    return () => {
      window.removeEventListener("storage", updateCount);
      window.removeEventListener("coach-notifications-read", clearCount);
    };
  }, []);

  useEffect(() => {
    if (pathname === notificationsPath) clearUnreadNotifications();
  }, [pathname, notificationsPath]);

  function loadRows() {
    setLoading(true);
    const request = isClient
      ? api.get<ClientNotificationsResponse>("/clients/me/notifications").then((data) =>
          buildClientNotifications(data)
            .slice(0, 6)
            .map((item) => ({ id: item.id, title: item.title, body: item.body, href: item.href })),
        )
      : api.get<AdminNotificationItem[]>("/clients/admin/notifications").then((items) =>
          (Array.isArray(items) ? items : []).slice(0, 6).map((item) => ({
            id: String(item.id),
            title: item.title || "Νέα ειδοποίηση",
            body: item.created_at ? formatRelative(item.created_at) : "",
            href: item.client_id ? `/clients/${item.client_id}` : null,
          })),
        );

    request.then(setRows).catch(() => setRows([])).finally(() => setLoading(false));
  }

  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (open) {
          loadRows();
          clearUnreadNotifications();
        }
      }}
    >
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="icon-sm" className="relative" aria-label="Notifications">
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <Badge className="absolute -right-1 -top-1 h-5 min-w-5 justify-center rounded-full px-1.5 text-[11px]">
                {unreadCount}
              </Badge>
            )}
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>Ειδοποιήσεις</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {loading ? (
          <p className="px-2 py-4 text-center text-sm text-muted-foreground">Φόρτωση...</p>
        ) : rows.length === 0 ? (
          <p className="px-2 py-4 text-center text-sm text-muted-foreground">Δεν υπάρχουν ειδοποιήσεις</p>
        ) : (
          <div className="flex max-h-80 flex-col overflow-y-auto">
            {rows.map((row) =>
              row.href ? (
                <Link
                  key={row.id}
                  href={row.href}
                  className="flex flex-col gap-0.5 border-b px-3 py-2.5 text-left text-sm last:border-b-0 hover:bg-accent"
                >
                  <span className="font-medium">{row.title}</span>
                  {row.body && <span className="text-xs text-muted-foreground">{row.body}</span>}
                </Link>
              ) : (
                <div key={row.id} className="flex flex-col gap-0.5 border-b px-3 py-2.5 text-left text-sm last:border-b-0">
                  <span className="font-medium">{row.title}</span>
                  {row.body && <span className="text-xs text-muted-foreground">{row.body}</span>}
                </div>
              ),
            )}
          </div>
        )}
        <DropdownMenuSeparator />
        <Link href={notificationsPath} className="block px-2 py-2 text-center text-sm font-medium text-primary hover:underline">
          Δες όλες
        </Link>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
