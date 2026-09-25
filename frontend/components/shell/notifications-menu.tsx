"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Bell, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { api } from "@/lib/api/client"
import { buildClientNotifications, type ClientNotificationsResponse } from "@/lib/client-notifications"
import { clearUnreadNotifications, getUnreadNotificationCount, loadUnreadNotificationCount } from "@/lib/notification-count"
import type { AuthUser } from "@/types/auth"

interface AdminNotificationItem { id: number | string; title?: string; body?: string; type?: string; link_url?: string | null; created_at?: string; read_at?: string | null }
interface MenuRow { id: string; title: string; body: string; href: string | null; createdAt?: string; readAt?: string | null; persistent: boolean }

function formatRelative(value?: string): string {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  const minutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60000))
  if (minutes < 1) return "τώρα"
  if (minutes < 60) return `${minutes}λ`
  const hours = Math.round(minutes / 60)
  return hours < 24 ? `${hours}ω` : `${Math.round(hours / 24)}η`
}

function playNotificationChime() {
  try {
    const AudioContextConstructor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioContextConstructor) return

    const context = new AudioContextConstructor()
    const oscillator = context.createOscillator()
    const gain = context.createGain()

    oscillator.type = "sine"
    oscillator.frequency.setValueAtTime(880, context.currentTime)
    gain.gain.setValueAtTime(0.0001, context.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.055, context.currentTime + 0.015)
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.2)
    oscillator.connect(gain)
    gain.connect(context.destination)
    oscillator.start()
    oscillator.stop(context.currentTime + 0.22)
    oscillator.addEventListener("ended", () => void context.close())
  } catch {
    // Browsers can block sound before a user interaction; notifications still appear.
  }
}

export function NotificationsMenu({ user }: { user: AuthUser | null }) {
  const isClient = user?.role === "client"
  const notificationsPath = isClient ? "/client-notifications" : "/notifications"
  const router = useRouter()
  const [unreadCount, setUnreadCount] = useState(() => getUnreadNotificationCount())
  const [rows, setRows] = useState<MenuRow[]>([])
  const [loading, setLoading] = useState(false)
  const [incomingNotification, setIncomingNotification] = useState<MenuRow | null>(null)
  const previousUnreadCount = useRef<number | null>(null)
  const incomingTimeout = useRef<number | null>(null)

  async function fetchRows(): Promise<MenuRow[]> {
    const request = isClient
      ? api.get<ClientNotificationsResponse>("/clients/me/notifications?recent=true").then((data) => buildClientNotifications(data).slice(0, 6).map((item) => ({ id: item.notificationId || item.id, title: item.title, body: item.body, href: item.href, createdAt: item.date, readAt: item.readAt, persistent: Boolean(item.notificationId) })))
      : api.get<AdminNotificationItem[]>("/clients/admin/notifications?recent=true").then((items) => (Array.isArray(items) ? items : []).slice(0, 6).map((item) => ({ id: String(item.id), title: item.title || "Νέα ειδοποίηση", body: item.body || "", href: item.link_url || null, createdAt: item.created_at, readAt: item.read_at || null, persistent: true })))
    return request
  }

  useEffect(() => {
    let active = true
    const updateCount = async () => {
      if (document.visibilityState === "hidden") return
      try {
        const nextCount = await loadUnreadNotificationCount()
        if (!active) return
        if (previousUnreadCount.current !== null && nextCount > previousUnreadCount.current) {
          playNotificationChime()
          void fetchRows().then((nextRows) => {
            const newestUnread = nextRows.find((row) => !row.readAt)
            if (!newestUnread || !active) return
            setIncomingNotification(newestUnread)
            if (incomingTimeout.current) window.clearTimeout(incomingTimeout.current)
            incomingTimeout.current = window.setTimeout(() => setIncomingNotification(null), 7000)
          }).catch(() => {})
        }
        previousUnreadCount.current = nextCount
        setUnreadCount(nextCount)
      } catch {
        if (active) setUnreadCount(getUnreadNotificationCount())
      }
    }
    void updateCount()
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void updateCount()
    }
    const interval = window.setInterval(() => void updateCount(), 10000)
    window.addEventListener("storage", updateCount)
    window.addEventListener("focus", refreshWhenVisible)
    document.addEventListener("visibilitychange", refreshWhenVisible)
    return () => {
      active = false
      window.clearInterval(interval)
      if (incomingTimeout.current) window.clearTimeout(incomingTimeout.current)
      window.removeEventListener("storage", updateCount)
      window.removeEventListener("focus", refreshWhenVisible)
      document.removeEventListener("visibilitychange", refreshWhenVisible)
    }
  }, [])

  async function loadRows() {
    setLoading(true)
    const request = isClient
      ? api.get<ClientNotificationsResponse>("/clients/me/notifications?recent=true").then((data) => buildClientNotifications(data).slice(0, 6).map((item) => ({ id: item.notificationId || item.id, title: item.title, body: item.body, href: item.href, createdAt: item.date, readAt: item.readAt, persistent: Boolean(item.notificationId) })))
      : api.get<AdminNotificationItem[]>("/clients/admin/notifications?recent=true").then((items) => (Array.isArray(items) ? items : []).slice(0, 6).map((item) => ({ id: String(item.id), title: item.title || "Νέα ειδοποίηση", body: item.body || "", href: item.link_url || null, createdAt: item.created_at, readAt: item.read_at || null, persistent: true })))
    try {
      const nextRows = await request
      setRows(nextRows)
    } catch {
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  async function openNotification(row: MenuRow) {
    if (row.persistent && !row.readAt) {
      try {
        const response = await api.post<{ unread?: number }>(`/clients/notifications/${row.id}/read`)
        setUnreadCount(response.unread ?? 0)
        setRows((current) => current.map((item) => item.id === row.id ? { ...item, readAt: new Date().toISOString() } : item))
      } catch { /* Navigation may continue if marking read fails. */ }
    }
    if (row.href) router.push(row.href)
  }

  async function markAllRead() {
    try {
      await clearUnreadNotifications()
      setUnreadCount(0)
      setRows((current) => current.map((row) => ({ ...row, readAt: row.readAt || new Date().toISOString() })))
    } catch {
      // Keep the current UI state when the server cannot confirm the action.
    }
  }

  return <>
    {incomingNotification && <button type="button" onClick={() => { setIncomingNotification(null); void openNotification(incomingNotification) }} className="fixed right-4 top-4 z-[70] w-[min(23rem,calc(100vw-2rem))] rounded-lg border bg-background p-4 text-left shadow-lg transition hover:bg-muted/50"><div className="flex items-start gap-3"><span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-primary" /><span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{incomingNotification.title}</span>{incomingNotification.body && <span className="mt-1 block line-clamp-2 text-xs leading-5 text-muted-foreground">{incomingNotification.body}</span>}</span><ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" /></div></button>}
    <DropdownMenu onOpenChange={(open) => { if (open) void loadRows() }}>
    <DropdownMenuTrigger render={<Button variant="outline" size="icon-sm" className="relative" aria-label="Ειδοποιήσεις"><Bell className="h-5 w-5" />{unreadCount > 0 && <Badge className="absolute -right-1 -top-1 h-5 min-w-5 justify-center rounded-full px-1.5 text-[11px]">{unreadCount > 99 ? "99+" : unreadCount}</Badge>}</Button>} />
    <DropdownMenuContent align="end" className="w-[min(24rem,calc(100vw-1.5rem))]">
      <DropdownMenuGroup><div className="flex items-center justify-between gap-3 px-3 py-2"><DropdownMenuLabel className="p-0">Ειδοποιήσεις</DropdownMenuLabel><Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" disabled={unreadCount === 0} onClick={() => void markAllRead()}>Όλα ως αναγνωσμένα</Button></div></DropdownMenuGroup>
      <DropdownMenuSeparator />
      {loading ? <p className="px-3 py-6 text-center text-sm text-muted-foreground">Φόρτωση...</p> : rows.length === 0 ? <p className="px-3 py-6 text-center text-sm text-muted-foreground">Δεν υπάρχουν ειδοποιήσεις</p> : <div className="flex max-h-[26rem] flex-col overflow-y-auto">{rows.map((row) => <button key={row.id} type="button" onClick={() => void openNotification(row)} className={`flex w-full items-start gap-3 border-b px-3 py-3 text-left transition-colors last:border-b-0 hover:bg-muted/60 ${row.readAt ? "" : "bg-primary/5"}`}><span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${row.readAt ? "bg-transparent" : "bg-primary"}`} /><span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-3"><span className="truncate text-sm font-semibold">{row.title}</span><span className="shrink-0 text-xs text-muted-foreground">{formatRelative(row.createdAt)}</span></span>{row.body && <span className="mt-1 block line-clamp-2 text-xs leading-5 text-muted-foreground">{row.body}</span>}</span>{row.href && <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />}</button>)}</div>}
      <DropdownMenuSeparator />
      <Link href={notificationsPath} className="block px-3 py-2.5 text-center text-sm font-medium text-primary hover:bg-muted/50">Δες όλες τις ειδοποιήσεις</Link>
    </DropdownMenuContent>
    </DropdownMenu>
  </>
}
