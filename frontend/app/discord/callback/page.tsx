"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2, CheckCircle2, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/api/client"

export default function DiscordCallbackPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const ranRef = useRef(false)
  const [status, setStatus] = useState<"working" | "success" | "error">("working")
  const [message, setMessage] = useState("")

  useEffect(() => {
    if (ranRef.current) return
    ranRef.current = true

    const deniedError = searchParams.get("error")
    const code = searchParams.get("code")

    if (deniedError) {
      setStatus("error")
      setMessage("Ακύρωσες τη σύνδεση με το Discord.")
      return
    }
    if (!code) {
      setStatus("error")
      setMessage("Λείπει ο κωδικός επιβεβαίωσης από το Discord.")
      return
    }

    api
      .get<{ success: boolean; discordUsername: string }>(`/discord/callback?code=${encodeURIComponent(code)}`)
      .then((result) => {
        setStatus("success")
        setMessage(`Συνδέθηκες ως @${result.discordUsername}!`)
        window.setTimeout(() => router.replace("/client-dashboard"), 1800)
      })
      .catch((err) => {
        setStatus("error")
        setMessage(err instanceof Error ? err.message : "Η σύνδεση με το Discord απέτυχε.")
      })
  }, [searchParams, router])

  return (
    <div className="grid min-h-screen place-items-center bg-slate-50 p-6 dark:bg-slate-950">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-8 text-center shadow-sm">
        {status === "working" && (
          <>
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
            <p className="mt-4 text-sm font-medium text-muted-foreground">Σύνδεση με το Discord...</p>
          </>
        )}
        {status === "success" && (
          <>
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
            <p className="mt-4 text-sm font-medium">{message}</p>
            <p className="mt-1 text-xs text-muted-foreground">Μεταφορά στο dashboard...</p>
          </>
        )}
        {status === "error" && (
          <>
            <XCircle className="mx-auto h-10 w-10 text-destructive" />
            <p className="mt-4 text-sm font-medium">{message}</p>
            <Button className="mt-5" onClick={() => router.replace("/client-dashboard")}>
              Πίσω στο Dashboard
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
