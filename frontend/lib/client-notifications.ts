import type { LucideIcon } from "lucide-react";
import { Bell, Clock, Dumbbell, Euro, Mail, Salad } from "lucide-react";

export interface RawNotification {
  id: number | string;
  title: string;
  body?: string;
  created_at?: string;
  link_url?: string | null;
  type?: string;
}

export interface PaymentRow {
  status?: string;
  created_at?: string;
  paid_at?: string;
}

export interface ClientNotificationsResponse {
  notifications?: RawNotification[];
  payments?: PaymentRow[];
  subscription?: { end_date?: string };
  training?: { updated_at?: string };
  nutrition?: { updated_at?: string };
  paymentApproved?: boolean;
  unreadNotifications?: number;
}

export interface ClientNotificationRow {
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

export function buildClientNotifications(data: ClientNotificationsResponse | null): ClientNotificationRow[] {
  if (!data) return [];
  const rows: ClientNotificationRow[] = [];

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
