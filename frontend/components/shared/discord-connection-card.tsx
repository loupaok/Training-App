"use client"

import { useEffect, useState } from "react"
import { MessageCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { api } from "@/lib/api/client"

type DiscordStatus = {
  connected: boolean
  discordUsername: string | null
  hasRole: boolean
  subscriptionActive: boolean
  guildUrl: string
}

export function DiscordConnectionCard() {
  const [status, setStatus] = useState<DiscordStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [disconnecting, setDisconnecting] = useState(false)
  const [error, setError] = useState("")

  const load = () => {
    setLoading(true)
    api
      .get<DiscordStatus>("/discord/status")
      .then(setStatus)
      .catch((err) => setError(err instanceof Error ? err.message : "Δεν φορτώθηκε η κατάσταση Discord."))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const disconnect = async () => {
    setDisconnecting(true)
    setError("")
    try {
      await api.delete("/discord/disconnect")
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Δεν έγινε αποσύνδεση.")
    } finally {
      setDisconnecting(false)
    }
  }

  if (loading) return null

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center gap-2 text-lg font-bold">
          <MessageCircle className="h-5 w-5 text-primary" />
          Discord Community
        </div>

        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

        {!status?.connected && (
          <>
            <p className="mt-3 text-sm text-muted-foreground">Σύνδεσε το Discord σου και αποκτήστε πρόσβαση στην αποκλειστική κοινότητα!</p>
            <a href="/api/discord/auth" className="mt-4 inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90">
              Σύνδεση με Discord
            </a>
          </>
        )}

        {status?.connected && status.subscriptionActive && (
          <>
            <p className="mt-2 text-sm font-medium text-emerald-600">✅ Συνδεδεμένος</p>
            <p className="text-sm text-muted-foreground">@{status.discordUsername}</p>
            <p className="mt-3 text-sm text-muted-foreground">Έχεις πρόσβαση σε όλα τα κανάλια! 🎉</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <a href={status.guildUrl} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90">
                Άνοιξε το Discord
              </a>
              <Button variant="outline" onClick={disconnect} disabled={disconnecting}>
                {disconnecting ? "Αποσύνδεση..." : "Αποσύνδεση"}
              </Button>
            </div>
          </>
        )}

        {status?.connected && !status.subscriptionActive && (
          <>
            <p className="mt-2 text-sm font-medium text-amber-600">⚠️ Η συνδρομή σου έληξε</p>
            <p className="text-sm text-muted-foreground">Ανανέωσε για πρόσβαση στα κανάλια της κοινότητας.</p>
            <Button variant="outline" className="mt-4" onClick={disconnect} disabled={disconnecting}>
              {disconnecting ? "Αποσύνδεση..." : "Αποσύνδεση"}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}
