"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Check, MessageCircleMore, Send } from "lucide-react"
import { ProtectedRoute } from "@/components/auth/protected-route"
import { ClientShell } from "@/components/shell/client-shell"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/lib/auth/auth-context"
import { api } from "@/lib/api/client"
import { getInitials, resolveMediaUrl } from "@/lib/media"

type MessageRow = { id: number | string; sender_role: "coach" | "client"; body: string; read_at?: string | null; created_at?: string }
type CoachProfile = { full_name?: string; email?: string; profile_photo?: string | null }
type DashboardPeek = { paymentApproved?: boolean }

const quickMessages = ["Έχω ερώτηση για μια άσκηση", "Θέλω αλλαγή στη διατροφή", "Έστειλα το update μου"]

function timeLabel(value?: string) { return value ? new Date(value).toLocaleTimeString("el-GR", { hour: "2-digit", minute: "2-digit" }) : "" }
function dayLabel(value?: string) {
  if (!value) return "ΣΗΜΕΡΑ"
  const date = new Date(value)
  if (date.toDateString() === new Date().toDateString()) return "ΣΗΜΕΡΑ"
  return date.toLocaleDateString("el-GR", { weekday: "long", day: "numeric", month: "short" }).toLocaleUpperCase("el-GR")
}
function sameDay(a?: string, b?: string) { return Boolean(a && b && new Date(a).toDateString() === new Date(b).toDateString()) }

function ClientMessagesContent() {
  const { user, logout } = useAuth()
  const [messages, setMessages] = useState<MessageRow[]>([])
  const [coach, setCoach] = useState<CoachProfile | null>(null)
  const [paymentApproved, setPaymentApproved] = useState(false)
  const [draft, setDraft] = useState("")
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [typer, setTyper] = useState<{ name?: string } | null>(null)
  const typingTimeout = useRef<number | null>(null)
  const lastTypingRequest = useRef(0)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const loadMessages = () => api.get<MessageRow[]>("/clients/me/messages").then(setMessages).catch(() => setMessages([])).finally(() => setLoading(false))

  useEffect(() => {
    void loadMessages()
    void api.get<CoachProfile | null>("/clients/me/messages/coach").then(setCoach).catch(() => setCoach(null))
    void api.get<DashboardPeek>("/client-dashboard").then((data) => setPaymentApproved(Boolean(data.paymentApproved))).catch(() => {})
    const interval = window.setInterval(() => {
      if (document.visibilityState !== "visible") return
      void loadMessages()
      void api.get<{ typer?: { name?: string } | null }>("/clients/me/messages/typing").then((data) => setTyper(data.typer || null)).catch(() => setTyper(null))
    }, 3000)
    return () => { window.clearInterval(interval); if (typingTimeout.current) window.clearTimeout(typingTimeout.current) }
  }, [])
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }) }, [messages.length])

  const signalTyping = (isTyping: boolean) => {
    const now = Date.now()
    if (isTyping && now - lastTypingRequest.current < 1200) return
    lastTypingRequest.current = now
    void api.post("/clients/me/messages/typing", { isTyping, name: user?.fullName || user?.email || "Πελάτης" }).catch(() => {})
  }
  const handleDraftChange = (value: string) => {
    setDraft(value.slice(0, 2000))
    signalTyping(Boolean(value.trim()))
    if (typingTimeout.current) window.clearTimeout(typingTimeout.current)
    if (value.trim()) typingTimeout.current = window.setTimeout(() => signalTyping(false), 2500)
  }
  const sendMessage = async () => {
    const message = draft.trim()
    if (!message || sending) return
    setSending(true); setError("")
    try { await api.post("/clients/me/messages", { message }); setDraft(""); signalTyping(false); await loadMessages() }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Δεν στάλθηκε το μήνυμα.") }
    finally { setSending(false) }
  }

  const coachName = coach?.full_name || "Ο coach σου"
  const renderedMessages = useMemo(() => messages.map((message, index) => ({ ...message, showDay: !sameDay(messages[index - 1]?.created_at, message.created_at), isLastInGroup: messages[index + 1]?.sender_role !== message.sender_role || !sameDay(messages[index + 1]?.created_at, message.created_at) })), [messages])
  return <ClientShell title="Μηνύματα" user={user} logout={logout} paymentApproved={paymentApproved} active="messages">
    <main className="mx-auto max-w-[var(--container-7xl)] space-y-5">
      <header className="hidden sm:block"><h1 className="text-[28px] font-extrabold tracking-[-.5px]">Μηνύματα</h1><p className="mt-1 text-sm text-muted-foreground">Άμεση επικοινωνία με τον coach σου.</p></header>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_19rem]">
        <Card className="flex h-[calc(100dvh-8.5rem)] min-h-[34rem] flex-col overflow-hidden rounded-[20px] border-border bg-card shadow-none sm:h-[min(44rem,calc(100dvh-11rem))]">
          <CardHeader className="flex-row items-center gap-3 border-b border-border px-5 py-4"><div className="relative"><Avatar className="h-11 w-11 bg-[#0B0B0B] text-[#B0F90C]"><AvatarImage src={resolveMediaUrl(coach?.profile_photo)} /><AvatarFallback className="bg-[#0B0B0B] font-extrabold text-[#B0F90C]">{getInitials(coachName)}</AvatarFallback></Avatar><span className="absolute right-0 bottom-0 h-3 w-3 rounded-full border-2 border-card bg-[#B0F90C]" /></div><div className="min-w-0"><CardTitle className="truncate text-[15px] font-extrabold">{coachName}</CardTitle><p className="mt-0.5 text-xs text-muted-foreground">Ο coach σου · συνήθως απαντά μέσα στη μέρα</p></div></CardHeader>
          <CardContent className="min-h-0 flex-1 p-0"><ScrollArea className="h-full"><div className="space-y-3 px-4 py-5 sm:px-5">
            {loading && <p className="py-10 text-center text-sm text-muted-foreground">Φόρτωση συνομιλίας…</p>}
            {!loading && !messages.length && <div className="grid min-h-56 place-items-center text-center"><div><MessageCircleMore className="mx-auto h-9 w-9 text-muted-foreground" /><p className="mt-3 text-sm font-bold">Ξεκίνα τη συζήτηση</p><p className="mt-1 max-w-56 text-xs leading-5 text-muted-foreground">Γράψε στον coach σου για το πρόγραμμα, τη διατροφή ή το update σου.</p></div></div>}
            {renderedMessages.map((message) => <div key={message.id}>{message.showDay && <div className="my-5 flex items-center gap-3"><span className="h-px flex-1 bg-border" /><span className="text-[10px] font-extrabold tracking-[.9px] text-muted-foreground">{dayLabel(message.created_at)}</span><span className="h-px flex-1 bg-border" /></div>}<div className={`flex items-end gap-2 ${message.sender_role === "client" ? "justify-end" : "justify-start"}`}>{message.sender_role === "coach" && <Avatar className="mb-0.5 h-7 w-7 shrink-0 bg-[#0B0B0B]"><AvatarImage src={resolveMediaUrl(coach?.profile_photo)} /><AvatarFallback className="bg-[#0B0B0B] text-[10px] font-extrabold text-[#B0F90C]">{getInitials(coachName)}</AvatarFallback></Avatar>}<div className={`max-w-[80%] sm:max-w-[68%] ${message.sender_role === "client" ? "items-end" : "items-start"}`}><div className={`rounded-[16px] px-4 py-3 text-[13px] leading-[1.5] ${message.sender_role === "client" ? "rounded-br-[5px] bg-[#0B0B0B] text-white" : "rounded-bl-[5px] border border-border bg-card text-foreground"}`}><p className="whitespace-pre-wrap break-words">{message.body}</p></div>{message.isLastInGroup && <p className={`mt-1 flex items-center gap-1 text-[10px] ${message.sender_role === "client" ? "justify-end text-muted-foreground" : "text-muted-foreground"}`}>{timeLabel(message.created_at)}{message.sender_role === "client" && message.read_at && <><Check className="h-3 w-3 text-[#B0F90C]" />Διαβάστηκε</>}</p>}</div></div></div>)}
            {typer?.name && <div className="flex items-center gap-2 pl-9"><span className="flex h-8 items-center gap-1 rounded-full border border-border bg-muted px-3"><span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-.2s]" /><span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-.1s]" /><span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground" /></span><span className="text-[11px] text-muted-foreground">{typer.name} πληκτρολογεί…</span></div>}<div ref={messagesEndRef} />
          </div></ScrollArea></CardContent>
          <div className="border-t border-border bg-card p-3 pb-[max(.75rem,env(safe-area-inset-bottom))] sm:p-4"><div className="-mx-1 mb-3 flex gap-2 overflow-x-auto px-1 pb-1 xl:hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{quickMessages.map((message) => <button key={message} type="button" onClick={() => handleDraftChange(message)} className="shrink-0 rounded-full border border-border bg-muted px-3 py-2 text-[11px] font-bold text-foreground transition-colors hover:bg-secondary">{message}</button>)}</div>{error && <p className="mb-2 text-xs font-semibold text-destructive">{error}</p>}<div className="flex items-end gap-2"><Textarea value={draft} maxLength={2000} onChange={(event) => handleDraftChange(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void sendMessage() } }} placeholder="Γράψε ένα μήνυμα…" className="min-h-11 max-h-28 resize-none rounded-[16px] border-border bg-muted px-4 py-3 text-[13px] shadow-none" /><Button type="button" variant="lime" size="icon" onClick={() => void sendMessage()} disabled={sending || !draft.trim()} aria-label="Αποστολή μηνύματος" className="h-11 w-11 shrink-0 rounded-full"><Send className="h-[17px] w-[17px]" /></Button></div></div>
        </Card>
        <aside className="hidden space-y-4 xl:block"><Card className="relative overflow-hidden rounded-[20px] border-[#0B0B0B] bg-[#0B0B0B] text-white shadow-none"><span aria-hidden className="absolute -right-3 -top-6 h-44 w-3 -skew-x-[18deg] bg-[#B0F90C]" /><CardContent className="relative p-5"><Avatar className="h-12 w-12 bg-[#B0F90C]"><AvatarImage src={resolveMediaUrl(coach?.profile_photo)} /><AvatarFallback className="bg-[#B0F90C] font-extrabold text-[#0B0B0B]">{getInitials(coachName)}</AvatarFallback></Avatar><p className="mt-4 text-[17px] font-extrabold">{coachName}</p><p className="mt-1 text-xs font-semibold text-[#B0F90C]">Head coach · SP Team</p><p className="mt-4 text-[13px] leading-5 text-neutral-300">Γράψε μου για ό,τι αφορά το πρόγραμμα, τη διατροφή ή το update σου.</p></CardContent></Card><Card className="rounded-[20px] border-border bg-card shadow-none"><CardContent className="p-5"><h2 className="text-[15px] font-extrabold">Γρήγορα μηνύματα</h2><div className="mt-3 space-y-2">{quickMessages.map((message) => <button key={message} type="button" onClick={() => handleDraftChange(message)} className="w-full rounded-[13px] border border-border bg-muted px-3 py-3 text-left text-xs font-bold text-foreground transition-colors hover:border-[#0B0B0B] hover:bg-secondary dark:hover:border-[#B0F90C]">{message}</button>)}</div></CardContent></Card></aside>
      </div>
    </main>
  </ClientShell>
}

export default function ClientMessagesPage() { return <ProtectedRoute><ClientMessagesContent /></ProtectedRoute> }
