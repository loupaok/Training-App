"use client"

import { useEffect, useMemo, useState } from "react"
import { ArrowUpRight, Check, Copy, Gift, History, Lock, Minus, Plus, ShoppingBag, Target, Trophy, X } from "lucide-react"
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
import { resolveMediaUrl } from "@/lib/media"

type PointsTransaction = { id: number; type: "earned" | "redeemed" | "expired" | "adjusted"; points: number; description: string | null; coupon_code: string | null; created_at: string }
type PointsData = { totalPoints: number; usedPoints: number; availablePoints: number; transactions: PointsTransaction[]; hasMore: boolean }
type PointsSettings = { euro_per_points: number; min_points_redeem: number; is_active: boolean | number; shop_url: string | null }
type RedeemResult = { couponCode: string; discount: number; expiryDate: string }
type CouponData = { id: number; coupon_code: string; points: number; created_at: string; coupon_expires_at: string | null; coupon_status: "active" | "used" | "expired" | "invalid" }
type CouponsResponse = { synced: boolean; coupons: CouponData[] }

const dateFormat = new Intl.DateTimeFormat("el-GR", { dateStyle: "short", timeStyle: "short" })
const formatDateTime = (value: string) => dateFormat.format(new Date(value))

function ActiveCouponCards({ coupons, euroPerPoints, eshopUrl, eshopButtonText, copied, onCopy }: { coupons: CouponData[]; euroPerPoints: number; eshopUrl: string | null; eshopButtonText: string; copied: boolean; onCopy: (code: string) => void }) {
  const activeCoupons = [...coupons]
    .filter((coupon) => coupon.coupon_status === "active")
    .sort((a, b) => {
      const aExpiry = a.coupon_expires_at ? new Date(a.coupon_expires_at).getTime() : Number.MAX_SAFE_INTEGER
      const bExpiry = b.coupon_expires_at ? new Date(b.coupon_expires_at).getTime() : Number.MAX_SAFE_INTEGER
      return aExpiry - bExpiry || new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })

  if (!activeCoupons.length) return null

  return <Card className="rounded-[20px] border-border shadow-none"><CardContent className="space-y-3 p-5 px-[22px]"><div className="flex items-center justify-between"><h2 className="text-[16px] font-extrabold">Ενεργά κουπόνια</h2><span className="rounded-full bg-[color:var(--sp-lime-soft)] px-2 py-1 text-[11px] font-extrabold">{activeCoupons.length}</span></div><div className="space-y-3">{activeCoupons.map((coupon) => <div key={coupon.id} className="rounded-[14px] border border-border bg-muted/50 p-3"><div className="flex items-center justify-between gap-2"><span className="text-[13px] font-extrabold">{(coupon.points / euroPerPoints).toFixed(2)} €</span>{coupon.coupon_expires_at && <span className="text-[11px] font-semibold text-muted-foreground">Λήγει {new Intl.DateTimeFormat("el-GR", { dateStyle: "short" }).format(new Date(coupon.coupon_expires_at))}</span>}</div><div className="mt-2 flex items-center justify-between gap-2"><span className="min-w-0 truncate font-mono text-[13px] font-bold tracking-[.5px]">{coupon.coupon_code}</span><Button size="sm" onClick={() => onCopy(coupon.coupon_code)} className="h-8 shrink-0 rounded-full bg-foreground px-3 text-[12px] text-background">{copied ? <Check className="mr-1 h-3.5 w-3.5" /> : <Copy className="mr-1 h-3.5 w-3.5" />}{copied ? "Αντιγράφηκε" : "Αντιγραφή"}</Button></div></div>)}</div><p className="text-[12px] leading-[1.45] text-muted-foreground">Εμφανίζονται μόνο τα κουπόνια που δεν έχουν χρησιμοποιηθεί και δεν έχουν λήξει.</p>{eshopUrl && <a href={eshopUrl} target="_blank" rel="noopener noreferrer" className="flex h-[46px] items-center justify-center gap-2 rounded-full bg-accent text-[14px] font-extrabold text-accent-foreground"><ShoppingBag className="h-4 w-4" />{eshopButtonText} <ArrowUpRight className="h-4 w-4" /></a>}</CardContent></Card>
}

const pointsTypeMeta: Record<string, { label: string; dotClass: string }> = {
  earned: { label: "Κέρδισες πόντους", dotClass: "bg-accent" },
  redeemed: { label: "Εξαργύρωση", dotClass: "bg-[#0B0B0B] dark:bg-white" },
  adjusted: { label: "Προσαρμογή από coach", dotClass: "bg-[#6A6A6A]" },
  expired: { label: "Έληξε", dotClass: "bg-[#8A8A8A]" },
}

const PAGE_SIZE = 10

type PointsReferenceProps = {
  points: PointsData
  settings: PointsSettings
  couponOptions: Array<{ euros: number; points: number }>
  availableEuro: number
  eshopUrl: string | null
  branding: ReturnType<typeof useBranding>["branding"]
  redeemAmount: number
  discountPreview: number
  canRedeem: boolean
  coupons: CouponData[]
  copied: boolean
  onCopy: (code?: string | null) => void
  onOpenRedeem: (amount?: number) => void
  onAmountChange: (amount: number) => void
  historyFilter: "all" | "earned" | "redeemed"
  onHistoryFilter: (value: "all" | "earned" | "redeemed") => void
  onLoadMore: () => void
  loadingMore: boolean
}

function PointsReferenceLayout({ points, settings, couponOptions, availableEuro, eshopUrl, branding, redeemAmount, discountPreview, canRedeem, coupons, copied, onCopy, onOpenRedeem, onAmountChange, historyFilter, onHistoryFilter, onLoadMore, loadingMore }: PointsReferenceProps) {
  const minimum = settings.min_points_redeem
  const amount = Math.min(points.availablePoints, Math.max(minimum, redeemAmount || minimum))
  const progress = points.availablePoints ? Math.min(100, (amount / points.availablePoints) * 100) : 0
  const transactions = points.transactions.filter((transaction) => historyFilter === "all" || transaction.type === historyFilter || (historyFilter === "earned" && transaction.type === "adjusted"))
  const eshopButtonText = branding.eshopButtonText?.trim() || "Πήγαινε στο eshop"
  return <div className="space-y-5">
    <header><h1 className="text-[28px] font-extrabold tracking-[-.5px]">Πόντοι &amp; Rewards</h1><p className="mt-1 text-[14px] text-muted-foreground">Κέρδισε πόντους με κάθε πληρωμή και εξαργύρωσέ τους σε κουπόνια για το SP Team eshop.</p></header>
    <div className="grid gap-5 xl:grid-cols-3">
      <div className="space-y-5 xl:col-span-2">
        <Card variant="lime" className="relative overflow-hidden rounded-[22px] border-0 shadow-none"><CardContent className="relative space-y-[22px] p-7 sm:p-[30px]"><span aria-hidden="true" className="absolute inset-y-0 right-[230px] hidden w-[22px] -skew-x-[18deg] bg-foreground lg:block" /><div className="relative"><div><p className="text-[11px] font-extrabold uppercase tracking-[1px] text-accent-foreground">Διαθέσιμοι πόντοι</p><p className="mt-1 text-[64px] font-extrabold italic leading-none tracking-[-2px] text-accent-foreground">{points.availablePoints.toLocaleString("el-GR")}</p><p className="mt-2 text-[15px] font-bold text-accent-foreground">= {availableEuro.toFixed(2)} € σε κουπόνια για το eshop</p></div></div><div className="relative grid gap-3 sm:grid-cols-3"><div className="rounded-[14px] bg-black/[.08] p-[14px] px-4"><p className="text-[12px] font-bold text-accent-foreground">Κερδισμένοι συνολικά</p><p className="mt-1 text-[22px] font-extrabold text-accent-foreground">{points.totalPoints.toLocaleString("el-GR")}</p></div><div className="rounded-[14px] bg-black/[.08] p-[14px] px-4"><p className="text-[12px] font-bold text-accent-foreground">Εξαργυρωμένοι</p><p className="mt-1 text-[22px] font-extrabold text-accent-foreground">{points.usedPoints.toLocaleString("el-GR")}</p></div><div className="rounded-[14px] bg-foreground p-[14px] px-4"><p className="text-[12px] font-bold text-accent">Με την επόμενη πληρωμή</p><p className="mt-1 text-[15px] font-extrabold text-background">Νέοι πόντοι <span className="text-[12px] font-semibold text-neutral-400">· βάσει πλάνου</span></p></div></div></CardContent></Card>
        <Card className="rounded-[20px] border-border shadow-none"><CardContent className="space-y-[18px] p-6"><div className="flex flex-wrap items-baseline justify-between gap-2"><h2 className="text-[18px] font-extrabold">Κουπόνια για το eshop</h2><p className="text-[12px] text-muted-foreground">{settings.euro_per_points} πόντοι = 1 € κουπόνι</p></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{couponOptions.map((option) => { const unlocked = points.availablePoints >= option.points; const missing = Math.max(0, option.points - points.availablePoints); return <button key={option.euros} type="button" disabled={!unlocked} onClick={() => onOpenRedeem(option.points)} className={`flex min-h-[154px] flex-col rounded-[16px] border p-[14px] text-left ${unlocked ? "border-border bg-card" : "border-[#ECECEA] bg-muted opacity-75"}`}><span className="flex items-center justify-between"><b className="text-[20px] font-extrabold italic">{option.euros} €</b><span className={`grid h-[30px] w-[30px] place-items-center rounded-[10px] ${unlocked ? "bg-accent text-accent-foreground" : "text-muted-foreground"}`}>{unlocked ? <Gift className="h-[15px] w-[15px]" /> : <Lock className="h-[15px] w-[15px]" />}</span></span><span className="mt-2 text-[12px] font-bold text-muted-foreground">{option.points.toLocaleString("el-GR")} πόντοι</span>{unlocked ? <span className="mt-auto grid h-[34px] place-items-center rounded-full border-[1.5px] border-foreground text-[12px] font-extrabold">Επιλογή</span> : <span className="mt-auto"><span className="block h-[5px] overflow-hidden rounded-full bg-[#E2E2DE]"><span className="block h-full rounded-full bg-accent" style={{ width: `${Math.min(100, (points.availablePoints / option.points) * 100)}%` }} /></span><span className="mt-2 block text-[11px] text-muted-foreground">σου λείπουν {missing.toLocaleString("el-GR")}</span></span>}</button> })}</div><div className="space-y-3 rounded-[16px] bg-muted p-[18px] px-5"><div className="flex flex-wrap items-center justify-between gap-3"><p className="text-[15px] font-extrabold">Ή διάλεξε πόσους πόντους θα εξαργυρώσεις</p><span className="rounded-[10px] border border-border bg-card px-3 py-1.5 text-[14px] font-extrabold">{amount.toLocaleString("el-GR")} <small className="text-[12px] font-semibold text-muted-foreground">πόντοι</small></span></div><div className="relative flex h-7 items-center"><span className="absolute inset-x-0 h-2.5 rounded-full bg-[#E2E2DE]" /><span className="absolute left-0 z-0 h-2.5 rounded-full bg-accent" style={{ width: `max(0px, calc(${progress}% - ${(28 * progress) / 100}px))` }} /><input aria-label="Πόντοι προς εξαργύρωση" type="range" min={minimum} max={Math.max(minimum, points.availablePoints)} step={Math.max(1, Math.floor(minimum / 10))} value={amount} onChange={(event) => onAmountChange(Number(event.target.value))} className="absolute inset-0 z-10 h-7 w-full cursor-pointer appearance-none bg-transparent [&::-moz-range-thumb]:h-7 [&::-moz-range-thumb]:w-7 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-4 [&::-moz-range-thumb]:border-background [&::-moz-range-thumb]:bg-foreground [&::-moz-range-thumb]:shadow-lg [&::-webkit-slider-thumb]:-mt-[9px] [&::-webkit-slider-thumb]:h-7 [&::-webkit-slider-thumb]:w-7 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-4 [&::-webkit-slider-thumb]:border-background [&::-webkit-slider-thumb]:bg-foreground [&::-webkit-slider-thumb]:shadow-lg" /></div><div className="flex justify-between text-[12px] text-muted-foreground"><span>{minimum} · {(minimum / settings.euro_per_points).toFixed(0)} €</span><span>{points.availablePoints.toLocaleString("el-GR")} · {availableEuro.toFixed(0)} € (όλοι)</span></div></div><div className="flex flex-col gap-4 rounded-[18px] bg-foreground p-4 pl-[22px] text-background sm:flex-row sm:items-center"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-[14px] bg-accent text-accent-foreground"><Gift className="h-[22px] w-[22px]" /></span><div className="flex-1"><p className="text-[18px] font-extrabold">Κουπόνι {discountPreview.toFixed(2)} € για το eshop</p><p className="mt-0.5 text-[12px] text-neutral-400">−{amount.toLocaleString("el-GR")} πόντοι · υπόλοιπο μετά: <b className="text-background">{Math.max(0, points.availablePoints - amount).toLocaleString("el-GR")}</b> · ισχύει για μία αγορά</p></div><Button onClick={() => onOpenRedeem(amount)} disabled={!canRedeem || amount > points.availablePoints} variant="lime" className="h-[50px] rounded-full px-[22px] text-[15px]">Εξαργύρωση {amount.toLocaleString("el-GR")} πόντων <ArrowUpRight className="ml-2 h-4 w-4" /></Button></div></CardContent></Card>
      </div>
      <aside className="space-y-5"><ActiveCouponCards coupons={coupons} euroPerPoints={settings.euro_per_points} eshopUrl={eshopUrl} eshopButtonText={eshopButtonText} copied={copied} onCopy={(code) => onCopy(code)} /><Card className="rounded-[20px] border-border shadow-none"><CardContent className="p-5 px-[22px]"><h2 className="text-[16px] font-extrabold">Πώς κερδίζεις πόντους</h2><div className="mt-2 divide-y divide-border/70">{[["Μηνιαία συνδρομή", "σε κάθε πληρωμή", "Π"], ["Πακέτο 3 / 6 μηνών", "μια φορά, με την αγορά", "+"], ["Bonus ανανέωσης", "αν ανανεώσεις πριν τη λήξη", "↻"]].map(([title, detail, icon]) => <div key={title} className="flex items-center gap-3 py-3"><span className="grid h-[38px] w-[38px] place-items-center rounded-[12px] bg-muted text-[15px] font-extrabold">{icon}</span><span className="min-w-0 flex-1"><b className="block text-[14px]">{title}</b><small className="text-[12px] text-muted-foreground">{detail}</small></span></div>)}</div></CardContent></Card></aside>
    </div>
    {eshopUrl && <a href={eshopUrl} target="_blank" rel="noopener noreferrer" className="relative flex min-h-[170px] overflow-hidden rounded-[22px] bg-foreground p-[26px] px-7 text-background"><>{branding.eshopBannerImageUrl && <img src={resolveMediaUrl(branding.eshopBannerImageUrl)} alt="" className="absolute inset-y-0 right-0 h-full w-[46%] object-cover opacity-55" />}</><span className="absolute right-[30%] -top-[30px] h-[260px] w-[14px] -skew-x-[16deg] bg-accent" /><span className="absolute inset-y-0 right-0 w-[46%] bg-gradient-to-r from-foreground via-foreground/50 to-transparent" /><div className="relative max-w-[520px]"><p className="text-[11px] font-extrabold uppercase tracking-[1px] text-accent">SP Team eshop</p><h2 className="mt-2 text-[26px] font-extrabold italic leading-[1.05] tracking-[-.6px] text-white">{branding.eshopBannerTitle || "ΧΡΗΣΙΜΟΠΟΙΗΣΕ ΤΟΥΣ ΠΟΝΤΟΥΣ ΣΟΥ ΣΤΟ"}{" "}<span className="text-accent">{branding.eshopBannerAccentText || "ESHOP."}</span></h2><p className="mt-2 text-[13px] leading-5 text-neutral-300">{branding.eshopBannerText || "Συμπληρώματα, αξεσουάρ και ρούχα που προτείνει η ομάδα μας. Εξαργύρωσε πόντους σε κουπόνι και βάλε το στο ταμείο."}</p><span className="mt-4 inline-flex h-[46px] items-center gap-2 rounded-full bg-accent px-5 text-[14px] font-extrabold text-accent-foreground"><ShoppingBag className="h-[17px] w-[17px]" />{branding.eshopButtonText || "Πήγαινε στο eshop"} <ArrowUpRight className="h-[15px] w-[15px]" /></span></div></a>}
    <Card className="rounded-[20px] border-border shadow-none"><CardContent className="p-5 px-6 pb-2"><div className="flex flex-col justify-between gap-4 border-b border-border pb-3 sm:flex-row sm:items-center"><h2 className="text-[18px] font-extrabold">Ιστορικό πόντων</h2><div className="flex w-fit rounded-[12px] bg-muted p-1">{[["all", "Όλα"], ["earned", "Κερδισμένοι"], ["redeemed", "Εξαργυρώσεις"]].map(([value, label]) => <button key={value} type="button" onClick={() => onHistoryFilter(value as "all" | "earned" | "redeemed")} className={`h-8 rounded-[9px] px-[14px] text-[13px] font-bold ${historyFilter === value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>{label}</button>)}</div></div><div className="hidden grid-cols-[36px_1.6fr_1.4fr_.9fr_.7fr] gap-4 border-b border-border py-2.5 text-[10px] font-extrabold tracking-[1px] text-muted-foreground md:grid"><span /><span>ΚΙΝΗΣΗ</span><span>ΚΟΥΠΟΝΙ</span><span>ΗΜΕΡΟΜΗΝΙΑ</span><span className="text-right">ΠΟΝΤΟΙ</span></div>{transactions.length ? transactions.map((transaction) => { const redeemed = transaction.type === "redeemed"; const signed = redeemed ? -Math.abs(transaction.points) : Math.abs(transaction.points); return <div key={transaction.id} className="grid gap-3 border-b border-border/70 py-3 md:grid-cols-[36px_1.6fr_1.4fr_.9fr_.7fr] md:items-center md:gap-4"><span className={`grid h-9 w-9 place-items-center rounded-full ${redeemed ? "bg-foreground text-background" : "bg-accent text-accent-foreground"}`}>{redeemed ? <Gift className="h-4 w-4" /> : <Plus className="h-4 w-4" />}</span><div><p className="text-[14px] font-bold">{transaction.description || (redeemed ? "Εξαργύρωση κουπονιού eshop" : "Κερδισμένοι πόντοι")}</p><p className="text-[12px] text-muted-foreground md:hidden">{formatDateTime(transaction.created_at)}</p></div><div>{transaction.coupon_code && <span className="inline-flex rounded-[8px] border border-border bg-muted px-2 py-1 font-mono text-[12px]">{transaction.coupon_code}</span>}</div><span className="hidden text-[12px] text-muted-foreground md:block">{formatDateTime(transaction.created_at)}</span><span className="text-right text-[16px] font-extrabold">{signed > 0 ? "+" : "−"}{Math.abs(signed).toLocaleString("el-GR")}</span></div> }) : <p className="py-12 text-center text-sm text-muted-foreground">Δεν υπάρχει ιστορικό πόντων ακόμη.</p>}{points.hasMore && <button type="button" disabled={loadingMore} onClick={onLoadMore} className="flex w-full justify-center py-3 text-[13px] font-extrabold disabled:opacity-50">{loadingMore ? "Φόρτωση..." : "Περισσότερα ↓"}</button>}</CardContent></Card>
  </div>
}

function ClientPointsContent() {
  const { user, logout } = useAuth()
  const { branding } = useBranding()
  const [points, setPoints] = useState<PointsData | null>(null)
  const [settings, setSettings] = useState<PointsSettings | null>(null)
  const [coupons, setCoupons] = useState<CouponData[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState("")

  const [dialogOpen, setDialogOpen] = useState(false)
  const [redeemAmount, setRedeemAmount] = useState(0)
  const [redeeming, setRedeeming] = useState(false)
  const [redeemError, setRedeemError] = useState("")
  const [coupon, setCoupon] = useState<RedeemResult | null>(null)
  const [copied, setCopied] = useState(false)
  const [historyFilter, setHistoryFilter] = useState<"all" | "earned" | "redeemed">("all")

  const load = async () => {
    setLoading(true)
    setError("")
    try {
      const [pointsResponse, settingsResponse, couponsResponse] = await Promise.all([
        api.get<PointsData>(`/points/my?limit=${PAGE_SIZE}&offset=0`),
        api.get<PointsSettings>("/points/settings"),
        api.get<CouponsResponse>("/points/my/coupons").catch(() => ({ synced: false, coupons: [] })),
      ])
      setPoints(pointsResponse)
      setSettings(settingsResponse)
      setCoupons(couponsResponse.coupons)
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

  const copyCoupon = async (couponCode?: string | null) => {
    const code = couponCode ?? coupon?.couponCode
    if (!code) return
    await navigator.clipboard.writeText(code)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  const paymentApproved = user?.status === "active"
  const eshopUrl = branding.eshopEnabled && /^https:\/\//i.test(branding.eshopUrl || "") ? branding.eshopUrl : null
  const couponOptions = useMemo(() => [5, 10, 20, 30].map((euros) => ({ euros, points: euros * euroPerPoints })), [euroPerPoints])
  // Used only by the legacy hidden layout kept in this file during the redesign.
  const latestCoupon = points?.transactions.find((transaction) => transaction.type === "redeemed" && transaction.coupon_code) || null

  return (
    <ClientShell title="Πόντοι & Rewards" user={user} logout={logout} paymentApproved={paymentApproved} active="points">
      <main className="mx-auto max-w-[var(--container-7xl)] space-y-5 p-4 sm:p-6 lg:p-8">
        <header className="hidden flex-col gap-2"><span className="w-fit rounded-full bg-[#0B0B0B] px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-[.8px] text-[#B0F90C] dark:bg-accent dark:text-[#0B0B0B]">Rewards</span><div><h1 className="text-[28px] font-extrabold tracking-[-.6px]">Οι πόντοι μου</h1><p className="mt-1 text-[13px] text-muted-foreground">Κέρδισε πόντους με κάθε πληρωμή και εξαργύρωσέ τους για έκπτωση.</p></div></header>
        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

        {loading ? (
          <Card><CardContent className="p-6 text-sm text-muted-foreground">Φόρτωση πόντων...</CardContent></Card>
        ) : points && settings && Boolean(settings.is_active) ? (
          <>
            <PointsReferenceLayout points={points} settings={settings} couponOptions={couponOptions} availableEuro={availableEuro} eshopUrl={eshopUrl} branding={branding} redeemAmount={redeemAmount} discountPreview={discountPreview} canRedeem={canRedeem} coupons={coupons} copied={copied} onCopy={copyCoupon} onOpenRedeem={openDialog} onAmountChange={setRedeemAmount} historyFilter={historyFilter} onHistoryFilter={setHistoryFilter} onLoadMore={loadMore} loadingMore={loadingMore} />
            <div className="hidden">
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
            </div>
          </>
        ) : settings && !settings.is_active ? <Card><CardContent className="flex min-h-52 flex-col items-center justify-center gap-3 p-6 text-center"><span className="grid h-12 w-12 place-items-center rounded-full bg-muted"><Trophy className="h-5 w-5 text-muted-foreground" /></span><div><p className="font-extrabold">Οι πόντοι δεν είναι διαθέσιμοι ακόμη</p><p className="mt-1 text-sm text-muted-foreground">Ο coach σου θα ενεργοποιήσει το πρόγραμμα rewards όταν είναι έτοιμο.</p></div></CardContent></Card> : null}
      </main>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent
          initialFocus={false}
          finalFocus={false}
          className={`relative w-[calc(100%-2rem)] max-w-[460px] rounded-[26px] border-0 bg-card p-[30px] shadow-[0_30px_80px_rgba(0,0,0,.3)] ${coupon ? "min-h-[560px]" : ""}`}
        >
          {coupon ? (
            <>
              <DialogHeader>
                <DialogTitle>Το coupon δημιουργήθηκε</DialogTitle>
                <DialogDescription>Χρησιμοποίησέ το στο επόμενο checkout σου για να λάβεις την έκπτωση.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3 rounded-[16px] border border-dashed border-border bg-muted/60 p-4 text-center">
                <p className="text-xs font-medium uppercase text-muted-foreground">Κωδικός Coupon</p>
                <p className="text-xl font-bold tracking-wide">{coupon.couponCode}</p>
                <Button variant="outline" size="sm" onClick={() => void copyCoupon()}>
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
          {coupon ? (
            <div className="absolute inset-0 z-10 flex flex-col items-center gap-4 rounded-[26px] bg-card px-[30px] py-[30px] text-center">
              <button type="button" aria-label="Κλείσιμο" onClick={() => setDialogOpen(false)} className="absolute right-[18px] top-[18px] grid h-9 w-9 place-items-center rounded-full bg-muted text-foreground transition-colors hover:bg-border">
                <X className="h-4 w-4" />
              </button>
              <span className="grid h-[72px] w-[72px] place-items-center rounded-full bg-accent text-accent-foreground shadow-[0_0_0_10px_rgba(176,249,12,.25)]">
                <Check className="h-[34px] w-[34px]" strokeWidth={3} />
              </span>
              <div className="max-w-[350px] space-y-1.5">
                <h2 className="text-[26px] font-extrabold italic tracking-[-.6px]">Έτοιμο!</h2>
                <p className="text-[14px] leading-[1.5] text-muted-foreground">Εξαργύρωσες <b className="text-foreground">{redeemAmount.toLocaleString("el-GR")} πόντους</b> για <b className="text-foreground">κουπόνι {coupon.discount.toFixed(2)} €</b> στο eshop.</p>
              </div>
              <div className="flex w-full flex-col gap-2 rounded-[16px] border-2 border-dashed border-foreground bg-muted p-[18px]">
                <p className="text-[11px] font-extrabold uppercase tracking-[1px] text-muted-foreground">Ο κωδικός σου</p>
                <p className="font-mono text-[22px] font-extrabold tracking-[1px] text-foreground">{coupon.couponCode}</p>
                <Button size="sm" onClick={() => void copyCoupon(coupon.couponCode)} className="mx-auto h-[34px] rounded-full bg-[#0B0B0B] px-[14px] text-[12px] text-white hover:bg-[#262626]">
                  {copied ? <Check className="mr-1.5 h-[13px] w-[13px]" /> : <Copy className="mr-1.5 h-[13px] w-[13px]" />}
                  {copied ? "Αντιγράφηκε" : "Αντιγραφή κωδικού"}
                </Button>
              </div>
              <p className="max-w-[360px] text-[13px] leading-[1.5] text-muted-foreground">Βάλε τον κωδικό στο ταμείο του eshop. Θα τον βρεις πάντα και στο «Το κουπόνι σου».</p>
              {eshopUrl ? <a href={eshopUrl} target="_blank" rel="noopener noreferrer" className="flex h-[54px] w-full items-center justify-center gap-2 rounded-full bg-accent text-[16px] font-extrabold text-accent-foreground transition-colors hover:bg-accent/85"><ShoppingBag className="h-[18px] w-[18px]" />Αγόρασε στο eshop <ArrowUpRight className="h-4 w-4" /></a> : null}
              <button type="button" onClick={() => setDialogOpen(false)} className="text-[13px] font-extrabold text-foreground hover:underline">Πίσω στους πόντους</button>
            </div>
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
