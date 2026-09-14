"use client";

import { useState, type ReactNode, type CSSProperties } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { UserAvatar } from "@/components/shared/user-avatar";
import { MenuToggle, TopbarActions } from "@/components/shell/topbar-controls";
import { ThemeColorPicker } from "@/components/shell/theme-color-picker";
import { coachNavSections, isActivePath } from "@/lib/nav-config";
import { getInitials } from "@/lib/media";
import type { AuthUser } from "@/types/auth";

function CoachSidebar({ user }: { user: AuthUser | null }) {
  const pathname = usePathname();
  const canSeeCoachSettings = user?.role === "admin" || user?.role === "coach";
  const isAdmin = user?.role === "admin";
  const settingsSection = coachNavSections.find((section) => section.key === "settings");
  const settingsHasActiveChild = settingsSection?.children?.some((child) => isActivePath(pathname, child.path));
  const [settingsOpen, setSettingsOpen] = useState(Boolean(settingsHasActiveChild));

  return (
    <Sidebar collapsible="offcanvas">
      <SidebarHeader className="flex h-[86px] flex-row items-center gap-3 px-8">
        <div className="grid h-12 w-12 place-items-center rounded-full border-4 border-red-600 text-2xl font-black text-red-500">
          K
        </div>
        <div className="text-xl font-extrabold tracking-wide">COACH PANEL</div>
      </SidebarHeader>

      <SidebarContent className="px-4 pb-6">
        <SidebarMenu className="gap-1">
          {coachNavSections
            .filter((section) => (!section.coachOrAdminOnly || canSeeCoachSettings) && (!section.adminOnly || isAdmin))
            .map((section) => {
              const active = isActivePath(pathname, section.path);

              if (section.children) {
                return (
                  <SidebarMenuItem key={section.key} className={section.spacerBefore ? "mt-6" : ""}>
                    <Collapsible open={settingsOpen} onOpenChange={setSettingsOpen}>
                      <SidebarMenuButton
                        onClick={() => setSettingsOpen((value) => !value)}
                        className="h-12 text-[15px] font-semibold text-slate-100 hover:bg-white/10 hover:text-white"
                      >
                        <span className="truncate">{section.label}</span>
                        <ChevronDown className={`ml-auto h-4 w-4 transition-transform ${settingsOpen ? "rotate-180" : ""}`} />
                      </SidebarMenuButton>
                      {canSeeCoachSettings && (
                        <CollapsibleContent>
                          <SidebarMenuSub className="border-white/10">
                            {section.children.map((child) =>
                              child.path ? (
                                <SidebarMenuSubItem key={child.key}>
                                  <SidebarMenuSubButton
                                    isActive={isActivePath(pathname, child.path)}
                                    className="text-slate-300 hover:bg-white/10 hover:text-white data-[active=true]:bg-white/10 data-[active=true]:text-white"
                                    render={<Link href={child.path}>{child.label}</Link>}
                                  />
                                </SidebarMenuSubItem>
                              ) : (
                                <SidebarMenuSubItem key={child.key}>
                                  <SidebarMenuSubButton className="text-slate-300 hover:bg-white/10 hover:text-white">
                                    {child.label}
                                  </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                              ),
                            )}
                          </SidebarMenuSub>
                        </CollapsibleContent>
                      )}
                    </Collapsible>
                  </SidebarMenuItem>
                );
              }

              return (
                <SidebarMenuItem key={section.key} className={section.spacerBefore ? "mt-6" : ""}>
                  <SidebarMenuButton
                    isActive={active}
                    className="h-12 text-[15px] font-semibold text-slate-100 hover:bg-white/10 hover:text-white data-[active=true]:bg-red-600 data-[active=true]:text-white data-[active=true]:shadow-lg data-[active=true]:shadow-red-950/30 data-[active=true]:hover:bg-red-600"
                    render={
                      <Link href={section.path || "#"}>
                        <span className="truncate">{section.label}</span>
                      </Link>
                    }
                  />
                </SidebarMenuItem>
              );
            })}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter className="border-t border-white/10 p-7">
        <div className="flex items-center gap-3">
          <UserAvatar initials={getInitials(user?.fullName)} tone="bg-red-600" size="h-12 w-12" photoUrl={user?.profilePhoto} />
          <div>
            <div className="font-bold">{user?.fullName || "Coach Admin"}</div>
            <div className="mt-1 flex items-center gap-2 text-sm text-emerald-400">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
              Online
            </div>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

function CoachTopbar({ title, user, logout }: { title: string; user: AuthUser | null; logout: () => Promise<void> }) {
  return (
    <header className="sticky top-0 z-10 flex h-[86px] items-center justify-between border-b border-slate-200 bg-white px-10 shadow-sm">
      <div className="flex items-center gap-9">
        <MenuToggle />
        <h1 className="text-2xl font-extrabold">{title}</h1>
      </div>

      <div className="flex items-center gap-4">
        <ThemeColorPicker />
        <TopbarActions user={user} logout={logout} />
      </div>
    </header>
  );
}

const sidebarWidthStyle = { "--sidebar-width": "18.75rem" } as CSSProperties;

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
  return (
    <SidebarProvider style={sidebarWidthStyle} className="bg-slate-50 text-slate-950">
      <CoachSidebar user={user} />
      <SidebarInset className="bg-slate-50">
        <CoachTopbar title={title} user={user} logout={logout} />
        <div className="px-10 py-8">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
