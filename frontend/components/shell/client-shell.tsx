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
import { Badge } from "@/components/ui/badge";
import { MenuToggle, TopbarActions } from "@/components/shell/topbar-controls";
import { ThemeSwitcher } from "@/components/shell/theme-switcher";
import { ThemeColorPicker } from "@/components/shell/theme-color-picker";
import { SidebarUserMenu } from "@/components/shell/sidebar-user-menu";
import { clientNavSections } from "@/lib/nav-config";
import type { AuthUser } from "@/types/auth";

function ClientSidebar({
  user,
  logout,
  paymentApproved,
  unreadNotifications = 0,
  active = "dashboard",
}: {
  user: AuthUser | null;
  logout: () => Promise<void>;
  paymentApproved: boolean;
  unreadNotifications?: number;
  active?: string;
}) {
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
          {clientNavSections.map((section) => {
            const isLocked = Boolean(section.locked && !paymentApproved);
            const isActive = active === section.key;
            const Icon = section.icon;
            const buttonClassName = `h-12 text-[15px] font-semibold text-slate-100 hover:bg-white/10 hover:text-white data-[active=true]:bg-red-600 data-[active=true]:text-white data-[active=true]:shadow-lg data-[active=true]:shadow-red-950/30 data-[active=true]:hover:bg-red-600 ${
              isLocked ? "cursor-not-allowed opacity-45 blur-[1px]" : ""
            }`;

            return (
              <SidebarMenuItem key={section.key} className={section.spacerBefore ? "mt-6" : ""}>
                {section.path && !isLocked ? (
                  <SidebarMenuButton
                    isActive={isActive}
                    tooltip={section.label}
                    className={buttonClassName}
                    render={
                      <Link href={section.path}>
                        {Icon && <Icon className="h-4 w-4 shrink-0" />}
                        <span className="truncate">{section.label}</span>
                      </Link>
                    }
                  />
                ) : (
                  <SidebarMenuButton disabled={isLocked} tooltip={section.label} className={buttonClassName}>
                    {Icon && <Icon className="h-4 w-4 shrink-0" />}
                    <span className="truncate">{section.label}</span>
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

      <SidebarFooter className="border-t border-white/10 p-3">
        <SidebarUserMenu user={user} logout={logout} profileHref="/client-profile" notificationsHref="/client-notifications" />
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
    <header className="flex items-center justify-between border-b bg-background px-6 py-4 text-foreground">
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
      <ClientSidebar user={user} logout={logout} paymentApproved={paymentApproved} unreadNotifications={unreadNotifications} active={active} />
      <SidebarInset className="bg-slate-50 dark:bg-slate-900">
        <ClientTopbar title={title} user={user} logout={logout} />
        <div className="px-10 py-8">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
