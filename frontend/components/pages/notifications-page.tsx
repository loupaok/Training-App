"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Bell, CheckCheck, ChevronRight, CircleDollarSign, ClipboardCheck, Megaphone, MessageCircle, UserPlus, type LucideIcon } from "lucide-react"
import { ProtectedRoute } from "@/components/auth/protected-route"
import { CoachShell } from "@/components/shell/coach-shell"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { clearUnreadNotifications } from "@/lib/notification-count"
import { useAuth } from "@/lib/auth/auth-context"
import { api } from "@/lib/api/client"

type FilterValue = "all" | "payments" | "updates" | "clients" | "announcements"
type NotificationItem = { id: number | string; type?: string; title?: string; body?: string; client_name?: string; client_id?: number | string; link_url?: string | null; created_at?: string; read_at?: string | null }

const filters: { label: string; value: FilterValue }[] = [
  { label: "Όλες", value: "all" }, { label: "Πληρωμές", value: "payments" }, { label: "Updates", value: "updates" }, { label: "Πελάτες", value: "clients" }, { label: "Ανακοινώσεις", value: "announcements" },
]

function NotificationsContent() {
  const { user, logout } = useAuth()
  const router = useRouter()
  const [activeFilter, setActiveFilter] = useState<FilterValue>("all")
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const load = async () => {
    setLoading(true); setError("")
    try { setNotifications(await api.get<NotificationItem[]>("/clients/admin/notifications")) }
    catch (err) { setError(err instanceof Error ? err.message : "Δεν φορτώθηκαν οι ειδοποιήσεις.") }
    finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [])

  const visible = useMemo(() => notifications.filter((item) => matches(item, activeFilter)), [activeFilter, notifications])
  const unread = notifications.filter((item) => !item.read_at).length
  const groups = useMemo(() => groupByDay(visible), [visible])

  const markOne = async (item: NotificationItem) => {
    if (item.read_at) return
    const response = await api.post<{ unread?: number }>(`/clients/notifications/${item.id}/read`)
    window.localStorage.setItem("coachUnreadNotifications", String(response.unread || 0))
    setNotifications((current) => current.map((row) => row.id === item.id ? { ...row, read_at: new Date().toISOString() } : row))
  }
  const open = async (item: NotificationItem) => {
    try { await markOne(item) } catch { /* Keep the notification destination available. */ }
    if (item.link_url) router.push(item.link_url)
  }
  const markAll = async () => {
    await clearUnreadNotifications()
    setNotifications((current) => current.map((item) => ({ ...item, read_at: item.read_at || new Date().toISOString() })))
  }

  return <CoachShell title="Ειδοποιήσεις" user={user} logout={logout}>
    <main className="mx-auto max-w-5xl space-y-6">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><div className="mb-3 grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary"><Bell className="h-5 w-5" /></div><h1 className="text-2xl font-bold">Κέντρο ειδοποιήσεων</h1><p className="mt-1 text-sm text-muted-foreground">Ιστορικό ενεργειών, πληρωμών, updates και ανακοινώσεων.</p></div>
        <Button variant="outline" disabled={!unread} onClick={() => void markAll()}><CheckCheck className="mr-2 h-4 w-4" />Όλα ως αναγνωσμένα</Button>
      </section>

      <div className="grid gap-3 sm:grid-cols-3"><Metric label="Νέες" value={unread} accent /><Metric label="Τελευταίες 30 ημέρες" value={notifications.filter((item) => recent(item.created_at)).length} /><Metric label="Σύνολο ιστορικού" value={notifications.length} /></div>

      <Card><CardHeader className="gap-4 border-b"><div><CardTitle>Ενημερώσεις</CardTitle><CardDescription>Διάλεξε κατηγορία ή άνοιξε μια ειδοποίηση με ενέργεια.</CardDescription></div><div className="flex flex-wrap gap-2">{filters.map((filter) => <Button key={filter.value} size="sm" variant={activeFilter === filter.value ? "default" : "outline"} onClick={() => setActiveFilter(filter.value)}>{filter.label}</Button>)}</div></CardHeader><CardContent className="p-0">
        {loading ? <div className="space-y-4 p-6">{Array.from({ length: 5 }, (_, index) => <Skeleton key={index} className="h-20 w-full" />)}</div> : error ? <p className="p-6 text-sm text-destructive">{error}</p> : groups.length ? <div>{groups.map((group) => <section key={group.label}><div className="bg-muted/40 px-6 py-2.5 text-xs font-semibold text-muted-foreground">{group.label}</div>{group.items.map((item) => <NotificationRow key={item.id} item={item} onOpen={open} />)}</section>)}</div> : <EmptyState />}
      </CardContent></Card>
    </main>
  </CoachShell>
}

function Metric({ label, value, accent = false }: { label: string; value: number; accent?: boolean }) { return <Card size="sm"><CardContent className="p-4"><p className="text-xs text-muted-foreground">{label}</p><p className={`mt-1 text-2xl font-bold ${accent ? "text-primary" : ""}`}>{value}</p></CardContent></Card> }
function NotificationRow({ item, onOpen }: { item: NotificationItem; onOpen: (item: NotificationItem) => void }) {
  const meta = notificationMeta(item.type)
  const Icon = meta.Icon
  const clickable = Boolean(item.link_url)
  return <div className={`flex items-start gap-4 border-b px-5 py-5 last:border-b-0 sm:px-6 ${item.read_at ? "" : "bg-primary/5"}`}><div className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${meta.tone}`}><Icon className="h-4.5 w-4.5" /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{item.title || "Νέα ειδοποίηση"}</p>{!item.read_at && <span className="h-2 w-2 rounded-full bg-primary" />}<Badge variant="secondary" className="font-normal">{meta.label}</Badge></div><p className="mt-1 text-sm leading-6 text-muted-foreground">{item.body || "Δεν υπάρχει πρόσθετη περιγραφή."}</p><div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground"><span>Από: {item.client_name || meta.source}</span><span>{dateLabel(item.created_at)}</span></div></div>{clickable && <Button variant="ghost" size="icon-sm" className="shrink-0" aria-label="Άνοιγμα ειδοποίησης" onClick={() => void onOpen(item)}><ChevronRight className="h-4 w-4" /></Button>}</div>
}
function EmptyState() { return <div className="p-14 text-center"><Bell className="mx-auto h-9 w-9 text-muted-foreground" /><p className="mt-4 font-semibold">Δεν υπάρχουν ειδοποιήσεις εδώ</p><p className="mt-1 text-sm text-muted-foreground">Οι νέες ενημερώσεις θα εμφανίζονται σε αυτή τη λίστα.</p></div> }
function notificationMeta(type = ""): { label: string; source: string; tone: string; Icon: LucideIcon } { if (type.includes("payment")) return { label: "Πληρωμή", source: "Σύστημα πληρωμών", tone: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300", Icon: CircleDollarSign }; if (type.includes("update")) return { label: "Weekly update", source: "Πελάτης", tone: "bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300", Icon: ClipboardCheck }; if (type.includes("broadcast")) return { label: "Ανακοίνωση", source: "Ομάδα υποστήριξης", tone: "bg-violet-100 text-violet-800 dark:bg-violet-500/15 dark:text-violet-300", Icon: Megaphone }; if (type.includes("client")) return { label: "Πελάτης", source: "Σύστημα", tone: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300", Icon: UserPlus }; return { label: "Ενημέρωση", source: "Σύστημα", tone: "bg-muted text-muted-foreground", Icon: MessageCircle } }
function matches(item: NotificationItem, filter: FilterValue) { const type = item.type || ""; return filter === "all" || (filter === "payments" && type.includes("payment")) || (filter === "updates" && type.includes("update")) || (filter === "clients" && type.includes("client")) || (filter === "announcements" && type.includes("broadcast")) }
function recent(value?: string) { return Boolean(value && Date.now() - new Date(value).getTime() <= 30 * 86400000) }
function groupByDay(rows: NotificationItem[]) { const today = new Date(); today.setHours(0, 0, 0, 0); const groups = new Map<string, NotificationItem[]>(); rows.forEach((item) => { const date = new Date(item.created_at || ""); const label = !Number.isNaN(date.getTime()) && date >= today ? "Σήμερα" : "Προηγούμενες"; groups.set(label, [...(groups.get(label) || []), item]) }); return [...groups].map(([label, items]) => ({ label, items })) }
function dateLabel(value?: string) { if (!value) return "Άγνωστη ημερομηνία"; const date = new Date(value); return Number.isNaN(date.getTime()) ? "Άγνωστη ημερομηνία" : date.toLocaleString("el-GR", { dateStyle: "medium", timeStyle: "short" }) }
export default function NotificationsPage() { return <ProtectedRoute><NotificationsContent /></ProtectedRoute> }
