"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Bell, CheckCheck, ChevronRight, Inbox, Settings2, type LucideIcon } from "lucide-react"
import { ProtectedRoute } from "@/components/auth/protected-route"
import { ClientShell } from "@/components/shell/client-shell"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { clearUnreadNotifications } from "@/lib/notification-count"
import { useAuth } from "@/lib/auth/auth-context"
import { api } from "@/lib/api/client"
import { buildClientNotifications, type ClientNotificationRow, type ClientNotificationsResponse } from "@/lib/client-notifications"

type FilterValue = "all" | "payments" | "programs" | "announcements"
const filters: { label: string; value: FilterValue }[] = [{ label: "Όλες", value: "all" }, { label: "Πληρωμές", value: "payments" }, { label: "Προγράμματα", value: "programs" }, { label: "Ανακοινώσεις", value: "announcements" }]
type NotificationPreference = { category: "payments" | "programs" | "nutrition" | "messages" | "points"; pushEnabled: boolean; emailEnabled: boolean }
const defaultPreferences: NotificationPreference[] = [
  { category: "payments", pushEnabled: true, emailEnabled: true },
  { category: "programs", pushEnabled: true, emailEnabled: false },
  { category: "nutrition", pushEnabled: true, emailEnabled: false },
  { category: "messages", pushEnabled: true, emailEnabled: false },
  { category: "points", pushEnabled: true, emailEnabled: false },
]
const preferenceLabels: Record<NotificationPreference["category"], string> = { payments: "Πληρωμές & συνδρομή", programs: "Αλλαγές προγράμματος", nutrition: "Διατροφή & συμπληρώματα", messages: "Μηνύματα", points: "Πόντοι" }

function ClientNotificationsContent() {
  const { user, logout } = useAuth()
  const router = useRouter()
  const [data, setData] = useState<ClientNotificationsResponse | null>(null)
  const [filter, setFilter] = useState<FilterValue>("all")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [preferences, setPreferences] = useState<NotificationPreference[]>(defaultPreferences)
  const [savingPreferences, setSavingPreferences] = useState(false)

  const load = async () => {
    setLoading(true); setError("")
    try {
      const [notificationData, preferenceData] = await Promise.all([
        api.get<ClientNotificationsResponse>("/clients/me/notifications"),
        api.get<{ preferences?: NotificationPreference[] }>("/clients/me/notification-preferences"),
      ])
      setData(notificationData)
      if (preferenceData.preferences?.length) setPreferences(preferenceData.preferences)
    }
    catch (err) { setError(err instanceof Error ? err.message : "Δεν φορτώθηκαν οι ειδοποιήσεις.") }
    finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [])

  const notifications = useMemo(() => buildClientNotifications(data), [data])
  const visible = useMemo(() => notifications.filter((item) => matches(item, filter)), [notifications, filter])
  const unread = data?.unreadNotifications || 0

  const markRead = async (item: ClientNotificationRow) => {
    if (!item.notificationId || item.readAt) return
    const response = await api.post<{ unread?: number }>(`/clients/notifications/${item.notificationId}/read`)
    setData((current) => current ? { ...current, unreadNotifications: response.unread || 0, notifications: current.notifications?.map((row) => String(row.id) === item.notificationId ? { ...row, read_at: row.read_at || new Date().toISOString() } : row) } : current)
  }
  const open = async (item: ClientNotificationRow) => {
    try { await markRead(item) } catch { /* A link may still be useful while offline. */ }
    if (item.href) router.push(item.href)
  }
  const markAll = async () => {
    await clearUnreadNotifications()
    setData((current) => current ? { ...current, unreadNotifications: 0, notifications: current.notifications?.map((item) => ({ ...item, read_at: item.read_at || new Date().toISOString() })) } : current)
  }

  const updatePreference = async (category: NotificationPreference["category"], field: "pushEnabled" | "emailEnabled", value: boolean) => {
    const next = preferences.map((preference) => preference.category === category ? { ...preference, [field]: value } : preference)
    setPreferences(next)
    setSavingPreferences(true)
    try { await api.put("/clients/me/notification-preferences", { preferences: next }) }
    catch (err) { setPreferences(preferences); setError(err instanceof Error ? err.message : "Δεν αποθηκεύτηκαν οι προτιμήσεις.") }
    finally { setSavingPreferences(false) }
  }

  return <ClientShell title="Ειδοποιήσεις" user={user} logout={logout} paymentApproved={Boolean(data?.paymentApproved)} unreadNotifications={unread} active="notifications">
    <main className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><div className="mb-3 grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary"><Bell className="h-5 w-5" /></div><h1 className="text-2xl font-bold">Κέντρο ειδοποιήσεων</h1><p className="mt-1 text-sm text-muted-foreground">Πληρωμές, προγράμματα και ανακοινώσεις από την ομάδα σου.</p></div><Button variant="outline" disabled={!unread} onClick={() => void markAll()}><CheckCheck className="mr-2 h-4 w-4" />Όλα ως αναγνωσμένα</Button></section>
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <Card className="rounded-[20px] border-border bg-card shadow-none"><CardHeader className="gap-4 border-b"><div className="flex items-center justify-between gap-3"><div><CardTitle>Ιστορικό</CardTitle><CardDescription>{unread ? `${unread} νέες ειδοποιήσεις` : "Είσαι ενημερωμένος"}</CardDescription></div>{unread > 0 && <Badge className="rounded-full bg-accent text-accent-foreground">Νέες</Badge>}</div><Tabs value={filter} onValueChange={(value) => setFilter(value as FilterValue)}><TabsList className="h-auto max-w-full flex-wrap justify-start"><>{filters.map((item) => <TabsTrigger key={item.value} value={item.value}>{item.label}</TabsTrigger>)}</></TabsList></Tabs></CardHeader><CardContent className="p-0">
        {loading ? <div className="space-y-4 p-6">{Array.from({ length: 5 }, (_, index) => <Skeleton key={index} className="h-20 w-full" />)}</div> : error ? <p className="p-6 text-sm text-destructive">{error}</p> : visible.length ? <div>{visible.map((item) => <NotificationRow key={item.id} item={item} onOpen={open} />)}</div> : <div className="p-14 text-center"><Inbox className="mx-auto h-9 w-9 text-muted-foreground" /><p className="mt-4 font-semibold">Δεν υπάρχουν ειδοποιήσεις</p><p className="mt-1 text-sm text-muted-foreground">Οι νέες ενημερώσεις από τον coach θα εμφανίζονται εδώ.</p></div>}
      </CardContent></Card>
      <NotificationPreferences preferences={preferences} saving={savingPreferences} onChange={updatePreference} />
      </div>
    </main>
  </ClientShell>
}

function NotificationPreferences({ preferences, saving, onChange }: { preferences: NotificationPreference[]; saving: boolean; onChange: (category: NotificationPreference["category"], field: "pushEnabled" | "emailEnabled", value: boolean) => void }) {
  return <Card className="rounded-[20px] border-border bg-card shadow-none lg:sticky lg:top-6"><CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-[15px] font-extrabold"><Settings2 className="h-4 w-4" />Τι θέλεις να λαμβάνεις</CardTitle></CardHeader><CardContent className="px-5 pb-4 pt-0"><div className="grid grid-cols-[minmax(0,1fr)_44px_44px] gap-2 border-b border-border pb-2 text-center text-[10px] font-extrabold tracking-[1px] text-muted-foreground"><span /><span>PUSH</span><span>EMAIL</span></div>{preferences.map((preference) => <div key={preference.category} className="grid grid-cols-[minmax(0,1fr)_44px_44px] items-center gap-2 border-b border-border py-3 last:border-b-0"><p className="text-[13px] font-semibold leading-4">{preferenceLabels[preference.category]}</p><div className="flex justify-center"><Switch aria-label={`Push: ${preferenceLabels[preference.category]}`} checked={preference.pushEnabled} disabled={saving} onCheckedChange={(checked) => void onChange(preference.category, "pushEnabled", checked)} /></div><div className="flex justify-center">{preference.category === "payments" ? <Switch aria-label="Email: Πληρωμές & συνδρομή" checked={preference.emailEnabled} disabled={saving} onCheckedChange={(checked) => void onChange(preference.category, "emailEnabled", checked)} /> : <span className="text-xs text-muted-foreground">—</span>}</div></div>)}</CardContent></Card>
}

function NotificationRow({ item, onOpen }: { item: ClientNotificationRow; onOpen: (item: ClientNotificationRow) => void }) {
  const Icon = item.icon as LucideIcon
  return <div className={`flex items-start gap-4 border-b px-5 py-5 last:border-b-0 sm:px-6 ${item.readAt ? "" : "bg-primary/5"}`}><div className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${item.tone}`}><Icon className="h-4.5 w-4.5" /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{item.title}</p>{!item.readAt && <span className="h-2 w-2 rounded-full bg-primary" />}</div><p className="mt-1 text-sm leading-6 text-muted-foreground">{item.body}</p><p className="mt-2 text-xs text-muted-foreground">Από: {sourceFor(item.type)} · {item.date}</p></div>{item.href && <Button variant="ghost" size="icon-sm" className="shrink-0" aria-label="Άνοιγμα ειδοποίησης" onClick={() => void onOpen(item)}><ChevronRight className="h-4 w-4" /></Button>}</div>
}
function matches(item: ClientNotificationRow, filter: FilterValue) { const type = item.type || ""; return filter === "all" || (filter === "payments" && type.includes("payment")) || (filter === "programs" && (type.includes("training") || type.includes("nutrition"))) || (filter === "announcements" && type === "admin_broadcast") }
function sourceFor(type = "") { if (type === "admin_broadcast") return "Ομάδα υποστήριξης"; if (type === "coach_message" || type.includes("training") || type.includes("nutrition")) return "Ο coach σου"; return "Σύστημα" }
export default function ClientNotificationsPage() { return <ProtectedRoute><ClientNotificationsContent /></ProtectedRoute> }
