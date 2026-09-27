"use client"

import { useEffect, useState } from "react"
import { Check, Copy, Gift, ShoppingBag, Target } from "lucide-react"
import { ProtectedRoute } from "@/components/auth/protected-route"
import { ClientShell } from "@/components/shell/client-shell"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { api } from "@/lib/api/client"
import { useAuth } from "@/lib/auth/auth-context"

type PointsTransaction = { id: number; type: "earned" | "redeemed" | "expired" | "adjusted"; points: number; description: string | null; coupon_code: string | null; created_at: string }
type PointsData = { totalPoints: number; usedPoints: number; availablePoints: number; transactions: PointsTransaction[]; hasMore: boolean }
type PointsSettings = { euro_per_points: number; min_points_redeem: number; is_active: boolean | number; shop_url: string | null }
type RedeemResult = { couponCode: string; discount: number; expiryDate: string }

const dateFormat = new Intl.DateTimeFormat("el-GR", { dateStyle: "short", timeStyle: "short" })
const formatDateTime = (value: string) => dateFormat.format(new Date(value))

const pointsTypeMeta: Record<string, { label: string; dotClass: string }> = {
  earned: { label: "Κέρδισες πόντους", dotClass: "bg-emerald-500" },
  redeemed: { label: "Εξαργύρωση", dotClass: "bg-amber-500" },
  adjusted: { label: "Προσαρμογή από coach", dotClass: "bg-blue-500" },
  expired: { label: "Έληξε", dotClass: "bg-slate-400" },
}

const PAGE_SIZE = 20

function ClientPointsContent() {
  const { user, logout } = useAuth()
  const [points, setPoints] = useState<PointsData | null>(null)
  const [settings, setSettings] = useState<PointsSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState("")

  const [dialogOpen, setDialogOpen] = useState(false)
  const [redeemAmount, setRedeemAmount] = useState(0)
  const [redeeming, setRedeeming] = useState(false)
  const [redeemError, setRedeemError] = useState("")
  const [coupon, setCoupon] = useState<RedeemResult | null>(null)
  const [copied, setCopied] = useState(false)

  const load = async () => {
    setLoading(true)
    setError("")
    try {
      const [pointsResponse, settingsResponse] = await Promise.all([
        api.get<PointsData>(`/points/my?limit=${PAGE_SIZE}&offset=0`),
        api.get<PointsSettings>("/points/settings"),
      ])
      setPoints(pointsResponse)
      setSettings(settingsResponse)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Δεν φορτώθηκαν οι πόντοι σου.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const loadMore = async () => {
    if (!points) return
    setLoadingMore(true)
    try {
      const next = await api.get<PointsData>(`/points/my?limit=${PAGE_SIZE}&offset=${points.transactions.length}`)
      setPoints((current) => (current ? { ...next, transactions: [...current.transactions, ...next.transactions] } : next))
    } catch {
      // best-effort — the button just stays clickable to retry
    } finally {
      setLoadingMore(false)
    }
  }

  const euroPerPoints = settings?.euro_per_points || 100
  const availableEuro = points ? Math.round((points.availablePoints / euroPerPoints) * 100) / 100 : 0
  const canRedeem = Boolean(points && settings && points.availablePoints >= settings.min_points_redeem)
  const discountPreview = Math.round((redeemAmount / euroPerPoints) * 100) / 100

  const openDialog = () => {
    if (!points || !settings) return
    setCoupon(null)
    setRedeemError("")
    setRedeemAmount(Math.min(points.availablePoints, Math.max(settings.min_points_redeem, 100)))
    setDialogOpen(true)
  }

  const submitRedeem = async () => {
    setRedeeming(true)
    setRedeemError("")
    try {
      const result = await api.post<RedeemResult>("/points/redeem", { pointsToRedeem: redeemAmount })
      setCoupon(result)
      await load()
    } catch (err) {
      setRedeemError(err instanceof Error ? err.message : "Δεν ήταν δυνατή η εξαργύρωση.")
    } finally {
      setRedeeming(false)
    }
  }

  const copyCoupon = async () => {
    if (!coupon) return
    await navigator.clipboard.writeText(coupon.couponCode)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  const paymentApproved = user?.status === "active"

  return (
    <ClientShell title="Πόντοι & Rewards" user={user} logout={logout} paymentApproved={paymentApproved} active="points">
      <main className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
        <div>
          <h1 className="text-2xl font-bold">Πόντοι & Rewards</h1>
          <p className="mt-1 text-sm text-muted-foreground">Κέρδισε πόντους με κάθε πληρωμή και εξαργύρωσέ τους για έκπτωση.</p>
        </div>
        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

        {loading ? (
          <div className="text-sm text-muted-foreground">Φόρτωση...</div>
        ) : points && settings ? (
          <>
            <Card className="p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-primary/10">
                    <Target className="h-6 w-6 text-primary" />
                  </span>
                  <div>
                    <p className="text-sm text-muted-foreground">Διαθέσιμοι πόντοι</p>
                    <p className="text-3xl font-bold tabular-nums">{points.availablePoints}</p>
                    <p className="text-xs text-muted-foreground">= {availableEuro.toFixed(2)}€ έκπτωση</p>
                  </div>
                </div>
                <div className="flex flex-col items-stretch gap-2 sm:items-end">
                  <Button onClick={openDialog} disabled={!canRedeem}>
                    <Gift className="mr-2 h-4 w-4" />
                    Εξαργύρωση Πόντων
                  </Button>
                  {!canRedeem && <p className="text-xs text-muted-foreground">Ελάχιστο για εξαργύρωση: {settings.min_points_redeem} πόντοι</p>}
                </div>
              </div>
              <div className="mt-6 grid grid-cols-2 gap-4 border-t border-border pt-4 sm:grid-cols-3">
                <div>
                  <p className="text-xs text-muted-foreground">Σύνολο</p>
                  <p className="text-lg font-bold tabular-nums">{points.totalPoints}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Εξαργυρωμένοι</p>
                  <p className="text-lg font-bold tabular-nums">{points.usedPoints}</p>
                </div>
                {settings.shop_url && (
                  <a href={settings.shop_url} target="_blank" rel="noreferrer" className="col-span-2 flex items-center gap-2 text-sm font-medium text-primary hover:underline sm:col-span-1">
                    <ShoppingBag className="h-4 w-4" />
                    Στο κατάστημα
                  </a>
                )}
              </div>
            </Card>

            <Card className="p-6">
              <CardHeader className="p-0">
                <CardTitle className="text-lg font-semibold">Ιστορικό Πόντων</CardTitle>
              </CardHeader>
              <CardContent className="p-0 pt-6">
                {!points.transactions.length ? (
                  <div className="flex min-h-32 flex-col items-center justify-center gap-3 text-center text-muted-foreground">
                    <Target className="h-8 w-8" />
                    <p className="text-sm">Δεν υπάρχει ιστορικό ακόμα.</p>
                  </div>
                ) : (
                  <div className="relative ml-2 border-l border-border pl-6">
                    {points.transactions.map((tx) => {
                      const meta = pointsTypeMeta[tx.type] ?? { label: tx.type, dotClass: "bg-slate-400" }
                      const signedPoints = tx.type === "redeemed" ? -Math.abs(tx.points) : Math.abs(tx.points)
                      return (
                        <div key={tx.id} className="relative pb-7 last:pb-1">
                          <span className={`absolute -left-[1.84rem] top-1.5 h-3 w-3 rounded-full ring-4 ring-background ${meta.dotClass}`} />
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-medium text-foreground">{meta.label}</p>
                            <p className={`text-sm font-bold tabular-nums ${signedPoints < 0 ? "text-amber-600" : "text-emerald-600"}`}>
                              {signedPoints > 0 ? "+" : ""}
                              {signedPoints}
                            </p>
                          </div>
                          {tx.description && <p className="mt-1 text-sm text-muted-foreground">{tx.description}</p>}
                          {tx.coupon_code && <p className="mt-1 text-xs text-muted-foreground">Coupon: {tx.coupon_code}</p>}
                          <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(tx.created_at)}</p>
                        </div>
                      )
                    })}
                  </div>
                )}
                {points.hasMore && (
                  <div className="mt-6 flex justify-center">
                    <Button variant="outline" onClick={loadMore} disabled={loadingMore}>
                      {loadingMore ? "Φόρτωση..." : "Δείτε περισσότερα"}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        ) : null}
      </main>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          {coupon ? (
            <>
              <DialogHeader>
                <DialogTitle>✅ Coupon δημιουργήθηκε!</DialogTitle>
                <DialogDescription>Χρησιμοποίησέ το στο επόμενο checkout σου για να λάβεις την έκπτωση.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3 rounded-lg border border-dashed border-primary/40 bg-primary/5 p-4 text-center">
                <p className="text-xs font-medium uppercase text-muted-foreground">Κωδικός Coupon</p>
                <p className="text-xl font-bold tracking-wide">{coupon.couponCode}</p>
                <Button variant="outline" size="sm" onClick={copyCoupon}>
                  {copied ? (
                    <>
                      <Check className="mr-2 h-4 w-4" />
                      Αντιγράφηκε
                    </>
                  ) : (
                    <>
                      <Copy className="mr-2 h-4 w-4" />
                      Αντιγραφή
                    </>
                  )}
                </Button>
                <div className="flex justify-center gap-6 pt-2 text-sm">
                  <div>
                    <p className="text-muted-foreground">Αξία</p>
                    <p className="font-semibold">{coupon.discount}€</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Λήγει</p>
                    <p className="font-semibold">{formatDateTime(coupon.expiryDate)}</p>
                  </div>
                </div>
                {settings?.shop_url && (
                  <a href={settings.shop_url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline">
                    <ShoppingBag className="h-4 w-4" />
                    Χρησιμοποίησέ το στο κατάστημα
                  </a>
                )}
              </div>
              <DialogFooter>
                <Button onClick={() => setDialogOpen(false)}>Κλείσιμο</Button>
              </DialogFooter>
            </>
          ) : points && settings ? (
            <>
              <DialogHeader>
                <DialogTitle>🎁 Εξαργύρωση Πόντων</DialogTitle>
                <DialogDescription>Έχεις {points.availablePoints} διαθέσιμους πόντους.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <input
                  type="range"
                  min={settings.min_points_redeem}
                  max={Math.max(points.availablePoints, settings.min_points_redeem)}
                  step={10}
                  value={redeemAmount}
                  onChange={(event) => setRedeemAmount(Number(event.target.value))}
                  className="w-full accent-primary"
                />
                <div className="flex items-center gap-3">
                  <Input
                    type="number"
                    min={settings.min_points_redeem}
                    max={points.availablePoints}
                    value={redeemAmount}
                    onChange={(event) => setRedeemAmount(Math.min(points.availablePoints, Math.max(0, Number(event.target.value) || 0)))}
                    className="w-28"
                  />
                  <p className="text-sm text-muted-foreground">πόντοι</p>
                </div>
                <p className="text-lg font-semibold">= {discountPreview.toFixed(2)}€ έκπτωση</p>
                {redeemError && <p className="text-sm text-destructive">{redeemError}</p>}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Ακύρωση
                </Button>
                <Button onClick={submitRedeem} disabled={redeeming || redeemAmount < settings.min_points_redeem || redeemAmount > points.availablePoints}>
                  {redeeming ? "Δημιουργία..." : "Επιβεβαίωση"}
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </ClientShell>
  )
}

export default function ClientPointsPage() {
  return (
    <ProtectedRoute allow="client-active">
      <ClientPointsContent />
    </ProtectedRoute>
  )
}
