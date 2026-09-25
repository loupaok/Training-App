import type { LucideIcon } from "lucide-react";
import { Bell, Clock, Dumbbell, Euro, Mail, Megaphone, MessageCircleMore, Salad } from "lucide-react";

export interface RawNotification {
  id: number | string;
  title: string;
  body?: string;
  created_at?: string;
  link_url?: string | null;
  type?: string;
  read_at?: string | null;
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
  notificationId?: string;
  title: string;
  body: string;
  date: string;
  href: string | null;
  type?: string;
  readAt?: string | null;
  icon: LucideIcon;
  tone: string;
}

function iconForType(type = ""): LucideIcon {
  if (type === "admin_broadcast") return Megaphone;
  if (type === "coach_message") return MessageCircleMore;
  if (type.includes("payment")) return Euro;
  if (type.includes("subscription")) return Clock;
  if (type.includes("message")) return Mail;
  if (type.includes("nutrition")) return Salad;
  if (type.includes("training")) return Dumbbell;
  return Bell;
}

function toneForType(type = ""): string {
  if (type === "admin_broadcast") return "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300";
  if (type === "coach_message") return "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400";
  if (type.includes("payment")) return "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400";
  if (type.includes("subscription")) return "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400";
  if (type.includes("message")) return "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400";
  if (type.includes("nutrition")) return "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400";
  if (type.includes("training")) return "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400";
  return "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300";
}

function formatDate(value?: string): string {
  if (!value) return "Σήμερα";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Σήμερα";
  return date.toLocaleDateString("el-GR");
}

export function buildClientNotifications(data: ClientNotificationsResponse | null): ClientNotificationRow[] {
  if (!data) return [];
  const rows: ClientNotificationRow[] = [];

  (data.notifications || []).forEach((item) => {
    rows.push({
      id: `db-${item.id}`,
      notificationId: String(item.id),
      title: item.title,
      body: item.body || "Νέα ενημέρωση από τον coach.",
      date: formatDate(item.created_at),
      href: item.link_url || null,
      type: item.type,
      readAt: item.read_at || null,
      icon: iconForType(item.type),
      tone: toneForType(item.type),
    });
  });

  return rows;
}
