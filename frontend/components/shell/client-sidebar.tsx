"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SidebarUserMenu } from "@/components/shell/sidebar-user-menu";
import { clientNavSections, isActivePath } from "@/lib/nav-config";
import type { AuthUser } from "@/types/auth";

interface ClientSidebarProps {
  user: AuthUser | null;
  logout: () => Promise<void>;
  paymentApproved: boolean;
  unreadNotifications?: number;
  unreadMessages?: number;
  collapsed: boolean;
  onToggle: () => void;
}

export function ClientSidebar({
  user,
  logout,
  paymentApproved,
  unreadNotifications = 0,
  unreadMessages = 0,
  collapsed,
  onToggle,
}: ClientSidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 hidden flex-col bg-[var(--sp-black)] text-white transition-[width] duration-200 lg:flex",
        collapsed ? "w-16" : "w-[248px]",
      )}
    >
      <div className={cn("flex h-16 items-center border-b border-white/10", collapsed ? "justify-center px-2" : "justify-between px-4")}>
        {!collapsed && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src="/brand/sp-team-logo-white.svg" alt="SP Team" className="h-7 w-auto max-w-32 object-contain" />
        )}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onToggle}
          className="text-white hover:bg-white/10 hover:text-white"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
        </Button>
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4">
        {clientNavSections.map((section) => {
          const isLocked = Boolean(section.locked && !paymentApproved);
          const active = isActivePath(pathname, section.path);
          const Icon = section.icon;

          const className = cn(
            "flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors",
            section.spacerBefore && "mt-4",
            collapsed && "justify-center px-0",
            isLocked ? "cursor-not-allowed text-[#6a6a6a] opacity-45 blur-[1px]" : active ? "bg-accent text-accent-foreground" : "text-[#c8c8c8] hover:bg-[var(--sp-black-2)] hover:text-white",
          );

          return (
            <div key={section.key} className="relative">
              {section.path && !isLocked ? (
                <Link href={section.path} title={collapsed ? section.label : undefined} className={className}>
                  {Icon && <Icon className="size-4 shrink-0" />}
                  {!collapsed && <span className="truncate">{section.label}</span>}
                </Link>
              ) : (
                <span title={collapsed ? section.label : undefined} className={className}>
                  {Icon && <Icon className="size-4 shrink-0" />}
                  {!collapsed && <span className="truncate">{section.label}</span>}
                </span>
              )}
              {!collapsed && section.key === "notifications" && unreadNotifications > 0 && (
                <Badge className="absolute right-2 top-1/2 -translate-y-1/2 bg-accent text-accent-foreground">{unreadNotifications}</Badge>
              )}
              {!collapsed && section.key === "messages" && unreadMessages > 0 && (
                <Badge className="absolute right-2 top-1/2 -translate-y-1/2 bg-accent text-accent-foreground">{unreadMessages}</Badge>
              )}
              {!collapsed && isLocked && (
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">Κλειδωμένο</span>
              )}
            </div>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-3">
        <SidebarUserMenu
          user={user}
          logout={logout}
          profileHref="/client-profile"
          notificationsHref="/client-notifications"
          collapsed={collapsed}
        />
      </div>
    </aside>
  );
}
