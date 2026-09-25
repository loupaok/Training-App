"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useBranding } from "@/contexts/BrandingContext";
import { resolveMediaUrl } from "@/lib/media";
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
  const { branding } = useBranding();

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 hidden flex-col bg-[#07131d] text-white transition-[width] duration-200 lg:flex",
        collapsed ? "w-16" : "w-56",
      )}
    >
      <div className={cn("flex h-16 items-center border-b border-white/10", collapsed ? "justify-center px-2" : "justify-between px-4")}>
        {!collapsed &&
          (branding.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={resolveMediaUrl(branding.logoUrl)} alt={branding.appName} className="h-8 max-w-32 object-contain" />
          ) : (
            <span className="truncate text-base font-semibold">{branding.appName}</span>
          ))}
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

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
        {clientNavSections.map((section) => {
          const isLocked = Boolean(section.locked && !paymentApproved);
          const active = isActivePath(pathname, section.path);
          const Icon = section.icon;

          const className = cn(
            "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
            section.spacerBefore && "mt-4",
            collapsed && "justify-center px-0",
            isLocked ? "cursor-not-allowed text-slate-500 opacity-45 blur-[1px]" : active ? "bg-red-600 text-white" : "text-slate-100 hover:bg-white/10",
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
                <Badge className="absolute right-2 top-1/2 -translate-y-1/2 bg-red-600 text-white">{unreadNotifications}</Badge>
              )}
              {!collapsed && section.key === "messages" && unreadMessages > 0 && (
                <Badge className="absolute right-2 top-1/2 -translate-y-1/2 bg-red-600 text-white">{unreadMessages}</Badge>
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
