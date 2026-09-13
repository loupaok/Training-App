"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, ChevronDown, LogOut, Mail, Menu, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserAvatar } from "@/components/shared/user-avatar";
import { useSidebar } from "@/components/ui/sidebar";
import { api } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/auth-context";
import type { AuthUser } from "@/types/auth";

const NOTIFICATION_COUNT_KEY = "coachUnreadNotifications";

export function getUnreadNotificationCount(): number {
  if (typeof window === "undefined") return 0;
  const stored = window.localStorage.getItem(NOTIFICATION_COUNT_KEY);
  if (stored === null) {
    window.localStorage.setItem(NOTIFICATION_COUNT_KEY, "0");
    return 0;
  }
  return Number(stored) || 0;
}

export function clearUnreadNotifications() {
  return api
    .post("/clients/notifications/read", {})
    .finally(() => {
      window.localStorage.setItem(NOTIFICATION_COUNT_KEY, "0");
      window.dispatchEvent(new CustomEvent("coach-notifications-read"));
    });
}

async function loadUnreadNotificationCount(): Promise<number> {
  const data = await api.get<{ unread?: number }>("/clients/notifications/unread-count");
  const nextCount = Number(data?.unread || 0);
  window.localStorage.setItem(NOTIFICATION_COUNT_KEY, String(nextCount));
  return nextCount;
}

export function MenuToggle() {
  const { toggleSidebar } = useSidebar();
  return (
    <Button variant="ghost" size="icon" onClick={toggleSidebar} aria-label="Toggle menu">
      <Menu className="h-5 w-5" />
    </Button>
  );
}

export function TopbarActions({ user, logout }: { user: AuthUser | null; logout: () => Promise<void> }) {
  const { updateUser } = useAuth();
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [profileForm, setProfileForm] = useState({
    fullName: user?.fullName || "",
    profileTitle: user?.profileTitle || "",
  });
  const [profileMessage, setProfileMessage] = useState("");
  const [profileError, setProfileError] = useState("");
  const [unreadNotifications, setUnreadNotifications] = useState(() => getUnreadNotificationCount());
  const pathname = usePathname();
  const isClient = user?.role === "client";
  const notificationsPath = isClient ? "/client-notifications" : "/notifications";

  useEffect(() => {
    const updateCount = () => {
      loadUnreadNotificationCount()
        .then(setUnreadNotifications)
        .catch(() => setUnreadNotifications(getUnreadNotificationCount()));
    };
    const clearCount = () => setUnreadNotifications(0);
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

  useEffect(() => {
    setProfileForm({ fullName: user?.fullName || "", profileTitle: user?.profileTitle || "" });
  }, [user?.fullName, user?.profileTitle]);

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault();
    setProfileError("");
    setProfileMessage("");

    try {
      const data = await api.put<{ user: AuthUser }>("/auth/profile", profileForm);
      updateUser({ ...(user as AuthUser), ...data.user });
      setProfileMessage("Το προφίλ ενημερώθηκε.");
      window.setTimeout(() => {
        setEditProfileOpen(false);
        setProfileMessage("");
      }, 700);
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : "Δεν έγινε αποθήκευση.");
    }
  };

  return (
    <div className="flex items-center gap-5">
      <Button
        variant="ghost"
        size="icon"
        className="relative"
        aria-label="Notifications"
        nativeButton={false}
        render={
          <Link href={notificationsPath} onClick={() => clearUnreadNotifications()}>
            <Bell className="h-5 w-5" />
            {unreadNotifications > 0 && (
              <Badge className="absolute -right-1 -top-1 h-5 min-w-5 justify-center rounded-full px-1.5 text-[11px]">
                {unreadNotifications}
              </Badge>
            )}
          </Link>
        }
      />

      <Button variant="ghost" size="icon" aria-label="Messages">
        <Mail className="h-5 w-5" />
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" className="flex items-center gap-3 px-2 py-1">
              <UserAvatar
                initials={(user?.fullName || user?.email || "CA").slice(0, 2).toUpperCase()}
                tone="bg-slate-900"
                size="h-11 w-11"
                photoUrl={user?.profilePhoto}
              />
              <span className="text-left">
                <span className="block font-bold leading-tight">{user?.fullName || "Coach Admin"}</span>
                {user?.profileTitle && <span className="block text-xs font-semibold text-slate-500">{user.profileTitle}</span>}
              </span>
              <ChevronDown className="h-4 w-4" />
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="w-56">
          {isClient ? (
            <DropdownMenuItem
              render={
                <Link href="/client-profile">
                  <User className="h-4 w-4" />
                  Επεξεργασία Προφίλ
                </Link>
              }
            />
          ) : (
            <DropdownMenuItem onClick={() => setEditProfileOpen(true)}>
              <User className="h-4 w-4" />
              Επεξεργασία προφίλ
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => logout()}>
            <LogOut className="h-4 w-4" />
            Logout
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={editProfileOpen} onOpenChange={setEditProfileOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Επεξεργασία προφίλ</DialogTitle>
            <DialogDescription>Άλλαξε το όνομα και τον τίτλο που εμφανίζονται στο panel.</DialogDescription>
          </DialogHeader>

          <form onSubmit={saveProfile} className="space-y-4">
            {profileError && (
              <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
                {profileError}
              </div>
            )}
            {profileMessage && (
              <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm font-bold text-green-700">
                {profileMessage}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="fullName">Όνομα και επίθετο</Label>
              <Input
                id="fullName"
                value={profileForm.fullName}
                onChange={(event) => setProfileForm((form) => ({ ...form, fullName: event.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profileTitle">Τίτλος</Label>
              <Input
                id="profileTitle"
                value={profileForm.profileTitle}
                onChange={(event) => setProfileForm((form) => ({ ...form, profileTitle: event.target.value }))}
                placeholder="π.χ. Admin"
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditProfileOpen(false)}>
                Άκυρο
              </Button>
              <Button type="submit">Αποθήκευση</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
