"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/shared/user-avatar";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { NotificationsMenu } from "@/components/shell/notifications-menu";
import { getInitials } from "@/lib/media";
import type { AuthUser } from "@/types/auth";

export function AppHeader({
  title,
  user,
  logout,
}: {
  title: string;
  user: AuthUser | null;
  logout: () => Promise<void>;
}) {
  const [signingOut, setSigningOut] = useState(false);

  async function handleLogout() {
    setSigningOut(true);
    try {
      await logout();
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <header className="sticky top-0 z-30 flex min-h-16 items-center justify-between gap-3 border-b border-border bg-card px-4 py-3 sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/sp-team-logo-black.svg" alt="SP Team" className="h-6 w-auto shrink-0 lg:hidden" />
        <h1 className="truncate text-lg font-extrabold tracking-[-0.3px]">{title}</h1>
        {user?.role && (
          <Badge variant="secondary" className="hidden capitalize sm:inline-flex">
            {user.role}
          </Badge>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <NotificationsMenu user={user} />
        <ThemeToggle />
        <UserAvatar
          initials={getInitials(user?.fullName || user?.email)}
          tone="bg-primary"
          size="size-8"
          photoUrl={user?.profilePhoto}
        />
        <span className="hidden text-sm text-muted-foreground sm:inline">{user?.fullName}</span>
        <Button variant="outline" size="sm" onClick={handleLogout} disabled={signingOut}>
          {signingOut ? "Αποχώρηση..." : "Αποχώρηση"}
        </Button>
      </div>
    </header>
  );
}
