"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { ExternalLink, FileText, ImageIcon, MessageCircleMore, Paperclip, Send, UserRound, Video } from "lucide-react"
import { ProtectedRoute } from "@/components/auth/protected-route"
import { CoachShell } from "@/components/shell/coach-shell"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { api } from "@/lib/api/client"
import { useAuth } from "@/lib/auth/auth-context"
import { resolveMediaUrl } from "@/lib/media"

type InboxRow = { client_id: number; client_name: string; client_email: string; profile_photo?: string | null; last_message?: string | null; unread_count: number }
type MessageRow = { id: number; sender_role: "coach" | "client"; body: string; created_at?: string }
type ClientFile = { id: string; type: "photo" | "video" | "proof" | "other"; url: string; name?: string | null; createdAt?: string | null; weightKg?: number | null; linkUrl: string }

function initials(name?: string) { return (name || "Π").split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() }
function timeLabel(value?: string) { return value ? new Date(value).toLocaleString("el-GR", { dateStyle: "short", timeStyle: "short" }) : "" }

function CoachMessagesContent() {
  const { user, logout } = useAuth()
  const [inbox, setInbox] = useState<InboxRow[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [messages, setMessages] = useState<MessageRow[]>([])
  const [draft, setDraft] = useState("")
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [typer, setTyper] = useState<{ name?: string } | null>(null)
  const [filesOpen, setFilesOpen] = useState(false)
  const [files, setFiles] = useState<ClientFile[]>([])
  const [fileFilter, setFileFilter] = useState<"all" | ClientFile["type"]>("all")
  const [filesLoading, setFilesLoading] = useState(false)
  const typingTimeout = useRef<number | null>(null)
  const lastTypingRequest = useRef(0)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const selected = useMemo(() => inbox.find((item) => item.client_id === selectedId) || null, [inbox, selectedId])

  const loadInbox = async () => {
    try {
      const items = await api.get<InboxRow[]>("/clients/messages/inbox")
      setInbox(items)
      setSelectedId((current) => current ?? items[0]?.client_id ?? null)
    } finally { setLoading(false) }
  }
  const loadThread = async (clientId: number) => {
    const rows = await api.get<MessageRow[]>(`/clients/${clientId}/messages`)
    setMessages(rows)
    setInbox((current) => current.map((item) => item.client_id === clientId ? { ...item, unread_count: 0 } : item))
  }
  const loadTyping = (clientId: number) => api.get<{ typer?: { name?: string } | null }>(`/clients/${clientId}/messages/typing`).then((data) => setTyper(data.typer || null)).catch(() => setTyper(null))

  useEffect(() => {
    void loadInbox()
    const interval = window.setInterval(() => { if (document.visibilityState === "visible") void loadInbox() }, 3000)
    return () => window.clearInterval(interval)
  }, [])
  useEffect(() => {
    if (!selectedId) return
    void loadThread(selectedId)
    void loadTyping(selectedId)
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") { void loadThread(selectedId); void loadTyping(selectedId) }
    }, 3000)
    return () => window.clearInterval(interval)
  }, [selectedId])
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }) }, [messages.length, selectedId])

  const signalTyping = (isTyping: boolean) => {
    if (!selectedId) return
    const now = Date.now()
    if (isTyping && now - lastTypingRequest.current < 1200) return
    lastTypingRequest.current = now
    void api.post(`/clients/${selectedId}/messages/typing`, { isTyping, name: user?.fullName || user?.email || "Coach" }).catch(() => {})
  }
  const handleDraftChange = (value: string) => {
    setDraft(value)
    signalTyping(Boolean(value.trim()))
    if (typingTimeout.current) window.clearTimeout(typingTimeout.current)
    if (value.trim()) typingTimeout.current = window.setTimeout(() => signalTyping(false), 2500)
  }
  const send = async () => {
    if (!selectedId || !draft.trim()) return
    setSending(true)
    try {
      await api.post(`/clients/${selectedId}/messages`, { message: draft.trim() })
      setDraft("")
      signalTyping(false)
      await Promise.all([loadThread(selectedId), loadInbox()])
    } finally { setSending(false) }
  }
  const openFiles = async () => {
    if (!selectedId) return
    setFilesOpen(true); setFilesLoading(true)
    try { setFiles(await api.get<ClientFile[]>(`/clients/${selectedId}/files`)) } catch { setFiles([]) } finally { setFilesLoading(false) }
  }
  const visibleFiles = files.filter((file) => fileFilter === "all" || file.type === fileFilter)

  return <CoachShell title="Μηνύματα" user={user} logout={logout}>
    <div className="mx-auto max-w-4xl space-y-4">
      <div><h1 className="text-2xl font-bold">Μηνύματα</h1><p className="mt-1 text-sm text-muted-foreground">Όλες οι συνομιλίες με τους πελάτες σου σε ένα σημείο.</p></div>
      <Card className="overflow-hidden p-0"><div className="grid min-h-[32rem] lg:grid-cols-[15rem_minmax(0,1fr)]">
        <aside className="border-b lg:border-b-0 lg:border-r"><CardHeader className="border-b px-3 py-3"><CardTitle className="text-sm">Συνομιλίες</CardTitle><CardDescription>{inbox.reduce((total, item) => total + item.unread_count, 0)} μη αναγνωσμένα</CardDescription></CardHeader><ScrollArea className="h-[14rem] lg:h-[26rem]"><div className="p-1.5">{loading ? <p className="p-3 text-sm text-muted-foreground">Φόρτωση...</p> : inbox.map((item) => <button key={item.client_id} type="button" onClick={() => setSelectedId(item.client_id)} className={`flex w-full items-center gap-2 rounded-md p-2.5 text-left transition-colors ${selectedId === item.client_id ? "bg-primary/10" : "hover:bg-muted/60"}`}><Avatar className="h-8 w-8"><AvatarImage src={resolveMediaUrl(item.profile_photo)} /><AvatarFallback>{initials(item.client_name)}</AvatarFallback></Avatar><span className="min-w-0 flex-1"><span className="flex items-center gap-1.5"><span className="truncate text-sm font-medium">{item.client_name}</span>{item.unread_count > 0 && <Badge className="ml-auto rounded-full px-1.5 text-[10px]">{item.unread_count}</Badge>}</span><span className="mt-0.5 block truncate text-xs text-muted-foreground">{item.last_message || ""}</span></span></button>)}</div></ScrollArea></aside>
        <section className="flex h-[32rem] min-h-0 flex-col">{selected ? <><CardHeader className="flex-row items-center justify-between border-b px-5 py-4"><div className="flex items-center gap-3"><Avatar className="h-9 w-9"><AvatarImage src={resolveMediaUrl(selected.profile_photo)} /><AvatarFallback>{initials(selected.client_name)}</AvatarFallback></Avatar><div><CardTitle className="text-base">{selected.client_name}</CardTitle><CardDescription>{selected.client_email}</CardDescription></div></div><div className="flex items-center gap-2"><Button variant="outline" size="sm" onClick={() => void openFiles()}><Paperclip className="mr-2 h-4 w-4" />Αρχεία</Button><Button asChild variant="outline" size="sm"><Link href={`/clients/${selected.client_id}?tab=messages`}><UserRound className="mr-2 h-4 w-4" />Προβολή πελάτη</Link></Button></div></CardHeader><ScrollArea className="min-h-0 flex-1"><div className="space-y-3 p-5">{messages.map((message) => <div key={message.id} className={`flex items-end gap-2 ${message.sender_role === "coach" ? "justify-end" : "justify-start"}`}>{message.sender_role === "client" && <Avatar className="h-7 w-7 shrink-0"><AvatarImage src={resolveMediaUrl(selected.profile_photo)} /><AvatarFallback>{initials(selected.client_name)}</AvatarFallback></Avatar>}<div className={`max-w-[80%] rounded-xl px-4 py-3 text-sm ${message.sender_role === "coach" ? "bg-primary text-primary-foreground" : "bg-muted"}`}><p>{message.body}</p><p className={`mt-1 text-[11px] ${message.sender_role === "coach" ? "text-primary-foreground/75" : "text-muted-foreground"}`}>{timeLabel(message.created_at)}</p></div>{message.sender_role === "coach" && <Avatar className="h-7 w-7 shrink-0"><AvatarImage src={resolveMediaUrl(user?.profilePhoto)} /><AvatarFallback>{initials(user?.fullName)}</AvatarFallback></Avatar>}</div>)}<div ref={messagesEndRef} /></div></ScrollArea><div className="border-t p-4">{typer?.name && <p className="mb-2 text-xs text-muted-foreground">{typer.name} πληκτρολογεί...</p>}<div className="flex gap-3"><Textarea value={draft} onChange={(event) => handleDraftChange(event.target.value)} placeholder="Γράψε μια απάντηση..." className="min-h-11 resize-none" /><Button size="icon" onClick={() => void send()} disabled={sending || !draft.trim()} aria-label="Αποστολή μηνύματος"><Send className="h-4 w-4" /></Button></div></div></> : <CardContent className="grid flex-1 place-items-center text-center text-muted-foreground"><div><MessageCircleMore className="mx-auto mb-3 h-10 w-10" /><p>Επίλεξε μια συνομιλία.</p></div></CardContent>}</section>
      </div></Card>
      <Sheet open={filesOpen} onOpenChange={setFilesOpen}><SheetContent className="w-full gap-0 p-0 sm:max-w-[420px]"><SheetHeader className="border-b border-border px-5 py-5"><SheetTitle className="text-[18px] font-extrabold">Αρχεία & φωτογραφίες</SheetTitle><p className="text-xs text-muted-foreground">{selected?.client_name || "Πελάτης"} · από updates, πρόοδο και πληρωμές</p></SheetHeader><div className="flex gap-2 overflow-x-auto border-b border-border px-5 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{([['all', 'Όλα'], ['photo', 'Φωτογραφίες'], ['video', 'Βίντεο'], ['proof', 'Αποδεικτικά']] as const).map(([value, label]) => <button key={value} type="button" onClick={() => setFileFilter(value)} className={`shrink-0 rounded-full px-3 py-2 text-xs font-extrabold ${fileFilter === value ? 'bg-[#0B0B0B] text-white dark:bg-[#B0F90C] dark:text-[#0B0B0B]' : 'bg-muted text-muted-foreground'}`}>{label}</button>)}</div><ScrollArea className="min-h-0 flex-1"><div className="grid grid-cols-2 gap-3 p-5">{filesLoading && <p className="col-span-2 text-sm text-muted-foreground">Φόρτωση αρχείων…</p>}{!filesLoading && !visibleFiles.length && <p className="col-span-2 py-12 text-center text-sm text-muted-foreground">Δεν υπάρχουν αρχεία σε αυτή την κατηγορία.</p>}{visibleFiles.map((file) => { const isImage = file.type === 'photo'; const Icon = file.type === 'proof' ? FileText : file.type === 'video' ? Video : ImageIcon; return <a key={file.id} href={resolveMediaUrl(file.url)} target="_blank" rel="noreferrer" className="group overflow-hidden rounded-[14px] border border-border bg-card"><div className="grid aspect-square place-items-center overflow-hidden bg-muted">{isImage ? <img src={resolveMediaUrl(file.url)} alt={file.name || 'Αρχείο πελάτη'} className="h-full w-full object-cover transition-transform group-hover:scale-105" /> : <Icon className="h-8 w-8 text-muted-foreground" />}</div><div className="p-2.5"><p className="truncate text-[11px] font-extrabold">{file.name || (file.type === 'proof' ? 'Αποδεικτικό πληρωμής' : 'Φωτογραφία προόδου')}</p><p className="mt-1 text-[10px] text-muted-foreground">{file.createdAt ? new Date(file.createdAt).toLocaleDateString('el-GR') : '—'}{file.weightKg ? ` · ${file.weightKg} kg` : ''}</p><Link href={file.linkUrl} onClick={(event) => event.stopPropagation()} className="mt-2 inline-flex items-center gap-1 text-[10px] font-extrabold underline underline-offset-2">Μετάβαση <ExternalLink className="h-3 w-3" /></Link></div></a>})}</div></ScrollArea></SheetContent></Sheet>
    </div>
  </CoachShell>
}

export default function CoachMessagesPage() { return <ProtectedRoute allow="coach"><CoachMessagesContent /></ProtectedRoute> }
