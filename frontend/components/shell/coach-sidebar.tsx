"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useBranding } from "@/contexts/BrandingContext";
import { resolveMediaUrl } from "@/lib/media";
import { SidebarUserMenu } from "@/components/shell/sidebar-user-menu";
import { coachNavSections, isActivePath } from "@/lib/nav-config";
import type { AuthUser } from "@/types/auth";

interface CoachSidebarProps {
  user: AuthUser | null;
  logout: () => Promise<void>;
  collapsed: boolean;
  onToggle: () => void;
}

export function CoachSidebar({ user, logout, collapsed, onToggle }: CoachSidebarProps) {
  const pathname = usePathname();
  const { branding } = useBranding();
  const canSeeCoachSettings = user?.role === "admin" || user?.role === "coach";
  const isAdmin = user?.role === "admin";
  // Each expandable section (Ρυθμίσεις, Πρότυπα Πλάνων, ...) tracks its own open state,
  // starting open if the current route is one of its children.
  const [openSections, setOpenSections] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    for (const section of coachNavSections) {
      if (section.children?.some((child) => isActivePath(pathname, child.path))) {
        initial.add(section.key);
      }
    }
    return initial;
  });
  const toggleSection = (key: string) => {
    setOpenSections((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 flex flex-col bg-[#07131d] text-white transition-[width] duration-200",
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
        {coachNavSections
          .filter((section) => (!section.coachOrAdminOnly || canSeeCoachSettings) && (!section.adminOnly || isAdmin))
          .map((section) => {
            const active = isActivePath(pathname, section.path);
            const Icon = section.icon;

            if (section.children) {
              if (!canSeeCoachSettings) return null;
              const isOpen = openSections.has(section.key);
              return (
                <div key={section.key} className={section.spacerBefore ? "mt-4" : ""}>
                  <button
                    type="button"
                    onClick={() => toggleSection(section.key)}
                    title={collapsed ? section.label : undefined}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-slate-100 transition-colors hover:bg-white/10",
                      collapsed && "justify-center px-0",
                    )}
                  >
                    {Icon && <Icon className="size-4 shrink-0" />}
                    {!collapsed && <span className="flex-1 truncate text-left">{section.label}</span>}
                    {!collapsed && (
                      <ChevronDown className={cn("size-4 shrink-0 transition-transform", isOpen && "rotate-180")} />
                    )}
                  </button>
                  {!collapsed && isOpen && (
                    <div className="ml-4 mt-1 flex flex-col gap-1 border-l border-white/10 pl-3">
                      {section.children.map((child) =>
                        child.path ? (
                          <Link
                            key={child.key}
                            href={child.path}
                            className={cn(
                              "rounded-md px-3 py-1.5 text-sm text-slate-300 hover:bg-white/10 hover:text-white",
                              isActivePath(pathname, child.path) && "bg-white/10 text-white",
                            )}
                          >
                            {child.label}
                          </Link>
                        ) : (
                          <span key={child.key} className="rounded-md px-3 py-1.5 text-sm text-slate-400">
                            {child.label}
                          </span>
                        ),
                      )}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <Link
                key={section.key}
                href={section.path || "#"}
                title={collapsed ? section.label : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  section.spacerBefore && "mt-4",
                  collapsed && "justify-center px-0",
                  active ? "bg-red-600 text-white" : "text-slate-100 hover:bg-white/10",
                )}
              >
                {Icon && <Icon className="size-4 shrink-0" />}
                {!collapsed && <span className="truncate">{section.label}</span>}
              </Link>
            );
          })}
      </nav>

      <div className="border-t border-white/10 p-3">
        <SidebarUserMenu
          user={user}
          logout={logout}
          profileHref="/coach-profile"
          notificationsHref="/notifications"
          collapsed={collapsed}
        />
      </div>
    </aside>
  );
}
