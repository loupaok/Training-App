"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { CoachShell } from "@/components/shell/coach-shell";
import { clearUnreadNotifications } from "@/lib/notification-count";
import { useAuth } from "@/lib/auth/auth-context";
import { api } from "@/lib/api/client";

type FilterValue = "all" | "payments" | "subscriptions" | "updates" | "clients";

interface FilterOption {
  label: string;
  value: FilterValue;
}

interface NotificationItem {
  id: number | string;
  type?: string;
  title?: string;
  body?: string;
  client_name?: string;
  client_id?: number | string;
  created_at?: string;
}

interface NotificationGroup {
  label: string;
  items: NotificationItem[];
}

const filters: FilterOption[] = [
  { label: "Όλες", value: "all" },
  { label: "Πληρωμές", value: "payments" },
  { label: "Συνδρομές", value: "subscriptions" },
  { label: "Updates", value: "updates" },
  { label: "Πελάτες", value: "clients" },
];

function NotificationsContent() {
  const { user, logout } = useAuth();
  const [activeFilter, setActiveFilter] = useState<FilterValue>("all");
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    clearUnreadNotifications()
      .catch(() => {})
      .then(() => api.get<NotificationItem[]>("/clients/admin/notifications"))
      .then((rows) => setNotifications(Array.isArray(rows) ? rows : []))
      .catch((err) => setError(err instanceof Error ? err.message : "Δεν φορτώθηκαν οι ειδοποιήσεις."))
      .finally(() => setLoading(false));
  }, []);

  const visibleNotifications = useMemo(() => {
    return notifications.filter((item) => matchesFilter(item, activeFilter));
  }, [activeFilter, notifications]);

  const grouped = useMemo(() => groupNotifications(visibleNotifications), [visibleNotifications]);

  return (
    <CoachShell title="Ειδοποιήσεις" user={user} logout={logout}>
      <div className="mb-7 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="flex items-center gap-3 text-sm">
            <Link href="/dashboard" className="font-semibold text-blue-600">
              Dashboard
            </Link>
            <span className="text-slate-400 dark:text-slate-500">›</span>
            <span className="text-slate-600 dark:text-slate-400">Ειδοποιήσεις</span>
          </div>
          <h2 className="mt-5 text-3xl font-bold">Κέντρο Ειδοποιήσεων</h2>
          <p className="mt-2 text-slate-600 dark:text-slate-400">Πληρωμές, συνδρομές, updates πελατών και νέα συμβάντα.</p>
        </div>
        <div className="grid grid-cols-2 gap-3 md:flex">
          <SummaryCard label="Σύνολο" value={notifications.length} />
          <SummaryCard label="Σε προβολή" value={visibleNotifications.length} />
        </div>
      </div>

      <Card className="mb-6 p-4">
        <div className="flex flex-wrap gap-2">
          {filters.map((filter) => (
            <Button
              key={filter.value}
              variant={activeFilter === filter.value ? "default" : "outline"}
              className="h-10 px-4 text-sm font-bold"
              onClick={() => setActiveFilter(filter.value)}
            >
              {filter.label}
            </Button>
          ))}
        </div>
      </Card>

      {error && (
        <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400">{error}</div>
      )}
      {loading && (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center font-bold text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">Φόρτωση...</div>
      )}

      {!loading && (
        <section className="max-w-5xl space-y-5">
          {grouped.map((group) => (
            <Card key={group.label} className="p-5">
              <div className="mb-4 text-xs font-bold text-slate-500 dark:text-slate-400">{group.label}</div>
              <div className="divide-y divide-slate-200 dark:divide-slate-800">
                {group.items.map((item) => (
                  <NotificationRow key={item.id} item={item} />
                ))}
              </div>
            </Card>
          ))}

          {!grouped.length && (
            <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center dark:border-slate-700 dark:bg-slate-900">
              <div className="text-lg font-bold">Δεν υπάρχουν ειδοποιήσεις για αυτό το φίλτρο.</div>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Οι νέες πληρωμές και ενέργειες πελατών θα εμφανίζονται εδώ.</p>
            </div>
          )}
        </section>
      )}
    </CoachShell>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-32 rounded-lg border border-slate-200 bg-white px-5 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="text-xs font-bold text-slate-500 dark:text-slate-400">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
    </div>
  );
}

function NotificationRow({ item }: { item: NotificationItem }) {
  const tone = toneForType(item.type);

  return (
    <div className="flex items-start gap-4 py-4 first:pt-0 last:pb-0">
      <div className={`mt-0.5 grid h-11 w-11 shrink-0 place-items-center rounded-full ${tone.bubble}`}>
        <span className={`text-sm font-bold ${tone.text}`}>{iconForType(item.type)}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[15px] leading-6">
          <span className="font-bold">{item.title}</span>
          {item.client_name && <span className="font-semibold text-slate-800 dark:text-slate-200"> — {item.client_name}</span>}
        </div>
        <div className="mt-1 text-sm font-semibold leading-6 text-slate-600 dark:text-slate-400">{item.body}</div>
        <div className="mt-1 text-xs font-bold text-slate-400 dark:text-slate-500">{formatDateTime(item.created_at)}</div>
      </div>
      {item.client_id && (
        <Link
          href={`/clients/${item.client_id}`}
          className="hidden rounded-md border border-slate-200 px-3 py-2 text-sm font-bold text-slate-600 hover:border-red-200 hover:text-red-600 md:block dark:border-slate-800 dark:text-slate-400"
        >
          Προβολή
        </Link>
      )}
    </div>
  );
}

function groupNotifications(rows: NotificationItem[]): NotificationGroup[] {
  const today: NotificationItem[] = [];
  const older: NotificationItem[] = [];
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  rows.forEach((item) => {
    const created = new Date(item.created_at || "");
    if (!Number.isNaN(created.getTime()) && created >= start) today.push(item);
    else older.push(item);
  });

  return [
    today.length ? { label: "Σήμερα", items: today } : null,
    older.length ? { label: "Προηγούμενες", items: older } : null,
  ].filter((group): group is NotificationGroup => group !== null);
}

function matchesFilter(item: NotificationItem, filter: FilterValue): boolean {
  if (filter === "all") return true;
  if (filter === "payments") return String(item.type || "").includes("payment");
  if (filter === "subscriptions") return String(item.type || "").includes("subscription");
  if (filter === "updates") return String(item.type || "").includes("update");
  if (filter === "clients") return String(item.type || "").includes("client");
  return true;
}

function iconForType(type = ""): string {
  if (type.includes("payment")) return "€";
  if (type.includes("subscription")) return "⏱";
  if (type.includes("message")) return "@";
  if (type.includes("update")) return "!";
  if (type.includes("client")) return "+";
  return "•";
}

function toneForType(type = ""): { bubble: string; text: string } {
  if (type.includes("approved")) return { bubble: "bg-green-50 dark:bg-green-500/10", text: "text-green-600 dark:text-green-400" };
  if (type.includes("payment")) return { bubble: "bg-amber-50 dark:bg-amber-500/10", text: "text-amber-600 dark:text-amber-400" };
  if (type.includes("subscription")) return { bubble: "bg-red-50 dark:bg-red-500/10", text: "text-red-600 dark:text-red-400" };
  if (type.includes("update")) return { bubble: "bg-blue-50 dark:bg-blue-500/10", text: "text-blue-600 dark:text-blue-400" };
  return { bubble: "bg-slate-100 dark:bg-slate-800", text: "text-slate-600 dark:text-slate-400" };
}

function formatDateTime(value?: string): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("el-GR", { dateStyle: "short", timeStyle: "short" });
}

export default function NotificationsPage() {
  return (
    <ProtectedRoute>
      <NotificationsContent />
    </ProtectedRoute>
  );
}
