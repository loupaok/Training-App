"use client"

import { useEffect, useMemo, useState } from "react"
import { ArrowUpRight, Check, Copy, Gift, History, ShoppingBag, Target, Trophy } from "lucide-react"
import { ProtectedRoute } from "@/components/auth/protected-route"
import { ClientShell } from "@/components/shell/client-shell"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { api } from "@/lib/api/client"
import { useAuth } from "@/lib/auth/auth-context"
import { useBranding } from "@/contexts/BrandingContext"

type PointsTransaction = { id: number; type: "earned" | "redeemed" | "expired" | "adjusted"; points: number; description: string | null; coupon_code: string | null; created_at: string }
type PointsData = { totalPoints: number; usedPoints: number; availablePoints: number; transactions: PointsTransaction[]; hasMore: boolean }
type PointsSettings = { euro_per_points: number; min_points_redeem: number; is_active: boolean | number; shop_url: string | null }
type RedeemResult = { couponCode: string; discount: number; expiryDate: string }

const dateFormat = new Intl.DateTimeFormat("el-GR", { dateStyle: "short", timeStyle: "short" })
const formatDateTime = (value: string) => dateFormat.format(new Date(value))

const pointsTypeMeta: Record<string, { label: string; dotClass: string }> = {
  earned: { label: "Κέρδισες πόντους", dotClass: "bg-accent" },
  redeemed: { label: "Εξαργύρωση", dotClass: "bg-[#0B0B0B] dark:bg-white" },
  adjusted: { label: "Προσαρμογή από coach", dotClass: "bg-[#6A6A6A]" },
  expired: { label: "Έληξε", dotClass: "bg-[#8A8A8A]" },
}

const PAGE_SIZE = 20

function ClientPointsContent() {
  const { user, logout } = useAuth()
  const { branding } = useBranding()
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
  const redeemRange = points && settings ? Math.max(1, points.availablePoints - settings.min_points_redeem) : 1
  const redeemProgress = points && settings ? Math.min(100, Math.max(0, ((redeemAmount - settings.min_points_redeem) / redeemRange) * 100)) : 0

  const openDialog = (amount?: number) => {
    if (!points || !settings) return
    setCoupon(null)
    setRedeemError("")
    setRedeemAmount(Math.min(points.availablePoints, Math.max(settings.min_points_redeem, amount || 100)))
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
  const eshopUrl = branding.eshopEnabled && /^https:\/\//i.test(branding.eshopUrl || "") ? branding.eshopUrl : null
  const couponOptions = useMemo(() => [5, 10, 20, 30].map((euros) => ({ euros, points: euros * euroPerPoints })), [euroPerPoints])
  const latestCoupon = points?.transactions.find((transaction) => transaction.type === "redeemed" && transaction.coupon_code) || null

  return (
    <ClientShell title="Πόντοι & Rewards" user={user} logout={logout} paymentApproved={paymentApproved} active="points">
      <main className="mx-auto max-w-[var(--container-7xl)] space-y-5 p-4 sm:p-6 lg:p-8">
        <header className="flex flex-col gap-2"><span className="w-fit rounded-full bg-[#0B0B0B] px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-[.8px] text-[#B0F90C] dark:bg-accent dark:text-[#0B0B0B]">Rewards</span><div><h1 className="text-[28px] font-extrabold tracking-[-.6px]">Οι πόντοι μου</h1><p className="mt-1 text-[13px] text-muted-foreground">Κέρδισε πόντους με κάθε πληρωμή και εξαργύρωσέ τους για έκπτωση.</p></div></header>
        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

        {loading ? (
          <Card><CardContent className="p-6 text-sm text-muted-foreground">Φόρτωση πόντων...</CardContent></Card>
        ) : points && settings && Boolean(settings.is_active) ? (
          <>
            <section className="grid gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(19rem,.8fr)]">
              <Card variant="lime" className="min-h-[246px]"><CardContent className="flex h-full flex-col p-[22px]"><div className="flex items-start justify-between gap-4"><span className="grid h-11 w-11 place-items-center rounded-[14px] bg-black/10"><Trophy className="h-5 w-5 text-[#0B0B0B]" /></span><span className="rounded-full bg-[#0B0B0B] px-3 py-1 text-[11px] font-extrabold uppercase tracking-[.7px] text-[#B0F90C]">Διαθέσιμοι</span></div><div className="mt-auto"><p className="text-[13px] font-bold text-black/70">Οι πόντοι σου</p><div className="mt-1 flex flex-wrap items-baseline gap-2"><p className="text-[54px] font-extrabold italic leading-none tracking-[-1.8px] tabular-nums text-[#0B0B0B]">{points.availablePoints}</p><span className="text-[14px] font-bold text-black/70">πόντοι</span></div><p className="mt-2 text-[13px] font-semibold text-black/75">Αξία εξαργύρωσης: {availableEuro.toFixed(2)}€</p></div></CardContent></Card>
              <Card variant="dark"><CardContent className="flex h-full flex-col p-[22px]"><p className="text-[11px] font-extrabold uppercase tracking-[1px] text-neutral-300">Εξαργύρωση</p><p className="mt-2 text-[19px] font-extrabold leading-tight">Μετέτρεψε πόντους σε έκπτωση.</p><p className="mt-2 text-[13px] leading-5 text-neutral-300">{canRedeem ? `Μπορείς να εξαργυρώσεις από ${settings.min_points_redeem} πόντους.` : `Χρειάζεσαι ακόμη ${Math.max(0, settings.min_points_redeem - points.availablePoints)} πόντους.`}</p><Button onClick={() => openDialog()} disabled={!canRedeem} variant="lime" className="mt-auto h-11 w-full rounded-full"><Gift className="mr-2 h-4 w-4" />Εξαργύρωση πόντων</Button></CardContent></Card>
            </section>

            <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
              <Card><CardContent className="p-[22px]"><div className="flex items-center justify-between gap-4"><div><p className="text-[11px] font-extrabold uppercase tracking-[1px] text-muted-foreground">Σύνολο πόντων</p><p className="mt-1 text-[30px] font-extrabold italic leading-none tracking-[-1px] tabular-nums">{points.totalPoints}</p></div><Target className="h-5 w-5 text-muted-foreground" /></div></CardContent></Card>
              <Card><CardContent className="p-[22px]"><div className="flex items-center justify-between gap-4"><div><p className="text-[11px] font-extrabold uppercase tracking-[1px] text-muted-foreground">Έχεις εξαργυρώσει</p><p className="mt-1 text-[30px] font-extrabold italic leading-none tracking-[-1px] tabular-nums">{points.usedPoints}</p></div><Gift className="h-5 w-5 text-muted-foreground" /></div></CardContent></Card>
              {eshopUrl && <a href={eshopUrl} target="_blank" rel="noopener noreferrer" className="group flex min-h-[104px] flex-col justify-between rounded-[20px] border border-border bg-card p-[22px] transition-colors hover:bg-muted"><span className="grid h-8 w-8 place-items-center rounded-full bg-accent text-accent-foreground"><ShoppingBag className="h-4 w-4" /></span><span className="flex items-center justify-between text-[13px] font-extrabold">Στο κατάστημα <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" /></span></a>}
            </section>

            <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_19rem]">
              <Card><CardContent className="p-[22px]"><p className="text-[11px] font-extrabold uppercase tracking-[1px] text-muted-foreground">Κουπόνια για το eshop</p><h2 className="mt-1 text-[20px] font-extrabold">Διάλεξε την αξία σου</h2><div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{couponOptions.map((option) => { const unlocked = points.availablePoints >= option.points; const missing = Math.max(0, option.points - points.availablePoints); return <button key={option.euros} type="button" disabled={!unlocked} onClick={() => openDialog(option.points)} className={`rounded-[16px] border p-4 text-left transition-colors ${unlocked ? "border-border bg-card hover:border-foreground" : "border-border bg-muted/60 text-muted-foreground"}`}><span className="text-[25px] font-extrabold italic">{option.euros}€</span><span className="mt-1 block text-xs font-semibold">{option.points} πόντοι</span>{unlocked ? <span className="mt-4 block text-[11px] font-extrabold text-foreground">Εξαργύρωση →</span> : <><span className="mt-4 block h-1.5 overflow-hidden rounded-full bg-border"><span className="block h-full bg-muted-foreground" style={{ width: `${Math.min(100, (points.availablePoints / option.points) * 100)}%` }} /></span><span className="mt-2 block text-[10px]">Λείπουν {missing} πόντοι</span></>}</button> })}</div></CardContent></Card>
              <Card variant="dark"><CardContent className="p-[22px]"><p className="text-[11px] font-extrabold uppercase tracking-[1px] text-neutral-300">Πώς κερδίζεις πόντους</p><div className="mt-4 space-y-3 text-[13px] text-neutral-200"><p>Με κάθε εγκεκριμένη πληρωμή του προγράμματός σου.</p><p>Οι πόντοι γίνονται μόνο κουπόνια για το eshop — όχι έκπτωση στη συνδρομή.</p></div></CardContent></Card>
            </section>

            {latestCoupon && <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_19rem]"><Card><CardContent className="flex flex-wrap items-center justify-between gap-4 p-[22px]"><div><p className="text-[11px] font-extrabold uppercase tracking-[1px] text-muted-foreground">Το κουπόνι σου</p><p className="mt-2 font-mono text-[20px] font-extrabold tracking-[1px]">{latestCoupon.coupon_code}</p><p className="mt-1 text-xs text-muted-foreground">Δημιουργήθηκε {formatDateTime(latestCoupon.created_at)}</p></div><div className="flex gap-2"><Button variant="outline" onClick={() => navigator.clipboard.writeText(latestCoupon.coupon_code || "")}>Αντιγραφή</Button>{eshopUrl && <a href={eshopUrl} target="_blank" rel="noopener noreferrer"><Button variant="lime">Αγόρασε στο eshop <ArrowUpRight className="ml-1 h-4 w-4" /></Button></a>}</div></CardContent></Card></section>}

            {eshopUrl && <a href={eshopUrl} target="_blank" rel="noopener noreferrer" className="relative block overflow-hidden rounded-[20px] bg-[var(--sp-emphasis)] p-6 text-[var(--sp-emphasis-foreground)] dark:border dark:border-border"><span className="absolute right-12 -top-6 h-52 w-4 -skew-x-[18deg] bg-accent" />{branding.eshopBannerImageUrl && <img src={branding.eshopBannerImageUrl} alt="" className="absolute inset-y-0 right-0 w-1/3 object-cover opacity-45" />}<div className="relative max-w-xl"><p className="text-[24px] font-extrabold">{branding.eshopBannerTitle || "Χρησιμοποίησε τους πόντους σου στο eshop."}</p><p className="mt-2 text-sm text-neutral-200">{branding.eshopBannerText || "Εξαργύρωσέ τους σε κουπόνια για την επόμενη αγορά σου."}</p><span className="mt-5 inline-flex rounded-full bg-accent px-4 py-2 text-sm font-extrabold text-accent-foreground">{branding.eshopButtonText || "Πήγαινε στο eshop"} <ArrowUpRight className="ml-2 h-4 w-4" /></span></div></a>}

            <Card><CardContent className="p-[22px]">
              <div className="mb-6 flex items-center justify-between gap-3"><div><p className="text-[11px] font-extrabold uppercase tracking-[1px] text-muted-foreground">Κινήσεις</p><CardTitle className="mt-1 text-[20px] font-extrabold">Ιστορικό πόντων</CardTitle></div><History className="h-5 w-5 text-muted-foreground" /></div>
                {!points.transactions.length ? (
                  <div className="flex min-h-32 flex-col items-center justify-center gap-3 rounded-[16px] bg-muted/60 text-center text-muted-foreground">
                    <Target className="h-8 w-8" />
                    <p className="text-sm">Δεν υπάρχει ιστορικό ακόμα.</p>
                  </div>
                ) : (
                  <div className="relative ml-2 border-l border-border pl-6">
                    {points.transactions.map((tx) => {
                      const meta = pointsTypeMeta[tx.type] ?? { label: tx.type, dotClass: "bg-[#8A8A8A]" }
                      const signedPoints = tx.type === "redeemed" ? -Math.abs(tx.points) : Math.abs(tx.points)
                      return (
                        <div key={tx.id} className="relative pb-7 last:pb-1">
                          <span className={`absolute -left-[1.84rem] top-1.5 h-3 w-3 rounded-full ring-4 ring-background ${meta.dotClass}`} />
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-medium text-foreground">{meta.label}</p>
                            <p className={`text-sm font-extrabold tabular-nums ${signedPoints < 0 ? "text-muted-foreground" : "text-foreground"}`}>
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
                    <Button variant="outline" className="rounded-full" onClick={loadMore} disabled={loadingMore}>
                      {loadingMore ? "Φόρτωση..." : "Δείτε περισσότερα"}
                    </Button>
                  </div>
                )}
            </CardContent></Card>
          </>
        ) : settings && !settings.is_active ? <Card><CardContent className="flex min-h-52 flex-col items-center justify-center gap-3 p-6 text-center"><span className="grid h-12 w-12 place-items-center rounded-full bg-muted"><Trophy className="h-5 w-5 text-muted-foreground" /></span><div><p className="font-extrabold">Οι πόντοι δεν είναι διαθέσιμοι ακόμη</p><p className="mt-1 text-sm text-muted-foreground">Ο coach σου θα ενεργοποιήσει το πρόγραμμα rewards όταν είναι έτοιμο.</p></div></CardContent></Card> : null}
      </main>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          {coupon ? (
            <>
              <DialogHeader>
                <DialogTitle>Το coupon δημιουργήθηκε</DialogTitle>
                <DialogDescription>Χρησιμοποίησέ το στο επόμενο checkout σου για να λάβεις την έκπτωση.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3 rounded-[16px] border border-dashed border-border bg-muted/60 p-4 text-center">
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
                {eshopUrl && (
                  <a href={eshopUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline">
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
                <DialogTitle>Εξαργύρωση πόντων</DialogTitle>
                <DialogDescription>Έχεις {points.availablePoints} διαθέσιμους πόντους.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="relative flex h-9 items-center">
                  <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 h-2 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-accent" style={{ width: `${redeemProgress}%` }} /></div>
                  <input
                    type="range"
                    min={settings.min_points_redeem}
                    max={Math.max(points.availablePoints, settings.min_points_redeem)}
                    step={10}
                    value={redeemAmount}
                    aria-valuetext={`${redeemAmount} πόντοι, ${discountPreview.toFixed(2)} ευρώ έκπτωση`}
                    onChange={(event) => setRedeemAmount(Number(event.target.value))}
                    className="absolute inset-0 h-9 w-full cursor-grab touch-pan-y appearance-none bg-transparent active:cursor-grabbing focus-visible:outline-none [&::-moz-range-progress]:bg-transparent [&::-moz-range-track]:h-2 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-transparent [&::-moz-range-thumb]:h-6 [&::-moz-range-thumb]:w-6 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-[3px] [&::-moz-range-thumb]:border-background [&::-moz-range-thumb]:bg-accent [&::-moz-range-thumb]:shadow-[0_2px_7px_rgb(11_11_11_/_25%)] [&::-webkit-slider-runnable-track]:h-2 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-transparent [&::-webkit-slider-thumb]:-mt-2 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-[3px] [&::-webkit-slider-thumb]:border-background [&::-webkit-slider-thumb]:bg-accent [&::-webkit-slider-thumb]:shadow-[0_2px_7px_rgb(11_11_11_/_25%)]"
                  />
                </div>
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
    <ProtectedRoute allow="client-dashboard">
      <ClientPointsContent />
    </ProtectedRoute>
  )
}
