"use client"

import { useEffect, useRef, useState } from "react"
import { Send } from "lucide-react"
import { ProtectedRoute } from "@/components/auth/protected-route"
import { ClientShell } from "@/components/shell/client-shell"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/lib/auth/auth-context"
import { api } from "@/lib/api/client"
import { resolveMediaUrl } from "@/lib/media"

type MessageRow = { id: number | string; sender_role: "coach" | "client"; body: string; created_at?: string }
type CoachProfile = { full_name?: string; email?: string; profile_photo?: string | null }
type DashboardPeek = { paymentApproved?: boolean }

function formatDateTime(value?: string) {
  return value ? new Date(value).toLocaleString("el-GR", { dateStyle: "short", timeStyle: "short" }) : ""
}

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
      if (document.visibilityState === "visible") {
        void loadMessages()
        void api.get<{ typer?: { name?: string } | null }>("/clients/me/messages/typing").then((data) => setTyper(data.typer || null)).catch(() => setTyper(null))
      }
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
    setDraft(value)
    signalTyping(Boolean(value.trim()))
    if (typingTimeout.current) window.clearTimeout(typingTimeout.current)
    if (value.trim()) typingTimeout.current = window.setTimeout(() => signalTyping(false), 2500)
  }

  const sendMessage = async () => {
    if (!draft.trim()) return
    setSending(true)
    setError("")
    try {
      await api.post("/clients/me/messages", { message: draft.trim() })
      setDraft("")
      signalTyping(false)
      await loadMessages()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Δεν στάλθηκε το μήνυμα.")
    } finally { setSending(false) }
  }

  const coachName = coach?.full_name || "Ο coach σου"
  return <ClientShell title="Μηνύματα" user={user} logout={logout} paymentApproved={paymentApproved} active="messages">
    <div className="mx-auto max-w-4xl space-y-6">
      <div><h1 className="text-2xl font-bold">Μηνύματα</h1><p className="mt-1 text-sm text-muted-foreground">Άμεση επικοινωνία με τον coach σου.</p></div>
      <Card className="overflow-hidden p-0">
        <CardHeader className="flex-row items-center gap-3 border-b px-5 py-4">
          <Avatar className="h-10 w-10"><AvatarImage src={resolveMediaUrl(coach?.profile_photo)} /><AvatarFallback>{coachName.slice(0, 1)}</AvatarFallback></Avatar>
          <div><CardTitle className="text-base">{coachName}</CardTitle><p className="text-xs text-muted-foreground">Η συνομιλία σας</p></div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[30rem]"><div className="space-y-3 p-5">
            {loading && <p className="text-sm text-muted-foreground">Φόρτωση...</p>}
            {!loading && !messages.length && <p className="text-sm text-muted-foreground">Δεν υπάρχουν μηνύματα ακόμα.</p>}
            {messages.map((message) => <div key={message.id} className={`flex items-end gap-2 ${message.sender_role === "client" ? "justify-end" : "justify-start"}`}>
              {message.sender_role === "coach" && <Avatar className="h-7 w-7 shrink-0"><AvatarImage src={resolveMediaUrl(coach?.profile_photo)} /><AvatarFallback>{coachName.slice(0, 1)}</AvatarFallback></Avatar>}
              <div className={`max-w-[80%] rounded-xl px-4 py-3 text-sm ${message.sender_role === "client" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}><p>{message.body}</p><p className={`mt-1 text-[11px] ${message.sender_role === "client" ? "text-primary-foreground/75" : "text-muted-foreground"}`}>{formatDateTime(message.created_at)}</p></div>
              {message.sender_role === "client" && <Avatar className="h-7 w-7 shrink-0"><AvatarImage src={resolveMediaUrl(user?.profilePhoto)} /><AvatarFallback>{(user?.fullName || "Ε").slice(0, 1)}</AvatarFallback></Avatar>}
            </div>)}
            <div ref={messagesEndRef} />
          </div></ScrollArea>
          <div className="border-t p-4">
            {error && <p className="mb-3 text-sm text-destructive">{error}</p>}
            {typer?.name && <p className="mb-2 text-xs text-muted-foreground">{typer.name} πληκτρολογεί...</p>}
            <div className="flex gap-3"><Textarea value={draft} onChange={(event) => handleDraftChange(event.target.value)} placeholder="Γράψε ένα μήνυμα..." className="min-h-11 resize-none" /><Button type="button" size="icon" onClick={() => void sendMessage()} disabled={sending || !draft.trim()} aria-label="Αποστολή μηνύματος"><Send className="h-4 w-4" /></Button></div>
          </div>
        </CardContent>
      </Card>
    </div>
  </ClientShell>
}

export default function ClientMessagesPage() { return <ProtectedRoute><ClientMessagesContent /></ProtectedRoute> }
