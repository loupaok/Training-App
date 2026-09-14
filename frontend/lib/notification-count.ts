import { api } from "@/lib/api/client";

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

export async function loadUnreadNotificationCount(): Promise<number> {
  const data = await api.get<{ unread?: number }>("/clients/notifications/unread-count");
  const nextCount = Number(data?.unread || 0);
  window.localStorage.setItem(NOTIFICATION_COUNT_KEY, String(nextCount));
  return nextCount;
}
