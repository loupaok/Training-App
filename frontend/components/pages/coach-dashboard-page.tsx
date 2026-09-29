"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, BellRing, CalendarDays, CheckCircle2, CircleDollarSign, ClipboardCheck, Clock3, Gift, MessageCircleMore, Sparkles, Users, UserRoundCheck } from "lucide-react";
import { CoachShell } from "@/components/shell/coach-shell";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth/auth-context";
import { api } from "@/lib/api/client";
import { getInitials } from "@/lib/media";
import { cn } from "@/lib/utils";

type ClientStatus = "active" | "pending" | "inactive";
interface ClientRow { id: number; full_name?: string; email?: string; profile_photo?: string | null; client_status_key?: ClientStatus; date_of_birth?: string | null; latest_update_at?: string | null; payment_status?: string | null; subscription_end_date?: string | null; is_expiring_soon?: number | boolean; }
interface WeeklyUpdate { id: number; client_id: number; client_name?: string; client_email?: string; client_photo?: string | null; submitted_at: string; is_read: number | boolean; }
interface UpdatesResponse { updates: WeeklyUpdate[] }
interface UpdateStats { totalUnread?: number; pendingClients?: Array<{ id: number; fullName?: string; email?: string }> }
interface InboxRow { unread_count?: number }
interface NotificationItem { id: number; type?: string; title?: string; body?: string; link_url?: string | null; read_at?: string | null; created_at?: string | null; client_id?: number | null; }

function formatDate(value?: string | null, includeTime = false) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("el-GR", includeTime ? { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" } : { day: "numeric", month: "short" }).format(date);
}
function isBirthdayToday(value?: string | null) {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return false;
  const today = new Date();
  return Number(match[2]) === today.getMonth() + 1 && Number(match[3]) === today.getDate();
}
function daysUntil(value?: string | null) {
  if (!value) return null;
  const end = new Date(`${value.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(end.getTime())) return null;
  const today = new Date(); today.setHours(12, 0, 0, 0);
  return Math.ceil((end.getTime() - today.getTime()) / 86_400_000);
}
function isToday(value?: string | null) {
  if (!value) return false;
  const date = new Date(value);
  const today = new Date();
  return !Number.isNaN(date.getTime()) && date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth() && date.getDate() === today.getDate();
}
function roleLabel(role?: string) { return role === "admin" ? "Admin" : role === "moderator" ? "Moderator" : "Coach"; }

function ClientLink({ client, className }: { client: ClientRow; className?: string }) {
  return <Link href={`/clients/${client.id}`} className={cn("flex items-center gap-3", className)}><UserAvatar initials={getInitials(client.full_name || client.email)} photoUrl={client.profile_photo} size="h-9 w-9" /><span className="min-w-0"><span className="block truncate text-sm font-semibold">{client.full_name || client.email || "Πελάτης"}</span><span className="block truncate text-xs text-muted-foreground">{client.email}</span></span></Link>;
}
function Metric({ label, value, note, icon: Icon, tone = "bg-muted text-foreground" }: { label: string; value: number; note: string; icon: typeof Users; tone?: string }) {
  return <Card className="border-border/80 shadow-sm"><CardContent className="flex items-start justify-between gap-3 p-5"><div><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-3xl font-bold tabular-nums">{value}</p><p className="mt-1 text-xs text-muted-foreground">{note}</p></div><span className={cn("grid h-10 w-10 place-items-center rounded-lg", tone)}><Icon className="h-5 w-5" /></span></CardContent></Card>;
}
function PriorityRow({ icon: Icon, title, detail, href, tone, children, onClick }: { icon: typeof CalendarDays; title: string; detail: string; href: string; tone: string; children?: ReactNode; onClick?: () => void }) {
  return <Link href={href} onClick={onClick} className="group flex items-center gap-3 rounded-lg px-3 py-3 transition-colors hover:bg-muted/60"><span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg", tone)}><Icon className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{title}</span><span className="block truncate text-xs text-muted-foreground">{detail}</span></span>{children}<ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" /></Link>;
}

function CoachDashboardContent() {
  const { user, logout } = useAuth();
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [updates, setUpdates] = useState<WeeklyUpdate[]>([]);
  const [updateStats, setUpdateStats] = useState<UpdateStats>({});
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const canUseMessages = user?.role === "admin" || user?.role === "coach" || Boolean(user?.permissions?.includes("messages"));
  const canManagePayments = user?.role === "admin" || Boolean(user?.permissions?.includes("approve_payments"));
  const canSendAnnouncements = user?.role === "admin" || Boolean(user?.permissions?.includes("send_announcements"));

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true); setError("");
      try {
        const [clientRows, stats, updateRows, inbox, notificationRows] = await Promise.all([
          api.get<ClientRow[]>("/clients"), api.get<UpdateStats>("/updates/stats"), api.get<UpdatesResponse>("/updates?unreadOnly=true&limit=6"),
          canUseMessages ? api.get<InboxRow[]>("/clients/messages/inbox") : Promise.resolve([]),
          api.get<NotificationItem[]>("/clients/admin/notifications").catch(() => []),
        ]);
        if (!active) return;
        setClients(Array.isArray(clientRows) ? clientRows : []); setUpdateStats(stats || {}); setUpdates(updateRows?.updates || []); setUnreadMessages(inbox.reduce((total, row) => total + Number(row.unread_count || 0), 0)); setNotifications(Array.isArray(notificationRows) ? notificationRows : []);
      } catch (loadError) { if (active) setError(loadError instanceof Error ? loadError.message : "Δεν φορτώθηκε το dashboard."); }
      finally { if (active) setLoading(false); }
    }
    void load(); return () => { active = false; };
  }, [canUseMessages]);

  const summary = useMemo(() => {
    const activeClients = clients.filter((client) => client.client_status_key === "active");
    const pendingPayments = clients.filter((client) => client.client_status_key === "pending" || client.payment_status === "pending");
    const inactiveClients = clients.filter((client) => client.client_status_key === "inactive");
    const birthdays = clients.filter((client) => isBirthdayToday(client.date_of_birth));
    const expiring = activeClients.filter((client) => client.is_expiring_soon || ((daysUntil(client.subscription_end_date) ?? 99) >= 0 && (daysUntil(client.subscription_end_date) ?? 99) <= 7));
    return { activeClients, pendingPayments, inactiveClients, birthdays, expiring };
  }, [clients]);
  const birthdayAlerts = useMemo(() => {
    const seenClients = new Set<number>();
    return notifications.filter((notification) => {
      if (notification.type !== "client_birthday" || notification.read_at || !notification.client_id || seenClients.has(notification.client_id)) return false;
      seenClients.add(notification.client_id);
      return true;
    }).map((notification) => {
      const href = notification.link_url || `/clients/${notification.client_id}`;
      const separator = href.includes("?") ? "&" : "?";
      return { ...notification, link_url: `${href}${separator}birthdayNotification=${notification.id}` };
    });
  }, [notifications]);
  const focusCount = Number(updateStats.totalUnread || 0) + summary.pendingPayments.length + birthdayAlerts.length + summary.expiring.length + unreadMessages;
  const greetingName = user?.fullName?.split(" ")[0] || "";
  const contactClients = summary.expiring.filter((client) => !birthdayAlerts.some((notification) => notification.client_id === client.id)).slice(0, 5);
  const contactReason = (client: ClientRow) => {
    const reasons: string[] = [];
    if (isBirthdayToday(client.date_of_birth)) reasons.push("Γενέθλια σήμερα");
    const remaining = daysUntil(client.subscription_end_date);
    if (remaining !== null && remaining >= 0 && remaining <= 7) reasons.push(remaining === 0 ? "Η συνδρομή λήγει σήμερα" : `Η συνδρομή λήγει σε ${remaining} ημ.`);
    return reasons.join(" · ");
  };
  const markBirthdayAlertRead = (notificationId: number) => {
    setNotifications((current) => current.map((notification) => notification.id === notificationId ? { ...notification, read_at: new Date().toISOString() } : notification));
    void api.post(`/clients/notifications/${notificationId}/read`).catch(() => {
      setNotifications((current) => current.map((notification) => notification.id === notificationId ? { ...notification, read_at: null } : notification));
    });
  };
  const birthdayDetail = (notification: NotificationItem) => isToday(notification.created_at) ? "Γενέθλια σήμερα" : `Αδιάβαστη υπενθύμιση γενεθλίων · ${formatDate(notification.created_at)}`;

  return <CoachShell title="Dashboard" user={user} logout={logout}><div id="coach-dashboard" className="mx-auto max-w-7xl space-y-6">
    <style>{`#coach-dashboard > section:nth-of-type(3) [data-slot="card-content"] { max-height: 23rem; overflow-y: auto; overscroll-behavior: contain; touch-action: pan-y; -webkit-overflow-scrolling: touch; }`}</style>
    <header className="flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-end sm:justify-between"><div><div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground"><span>{roleLabel(user?.role)}</span><span className="h-1 w-1 rounded-full bg-muted-foreground" /><span>{new Intl.DateTimeFormat("el-GR", { weekday: "long", day: "numeric", month: "long" }).format(new Date())}</span></div><h1 className="text-2xl font-bold sm:text-3xl">Καλημέρα{greetingName ? `, ${greetingName}` : ""}</h1><p className="mt-1 text-sm text-muted-foreground">{focusCount ? `${focusCount} στοιχεία χρειάζονται την προσοχή σου σήμερα.` : "Όλα είναι ενημερωμένα. Καλή συνέχεια!"}</p></div><div className="flex flex-wrap gap-2"><Button nativeButton={false} render={<Link href="/coach/updates" />}><ClipboardCheck className="mr-2 h-4 w-4" />Updates</Button><Button nativeButton={false} render={<Link href="/clients" />} variant="outline"><Users className="mr-2 h-4 w-4" />Πελάτες</Button></div></header>
    {error && <Card className="border-destructive/40"><CardContent className="p-4 text-sm text-destructive">{error}</CardContent></Card>}
    {loading ? <DashboardLoading /> : <>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Ενεργοί πελάτες" value={summary.activeClients.length} note={`${clients.length} συνολικά`} icon={UserRoundCheck} tone="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" /><Metric label="Αδιάβαστα updates" value={Number(updateStats.totalUnread || 0)} note={updateStats.pendingClients?.length ? `${updateStats.pendingClients.length} αναμένονται αυτή την εβδομάδα` : "Όλα τα νέα check-ins"} icon={ClipboardCheck} tone="bg-primary/10 text-primary" /><Metric label="Εκκρεμείς πληρωμές" value={summary.pendingPayments.length} note={canManagePayments ? "Χρειάζονται έλεγχο" : "Σε αναμονή έγκρισης"} icon={CircleDollarSign} tone="bg-amber-500/10 text-amber-700 dark:text-amber-400" /><Metric label="Νέα μηνύματα" value={unreadMessages} note={canUseMessages ? "Από συνομιλίες πελατών" : "Δεν έχεις πρόσβαση"} icon={MessageCircleMore} tone="bg-sky-500/10 text-sky-700 dark:text-sky-400" /></section>
      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(20rem,0.8fr)]"><Card className="shadow-sm"><CardHeader className="flex-row items-start justify-between gap-4 border-b"><div><CardTitle className="text-lg">Προτεραιότητες σήμερα</CardTitle><CardDescription>Οι ενέργειες που αξίζει να δεις πρώτες.</CardDescription></div><span className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary"><Sparkles className="h-4 w-4" /></span></CardHeader><CardContent className="divide-y p-2">{birthdayAlerts.map((notification) => { const client = clients.find((item) => item.id === notification.client_id); const clientName = client?.full_name || client?.email || "Πελάτης"; return <PriorityRow key={`birthday-${notification.id}`} icon={Gift} title={`Γενέθλια: ${clientName}`} detail="Έχει γενέθλια σήμερα. Άνοιξε την καρτέλα του για ευχές ή δώρο." href={notification.link_url || (notification.client_id ? `/clients/${notification.client_id}` : "/clients")} tone="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"><Badge variant="secondary">Σήμερα</Badge></PriorityRow>; })}{Number(updateStats.totalUnread || 0) > 0 && <PriorityRow icon={ClipboardCheck} title="Νέα εβδομαδιαία updates" detail={`${updateStats.totalUnread} updates δεν έχουν διαβαστεί.`} href="/coach/updates" tone="bg-primary/10 text-primary"><Badge>{updateStats.totalUnread}</Badge></PriorityRow>}{summary.pendingPayments.length > 0 && <PriorityRow icon={CircleDollarSign} title="Πληρωμές προς έγκριση" detail={`${summary.pendingPayments.length} πελάτες περιμένουν έλεγχο πληρωμής.`} href="/clients" tone="bg-amber-500/10 text-amber-700 dark:text-amber-400"><Badge variant="secondary">{summary.pendingPayments.length}</Badge></PriorityRow>}{summary.expiring.length > 0 && <PriorityRow icon={Clock3} title="Συνδρομές που λήγουν σύντομα" detail={`${summary.expiring.length} πελάτες λήγουν μέσα στις επόμενες 7 ημέρες.`} href="/clients" tone="bg-orange-500/10 text-orange-700 dark:text-orange-400"><Badge variant="secondary">{summary.expiring.length}</Badge></PriorityRow>}{unreadMessages > 0 && canUseMessages && <PriorityRow icon={MessageCircleMore} title="Μηνύματα που περιμένουν απάντηση" detail={`${unreadMessages} αδιάβαστα μηνύματα από πελάτες.`} href="/coach/messages" tone="bg-sky-500/10 text-sky-700 dark:text-sky-400"><Badge variant="secondary">{unreadMessages}</Badge></PriorityRow>}{!birthdayAlerts.length && !Number(updateStats.totalUnread || 0) && !summary.pendingPayments.length && !summary.expiring.length && !unreadMessages && <div className="grid min-h-48 place-items-center text-center"><div><CheckCircle2 className="mx-auto h-9 w-9 text-emerald-600" /><p className="mt-3 font-semibold">Δεν υπάρχει κάτι επείγον</p><p className="mt-1 text-sm text-muted-foreground">Θα εμφανιστούν εδώ νέα updates, πληρωμές και υπενθυμίσεις.</p></div></div>}</CardContent></Card><Card className="shadow-sm"><CardHeader className="border-b"><CardTitle className="text-lg">Κατάσταση πελατών</CardTitle><CardDescription>Γρήγορη εικόνα της βάσης σου.</CardDescription></CardHeader><CardContent className="space-y-5 p-5"><StatusMeter label="Ενεργοί" value={summary.activeClients.length} total={clients.length} tone="bg-emerald-500" /><StatusMeter label="Εκκρεμείς" value={summary.pendingPayments.length} total={clients.length} tone="bg-amber-500" /><StatusMeter label="Ανενεργοί" value={summary.inactiveClients.length} total={clients.length} tone="bg-muted-foreground" /><div className="border-t pt-4 text-xs text-muted-foreground">Οι πελάτες με ληγμένη συνδρομή εμφανίζονται ως ανενεργοί.</div></CardContent></Card></section>
      <section className="grid gap-5 lg:grid-cols-2"><Card className="shadow-sm"><CardHeader className="flex-row items-center justify-between gap-3 border-b"><div><CardTitle className="text-lg">Πρόσφατα updates</CardTitle><CardDescription>Άνοιξε ένα update για πλήρη εικόνα.</CardDescription></div><Button nativeButton={false} render={<Link href="/coach/updates" />} size="sm" className="shrink-0 bg-primary text-primary-foreground hover:bg-primary/90">Όλα <ArrowRight className="ml-1 h-4 w-4" /></Button></CardHeader><CardContent className="divide-y p-0">{updates.length ? updates.map((update) => <Link key={update.id} href={`/coach/updates/${update.id}`} className={cn("flex items-center gap-3 px-5 py-4 transition-colors hover:bg-muted/60", !update.is_read && "bg-primary/[0.035]")}><UserAvatar initials={getInitials(update.client_name || update.client_email)} photoUrl={update.client_photo} size="h-10 w-10" /><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="truncate text-sm font-semibold">{update.client_name || update.client_email || "Πελάτης"}</p>{!update.is_read && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />}</div><p className="mt-0.5 text-xs text-muted-foreground">{formatDate(update.submitted_at, true)}</p></div><ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" /></Link>) : <EmptyPanel icon={ClipboardCheck} text="Δεν υπάρχουν νέα updates για προβολή." />}</CardContent></Card><Card className="shadow-sm"><CardHeader className="flex-row items-center justify-between gap-3 border-b"><div><CardTitle className="text-lg">Πελάτες που χρειάζονται επαφή</CardTitle><CardDescription>Γενέθλια ή συνδρομές που λήγουν σύντομα.</CardDescription></div><Button nativeButton={false} render={<Link href="/clients" />} size="sm" className="shrink-0 bg-primary text-primary-foreground hover:bg-primary/90">Πελάτες <ArrowRight className="ml-1 h-4 w-4" /></Button></CardHeader><CardContent className="divide-y p-0">{birthdayAlerts.map((notification) => { const client = clients.find((item) => item.id === notification.client_id); const clientName = client?.full_name || client?.email || "Πελάτης"; return <Link key={`birthday-contact-${notification.id}`} href={notification.link_url || (notification.client_id ? `/clients/${notification.client_id}` : "/clients")} className="flex items-center gap-3 px-5 py-4 transition-colors hover:bg-muted/60"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"><Gift className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{clientName}</span><span className="block text-xs text-muted-foreground">Γενέθλια σήμερα</span></span><ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" /></Link>; })}{contactClients.map((client) => <div key={client.id} className="flex items-center gap-3 px-5 py-4"><ClientLink client={client} className="min-w-0 flex-1" /><span className="max-w-40 shrink-0 text-right text-xs font-medium text-foreground">{contactReason(client)}</span></div>)}{!birthdayAlerts.length && !contactClients.length && <EmptyPanel icon={BellRing} text="Δεν υπάρχουν γενέθλια ή λήξεις συνδρομών για σήμερα." />}</CardContent></Card></section>
      <section className="flex flex-wrap items-center gap-3 border-t pt-5"><p className="mr-auto text-sm font-medium">Γρήγορη πρόσβαση</p><Button nativeButton={false} render={<Link href="/clients" />} size="sm" variant="outline">Πελάτες</Button><Button nativeButton={false} render={<Link href="/coach/updates" />} size="sm" variant="outline">Updates</Button>{canUseMessages && <Button nativeButton={false} render={<Link href="/coach/messages" />} size="sm" variant="outline">Μηνύματα</Button>}{canSendAnnouncements && <Button nativeButton={false} render={<Link href="/manual-notifications" />} size="sm" variant="outline">Ανακοίνωση</Button>}</section>
    </>}</div></CoachShell>;
}
function StatusMeter({ label, value, total, tone }: { label: string; value: number; total: number; tone: string }) { const percentage = total ? Math.round((value / total) * 100) : 0; return <div><div className="mb-2 flex items-center justify-between text-sm"><span>{label}</span><span className="font-semibold tabular-nums">{value}<span className="font-normal text-muted-foreground"> / {total}</span></span></div><div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className={cn("h-full rounded-full transition-all", tone)} style={{ width: `${percentage}%` }} /></div></div>; }
function EmptyPanel({ icon: Icon, text }: { icon: typeof ClipboardCheck; text: string }) { return <div className="grid min-h-52 place-items-center px-5 text-center"><div><Icon className="mx-auto h-8 w-8 text-muted-foreground" /><p className="mt-3 text-sm font-medium">{text}</p></div></div>; }
function DashboardLoading() { return <div className="space-y-5"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-32" />)}</div><div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(20rem,0.8fr)]"><Skeleton className="h-96" /><Skeleton className="h-96" /></div></div>; }
export default function CoachDashboardPage() { return <ProtectedRoute allow="coach"><CoachDashboardContent /></ProtectedRoute>; }
