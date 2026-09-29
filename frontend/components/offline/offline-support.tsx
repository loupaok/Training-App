"use client"

import { useEffect } from "react"
import { toast } from "sonner"
import { useAuth } from "@/lib/auth/auth-context"
import { syncOfflineWorkouts } from "@/lib/offline-client"

export function OfflineSupport() {
  const { user } = useAuth()

  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {})
  }, [])

  useEffect(() => {
    if (user?.role !== "client") return
    const sync = async () => {
      const count = await syncOfflineWorkouts(user.id)
      if (count) toast.success(`${count} προπόνηση${count === 1 ? "" : "ες"} συγχρονίστηκε.`)
    }
    void sync()
    window.addEventListener("online", sync)
    return () => window.removeEventListener("online", sync)
  }, [user?.id, user?.role])

  return null
}
