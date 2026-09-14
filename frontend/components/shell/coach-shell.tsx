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
import { Badge } from "@/components/ui/badge";
import { MenuToggle, TopbarActions } from "@/components/shell/topbar-controls";
import { ThemeColorPicker } from "@/components/shell/theme-color-picker";
import { SidebarUserMenu } from "@/components/shell/sidebar-user-menu";
import { coachNavSections, isActivePath } from "@/lib/nav-config";
import type { AuthUser } from "@/types/auth";

function CoachSidebar({ user, logout }: { user: AuthUser | null; logout: () => Promise<void> }) {
  const pathname = usePathname();
  const canSeeCoachSettings = user?.role === "admin" || user?.role === "coach";
  const isAdmin = user?.role === "admin";
  const settingsSection = coachNavSections.find((section) => section.key === "settings");
  const settingsHasActiveChild = settingsSection?.children?.some((child) => isActivePath(pathname, child.path));
  const [settingsOpen, setSettingsOpen] = useState(Boolean(settingsHasActiveChild));

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="flex h-[86px] flex-row items-center gap-3 px-4 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0 md:px-8">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full border-4 border-red-600 text-lg font-black text-red-500">
          K
        </div>
        <div className="truncate text-xl font-extrabold tracking-wide group-data-[collapsible=icon]:hidden">COACH PANEL</div>
      </SidebarHeader>

      <SidebarContent className="px-4 pb-6">
        <SidebarMenu className="gap-1">
          {coachNavSections
            .filter((section) => (!section.coachOrAdminOnly || canSeeCoachSettings) && (!section.adminOnly || isAdmin))
            .map((section) => {
              const active = isActivePath(pathname, section.path);

              const SectionIcon = section.icon;

              if (section.children) {
                return (
                  <SidebarMenuItem key={section.key} className={section.spacerBefore ? "mt-6" : ""}>
                    <Collapsible open={settingsOpen} onOpenChange={setSettingsOpen}>
                      <SidebarMenuButton
                        onClick={() => setSettingsOpen((value) => !value)}
                        tooltip={section.label}
                        className="h-12 text-[15px] font-semibold text-slate-100 hover:bg-white/10 hover:text-white"
                      >
                        {SectionIcon && <SectionIcon className="h-4 w-4 shrink-0" />}
                        <span className="truncate">{section.label}</span>
                        <ChevronDown
                          className={`ml-auto h-4 w-4 shrink-0 transition-transform group-data-[collapsible=icon]:hidden ${settingsOpen ? "rotate-180" : ""}`}
                        />
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
                    tooltip={section.label}
                    className="h-12 text-[15px] font-semibold text-slate-100 hover:bg-white/10 hover:text-white data-[active=true]:bg-red-600 data-[active=true]:text-white data-[active=true]:shadow-lg data-[active=true]:shadow-red-950/30 data-[active=true]:hover:bg-red-600"
                    render={
                      <Link href={section.path || "#"}>
                        {SectionIcon && <SectionIcon className="h-4 w-4 shrink-0" />}
                        <span className="truncate">{section.label}</span>
                      </Link>
                    }
                  />
                </SidebarMenuItem>
              );
            })}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter className="border-t border-white/10 p-3">
        <SidebarUserMenu user={user} logout={logout} notificationsHref="/notifications" />
      </SidebarFooter>
    </Sidebar>
  );
}

function CoachTopbar({ title, user, logout }: { title: string; user: AuthUser | null; logout: () => Promise<void> }) {
  return (
    <header className="flex items-center justify-between border-b bg-background px-6 py-4">
      <div className="flex items-center gap-3">
        <MenuToggle />
        <h1 className="text-lg font-semibold">{title}</h1>
        {user?.role && (
          <Badge variant="secondary" className="capitalize">
            {user.role}
          </Badge>
        )}
      </div>

      <div className="flex items-center gap-3">
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
      <CoachSidebar user={user} logout={logout} />
      <SidebarInset className="bg-slate-50">
        <CoachTopbar title={title} user={user} logout={logout} />
        <div className="px-10 py-8">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
