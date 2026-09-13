"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Bell, Clock, Dumbbell, Euro, Mail, Salad } from "lucide-react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { ClientShell } from "@/components/shell/client-shell";
import { clearUnreadNotifications } from "@/components/shell/topbar-controls";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth/auth-context";
import { api } from "@/lib/api/client";

interface RawNotification {
  id: number | string;
  title: string;
  body?: string;
  created_at?: string;
  link_url?: string | null;
  type?: string;
}

interface PaymentRow {
  status?: string;
  created_at?: string;
  paid_at?: string;
}

interface NotificationsResponse {
  notifications?: RawNotification[];
  payments?: PaymentRow[];
  subscription?: { end_date?: string };
  training?: { updated_at?: string };
  nutrition?: { updated_at?: string };
  paymentApproved?: boolean;
  unreadNotifications?: number;
}

interface NotificationRow {
  id: string;
  title: string;
  body: string;
  date: string;
  href: string | null;
  icon: LucideIcon;
  tone: string;
}

function iconForType(type = ""): LucideIcon {
  if (type.includes("payment")) return Euro;
  if (type.includes("subscription")) return Clock;
  if (type.includes("message")) return Mail;
  if (type.includes("nutrition")) return Salad;
  if (type.includes("training")) return Dumbbell;
  return Bell;
}

function toneForType(type = ""): string {
  if (type.includes("payment")) return "bg-amber-50 text-amber-700";
  if (type.includes("subscription")) return "bg-red-50 text-red-700";
  if (type.includes("message")) return "bg-blue-50 text-blue-700";
  if (type.includes("nutrition")) return "bg-emerald-50 text-emerald-700";
  if (type.includes("training")) return "bg-indigo-50 text-indigo-700";
  return "bg-slate-100 text-slate-600";
}

function formatDate(value?: string): string {
  if (!value) return "Σήμερα";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Σήμερα";
  return date.toLocaleDateString("el-GR");
}

function daysUntil(value: string): number {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 999;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  return Math.ceil((date.getTime() - today.getTime()) / 86400000);
}

function buildClientNotifications(data: NotificationsResponse | null): NotificationRow[] {
  if (!data) return [];
  const rows: NotificationRow[] = [];

  (data.notifications || []).forEach((item) => {
    rows.push({
      id: `db-${item.id}`,
      title: item.title,
      body: item.body || "Νέα ενημέρωση από τον coach.",
      date: formatDate(item.created_at),
      href: item.link_url || null,
      icon: iconForType(item.type),
      tone: toneForType(item.type),
    });
  });

  const latestPayment = data.payments?.[0];
  if (latestPayment?.status === "pending") {
    rows.unshift({
      id: "payment-pending",
      title: "Η πληρωμή σου είναι σε εκκρεμότητα",
      body: "Μόλις εγκριθεί από τον coach, θα ξεκλειδώσουν τα προγράμματα και το progress.",
      date: formatDate(latestPayment.created_at),
      href: "/client-billing",
      icon: Euro,
      tone: "bg-amber-50 text-amber-700",
    });
  }
  if (latestPayment?.status === "completed") {
    rows.unshift({
      id: "payment-approved",
      title: "Η πληρωμή σου εγκρίθηκε",
      body: "Η συνδρομή σου είναι ενεργή και τα προγράμματα ξεκλειδώθηκαν.",
      date: formatDate(latestPayment.paid_at || latestPayment.created_at),
      href: "/client-dashboard",
      icon: Bell,
      tone: "bg-emerald-50 text-emerald-700",
    });
  }

  if (data.subscription?.end_date) {
    const daysLeft = daysUntil(data.subscription.end_date);
    if (daysLeft >= 0 && daysLeft <= 7) {
      rows.unshift({
        id: "subscription-ending",
        title: `Η συνδρομή σου λήγει σε ${daysLeft} ημέρες`,
        body: "Μπορείς να ανανεώσεις από τη σελίδα Πληρωμές και Συνδρομή.",
        date: formatDate(data.subscription.end_date),
        href: "/client-billing",
        icon: Clock,
        tone: "bg-red-50 text-red-700",
      });
    }
  }

  if (data.training?.updated_at) {
    rows.push({
      id: "training-updated",
      title: "Ενημερώθηκε το πρόγραμμα προπόνησης",
      body: "Ο coach έκανε αλλαγές στο προπονητικό σου πλάνο.",
      date: formatDate(data.training.updated_at),
      href: "/client-dashboard",
      icon: Dumbbell,
      tone: "bg-blue-50 text-blue-700",
    });
  }
  if (data.nutrition?.updated_at) {
    rows.push({
      id: "nutrition-updated",
      title: "Ενημερώθηκε η διατροφή σου",
      body: "Ο coach έκανε αλλαγές στο διατροφικό σου πλάνο.",
      date: formatDate(data.nutrition.updated_at),
      href: "/client-dashboard",
      icon: Salad,
      tone: "bg-emerald-50 text-emerald-700",
    });
  }

  return rows;
}

function ClientNotificationsContent() {
  const { user, logout } = useAuth();
  const [data, setData] = useState<NotificationsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    clearUnreadNotifications()
      .catch(() => {})
      .then(() => api.get<NotificationsResponse>("/clients/me/notifications"))
      .then(setData)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Δεν φορτώθηκαν οι ειδοποιήσεις."))
      .finally(() => setLoading(false));
  }, []);

  const notifications = useMemo(() => buildClientNotifications(data), [data]);
  const paymentApproved = Boolean(data?.paymentApproved);

  return (
    <ClientShell
      title="Ειδοποιήσεις"
      user={user}
      logout={logout}
      paymentApproved={paymentApproved}
      unreadNotifications={data?.unreadNotifications || 0}
      active="notifications"
    >
      <div className="mb-7">
        <h2 className="text-3xl font-extrabold">Ειδοποιήσεις</h2>
        <p className="mt-2 text-sm font-semibold text-slate-500">Ενημερώσεις που αφορούν μόνο τον δικό σου λογαριασμό.</p>
      </div>

      {error && (
        <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-red-700">{error}</div>
      )}
      {loading && (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center font-bold text-slate-500">Φόρτωση...</div>
      )}

      {!loading && (
        <Card className="gap-0 overflow-hidden p-0">
          <div className="border-b border-slate-200 px-6 py-5">
            <h3 className="text-lg font-black">Οι ενημερώσεις σου</h3>
          </div>
          <div className="divide-y divide-slate-200">
            {notifications.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.id} className="flex items-start gap-4 px-6 py-5">
                  <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${item.tone}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-black text-slate-950">{item.title}</div>
                    <div className="mt-1 text-sm font-semibold leading-6 text-slate-500">{item.body}</div>
                    <div className="mt-2 text-xs font-bold text-slate-400">{item.date}</div>
                  </div>
                  {item.href && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0 font-black text-slate-600 hover:border-red-200 hover:text-red-600"
                      nativeButton={false}
                      render={<Link href={item.href}>Προβολή</Link>}
                    />
                  )}
                </div>
              );
            })}
            {!notifications.length && (
              <div className="px-6 py-12 text-center font-bold text-slate-500">Δεν υπάρχουν ειδοποιήσεις ακόμα.</div>
            )}
          </div>
        </Card>
      )}
    </ClientShell>
  );
}

export default function ClientNotificationsPage() {
  return (
    <ProtectedRoute>
      <ClientNotificationsContent />
    </ProtectedRoute>
  );
}
