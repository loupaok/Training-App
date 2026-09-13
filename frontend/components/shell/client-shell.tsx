"use client";

import type { ReactNode, CSSProperties } from "react";
import Link from "next/link";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { UserAvatar } from "@/components/shared/user-avatar";
import { MenuToggle, TopbarActions } from "@/components/shell/topbar-controls";
import { ThemeSwitcher } from "@/components/shell/theme-switcher";
import { clientNavSections } from "@/lib/nav-config";
import type { AuthUser } from "@/types/auth";

function ClientSidebar({
  user,
  paymentApproved,
  unreadNotifications = 0,
  active = "dashboard",
}: {
  user: AuthUser | null;
  paymentApproved: boolean;
  unreadNotifications?: number;
  active?: string;
}) {
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
          {clientNavSections.map((section) => {
            const isLocked = Boolean(section.locked && !paymentApproved);
            const isActive = active === section.key;
            const buttonClassName = `h-12 text-[15px] font-semibold text-slate-100 hover:bg-white/10 hover:text-white data-[active=true]:bg-red-600 data-[active=true]:text-white data-[active=true]:shadow-lg data-[active=true]:shadow-red-950/30 data-[active=true]:hover:bg-red-600 ${
              isLocked ? "cursor-not-allowed opacity-45 blur-[1px]" : ""
            }`;

            return (
              <SidebarMenuItem key={section.key} className={section.spacerBefore ? "mt-6" : ""}>
                {section.path && !isLocked ? (
                  <SidebarMenuButton
                    isActive={isActive}
                    className={buttonClassName}
                    render={<Link href={section.path}>{section.label}</Link>}
                  />
                ) : (
                  <SidebarMenuButton disabled={isLocked} className={buttonClassName}>
                    {section.label}
                  </SidebarMenuButton>
                )}
                {section.key === "notifications" && unreadNotifications > 0 && (
                  <SidebarMenuBadge className="bg-red-600 text-white">{unreadNotifications}</SidebarMenuBadge>
                )}
                {isLocked && <SidebarMenuBadge className="text-slate-400">Κλειδωμένο</SidebarMenuBadge>}
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter className="border-t border-white/10 p-7">
        <div className="flex items-center gap-3">
          <UserAvatar
            initials={(user?.fullName || user?.email || "CL").slice(0, 2).toUpperCase()}
            tone="bg-red-600"
            size="h-12 w-12"
            photoUrl={user?.profilePhoto}
          />
          <div className="min-w-0">
            <div className="truncate font-bold">{user?.fullName || "Client"}</div>
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

function ClientTopbar({
  title = "Αρχική",
  user,
  logout,
}: {
  title?: string;
  user: AuthUser | null;
  logout: () => Promise<void>;
}) {
  return (
    <header className="sticky top-0 z-10 flex h-[86px] items-center justify-between border-b border-slate-200 bg-white px-10 text-slate-950 shadow-sm dark:border-slate-800 dark:bg-slate-950 dark:text-white">
      <div className="flex items-center gap-9">
        <MenuToggle />
        <h1 className="text-2xl font-extrabold">{title}</h1>
      </div>
      <div className="flex items-center gap-4">
        <ThemeSwitcher />
        <TopbarActions user={user} logout={logout} />
      </div>
    </header>
  );
}

const sidebarWidthStyle = { "--sidebar-width": "18.75rem" } as CSSProperties;

export function ClientShell({
  title,
  user,
  logout,
  paymentApproved,
  unreadNotifications,
  active,
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
  return (
    <SidebarProvider style={sidebarWidthStyle} className="bg-slate-50 text-slate-950 dark:bg-slate-900 dark:text-white">
      <ClientSidebar user={user} paymentApproved={paymentApproved} unreadNotifications={unreadNotifications} active={active} />
      <SidebarInset className="bg-slate-50 dark:bg-slate-900">
        <ClientTopbar title={title} user={user} logout={logout} />
        <div className="px-10 py-8">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
