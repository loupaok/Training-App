"use client";

import Link from "next/link";
import { ChevronsUpDown, LogOut, User, Bell } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserAvatar } from "@/components/shared/user-avatar";
import { getInitials } from "@/lib/media";
import type { AuthUser } from "@/types/auth";

export function SidebarUserMenu({
  user,
  logout,
  profileHref,
  notificationsHref,
  collapsed = false,
}: {
  user: AuthUser | null;
  logout: () => Promise<void>;
  profileHref: string;
  notificationsHref: string;
  collapsed?: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            title={collapsed ? user?.fullName : undefined}
            className={`flex w-full items-center gap-3 rounded-md p-2 text-left text-sm text-white hover:bg-white/10 ${
              collapsed ? "justify-center" : ""
            }`}
          >
            <UserAvatar
              initials={getInitials(user?.fullName || user?.email)}
              tone="bg-red-600"
              size="h-9 w-9"
              photoUrl={user?.profilePhoto}
            />
            {!collapsed && (
              <>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-bold">{user?.fullName || "Χρήστης"}</span>
                  <span className="truncate text-xs text-white/60">{user?.email}</span>
                </span>
                <ChevronsUpDown className="h-4 w-4 shrink-0 text-white/60" />
              </>
            )}
          </button>
        }
      />
      <DropdownMenuContent align="end" side="top" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="font-normal">
            <span className="flex flex-col">
              <span className="truncate font-medium">{user?.fullName}</span>
              <span className="truncate text-xs text-muted-foreground">{user?.email}</span>
            </span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href={profileHref}><User className="h-4 w-4" />Προφίλ</Link>} />
        <DropdownMenuItem render={<Link href={notificationsHref}><Bell className="h-4 w-4" />Ειδοποιήσεις</Link>} />
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={() => logout()}>
          <LogOut className="h-4 w-4" />
          Αποχώρηση
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
