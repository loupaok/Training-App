"use client"

import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  Activity,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Dumbbell,
  FileText,
  Flame,
  Salad,
  Send,
  Sparkles,
  Target,
  Gift,
  Upload,
  ImagePlus,
  LockKeyhole,
  Paperclip,
  Download,
  Play,
  ShoppingCart,
  X,
} from "lucide-react"
import { AreaChart } from "@tremor/react"
import { ProtectedRoute } from "@/components/auth/protected-route"
import { ClientShell } from "@/components/shell/client-shell"
import { StarRating } from "@/components/shared/star-rating"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { DiscordConnectionCard } from "@/components/shared/discord-connection-card"
import { api } from "@/lib/api/client"
import { useAuth } from "@/lib/auth/auth-context"
import { resolveMediaUrl } from "@/lib/media"
import { greekCaps } from "@/lib/utils"

type Question = {
  id: number
  question: string
  type: string
  isRequired: boolean
  options?: string[]
  placeholder?: string | null
  allowPhotos?: boolean
  allowPdf?: boolean
  maxPhotos?: number
}

type UpdateFile = {
  file: File
  questionId: number
  angle?: "front" | "side" | "back" | "other"
}

const updatePhotoAngles = [
  { key: "front", label: "Μπροστά" },
  { key: "side", label: "Πλάι" },
  { key: "back", label: "Πίσω" },
] as const

type Update = {
  id: number
  submittedAt: string
  weekStart: string
  answers?: Array<{ question: string; type: string; answer: string | null }>
  weight?: number | null
  photos: string[]
}

type DashboardData = {
  client: {
    firstName: string
    currentWeight: number | null
    subscriptionStatus: string | null
    daysRemaining: number | null
    planName: string | null
    subscriptionStartDate?: string | null
    subscriptionEndDate?: string | null
    subscriptionCancelledAt?: string | null
    birthdayToday?: boolean
  }
  todayIsUpdateDay: boolean
  alreadySubmittedThisWeek: boolean
  nextUpdateDate: string | null
  streak: number
  updatesCount: number
  lastUpdate: { submittedAt: string; averageRating: number | null } | null
  lastWeightUpdate?: { submittedAt: string } | null
}

type TrainingPlan = {
  id: number
  title: string
  start_date?: string | null
  days: Array<{ id: number; name: string; title?: string | null; exercises: Array<{ name: string; sets?: number | string; reps?: string; rest_seconds?: number | string | null; muscle_group?: string | null; imageUrl?: string | null }> }>
} | null

type NutritionFood = { id?: number; name: string; quantity?: string | null; amount?: string | null; food_category?: string | null; food_image?: string | null; food_image_url?: string | null; image_url?: string | null; calories?: number | string | null; protein_g?: number | string | null; carbs_g?: number | string | null; fat_g?: number | string | null }
type NutritionMeal = { id?: number; foods: NutritionFood[] }
type NutritionPlanPreview = { id: number; title: string; updated_at?: string | null; daily_calories?: number | string | null; protein_g?: number | string | null; carbs_g?: number | string | null; fat_g?: number | string | null; meals: NutritionMeal[] } | null
type WorkoutLog = { id: number; training_plan_id: number; day_number: number; day_name?: string | null; completed_at: string; duration_seconds?: number | null }
type ActiveWorkout = { id: number; training_plan_id: number; day_number: number; day_name?: string | null; started_at: string } | null

type Payment = { id: number; amount: number; method: string; status: string; paidAt: string; notes?: string | null }
type PaymentData = { subscription: { planName?: string | null; price?: number | null; endDate?: string | null; daysRemaining?: number | null; status?: string | null } | null; payments: Payment[] }

type PointsData = { totalPoints: number; usedPoints: number; availablePoints: number }
type PointsSettings = { euro_per_points: number; min_points_redeem: number; is_active: boolean | number }

const dateFormat = new Intl.DateTimeFormat("el-GR", { day: "numeric", month: "short", year: "numeric" })
const defaultTrainingDayNames = new Set(["Κυριακή", "Δευτέρα", "Τρίτη", "Τετάρτη", "Πέμπτη", "Παρασκευή", "Σάββατο"])

function trainingDayDisplayTitle(day: NonNullable<TrainingPlan>["days"][number], index: number) {
  const customName = day.name || day.title
  if (customName?.trim() && !defaultTrainingDayNames.has(customName.trim()) && !/^(ημέρα|day|μέρα)\s*\d+$/i.test(customName.trim())) return customName.trim()
  const groups = day.exercises
    .map((exercise) => exercise.muscle_group || "")
    .filter(Boolean)
    .map((group) => group.split("/")[0].split(",")[0].trim())
  const unique = [...new Set(groups)]
  return unique.length ? unique.slice(0, 3).join(" & ") : `Ημέρα ${index + 1}`
}
const paymentMethod: Record<string, string> = { card: "Κάρτα", bank: "Τραπεζικό Έμβασμα", stripe: "Stripe", cash: "Μετρητά" }

function formatDate(date: string | null | undefined) {
  return date ? dateFormat.format(new Date(date)) : "-"
}

function PlanCard({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return <Card><CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-lg">{icon}{title}</CardTitle></CardHeader><CardContent>{children}</CardContent></Card>
}

function DashboardQuickLink({ href, title, description, icon: Icon }: { href: string; title: string; description: string; icon: typeof Dumbbell }) {
  return <Link href={href} className="group flex min-h-32 flex-col justify-between rounded-[20px] border border-border bg-card p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-foreground"><span className="grid h-10 w-10 place-items-center rounded-xl bg-muted transition-colors group-hover:bg-accent"><Icon className="h-5 w-5 transition-transform duration-200 group-hover:scale-110" /></span><span><span className="flex items-center justify-between gap-3 text-base font-extrabold">{title}<ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-foreground" /></span><span className="mt-1 block text-sm text-muted-foreground">{description}</span></span></Link>
}

function PointsWidget() {
  const [points, setPoints] = useState<PointsData | null>(null)
  const [settings, setSettings] = useState<PointsSettings | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.get<PointsData>("/points/my"),
      api.get<PointsSettings>("/points/settings"),
    ])
      .then(([pointsResponse, settingsResponse]) => {
        setPoints(pointsResponse)
        setSettings(settingsResponse)
      })
      .catch(() => {
        // best-effort widget — a points-system hiccup shouldn't break the dashboard
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading || !points || !settings || !settings.is_active) return null

  const euroPerPoints = settings.euro_per_points || 100
  const availableEuro = Math.round((points.availablePoints / euroPerPoints) * 100) / 100

  return (
    <Link href="/client-points" className="group relative flex min-h-[218px] flex-col gap-2 overflow-hidden rounded-[20px] bg-accent p-[22px] text-black transition-transform hover:-translate-y-0.5">
      <span aria-hidden="true" className="absolute right-[30px] -top-5 h-[200px] w-3.5 -skew-x-[18deg] bg-black/90" />
      <p className="relative text-xs font-extrabold uppercase tracking-[1px]">Οι πόντοι μου</p>
      <div className="relative flex items-baseline gap-2"><p className="text-[40px] font-extrabold italic leading-none tracking-[-1px] tabular-nums">{points.availablePoints}</p><span className="text-[13px] font-semibold">πόντοι · {availableEuro.toFixed(2)}€</span></div>
      <p className="relative max-w-[220px] text-[13px] font-medium leading-[1.5]">Με την επόμενη πληρωμή κερδίζεις τους πρώτους σου πόντους.</p>
      <span className="relative mt-auto inline-flex h-[38px] w-fit items-center rounded-full bg-black px-4 text-[13px] font-bold text-white">Δες τις ανταμοιβές <ArrowRight className="ml-1.5 h-4 w-4 transition-transform group-hover:translate-x-1" /></span>
    </Link>
  )
}

function ModernOverview({ dashboard, trainingPlan, nutritionPlan, onOpenUpdate }: { dashboard: DashboardData | null; trainingPlan: TrainingPlan; nutritionPlan: NutritionPlanPreview; onOpenUpdate: () => void }) {
  const client = dashboard?.client
  const updateReady = dashboard?.todayIsUpdateDay && !dashboard.alreadySubmittedThisWeek
  const updateDone = dashboard?.alreadySubmittedThisWeek
  const nextUpdate = formatDate(dashboard?.nextUpdateDate)
  const daysRemaining = client?.daysRemaining
  const subscriptionActive = client?.subscriptionStatus === "active" || client?.subscriptionStatus === "expiring_soon"
  const startDate = client?.subscriptionStartDate ? new Date(client.subscriptionStartDate) : null
  const endDate = client?.subscriptionEndDate ? new Date(client.subscriptionEndDate) : null
  const totalDays = startDate && endDate ? Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / 86400000)) : 1
  const elapsedDays = startDate ? Math.max(0, Math.ceil((Date.now() - startDate.getTime()) / 86400000)) : 0
  const subscriptionProgress = Math.min(100, Math.max(0, (elapsedDays / totalDays) * 100))
  const remainingRatio = daysRemaining == null ? 1 : Math.max(0, daysRemaining / totalDays)
  const progressColor = remainingRatio > 0.5 ? "[&_[data-slot=progress-indicator]]:bg-emerald-500" : remainingRatio >= 0.2 ? "[&_[data-slot=progress-indicator]]:bg-amber-500" : "[&_[data-slot=progress-indicator]]:bg-red-500"

  return <div className="space-y-6">
    {client?.birthdayToday && (
      <Alert className="relative overflow-hidden rounded-2xl border-0 bg-black px-5 py-4">
        <span aria-hidden="true" className="pointer-events-none" style={{ position: "absolute", right: "17px", top: "-13px", width: "14px", height: "120px", background: "#b0f90c", transform: "skewX(-18deg)" }} />
        <div className="relative flex items-start gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-lime-400">
            <Gift className="h-6 w-6 text-black" />
          </span>
          <div>
            <AlertTitle className="text-base font-bold text-white">Χρόνια πολλά, {client.firstName}!</AlertTitle>
            <AlertDescription className="mt-1 text-gray-400">Σου ευχόμαστε μια δυνατή νέα χρονιά — από όλο το SP Team.</AlertDescription>
          </div>
        </div>
      </Alert>
    )}
    <Card variant="action" className="rounded-[20px]">
      <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_15rem] lg:items-center">
        <div><div className="flex items-center gap-2 text-sm font-medium text-muted-foreground"><Sparkles className="h-4 w-4 text-primary" />Η σημερινή σου εικόνα</div><h2 className="mt-3 text-2xl font-bold tracking-normal">{updateReady ? "Ώρα για το εβδομαδιαίο σου update" : updateDone ? "Το update σου καταχωρήθηκε" : trainingPlan ? "Η προπόνησή σου είναι έτοιμη" : "Ξεκίνα με σταθερό ρυθμό"}</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{updateReady ? "Συμπλήρωσε σε λίγα λεπτά πώς πήγε η εβδομάδα σου, για να έχει ο coach σου την πλήρη εικόνα." : updateDone ? `Το επόμενο check-in σου είναι στις ${nextUpdate}.` : trainingPlan ? `${trainingPlan.title} είναι διαθέσιμο για την επόμενη προπόνησή σου.` : "Ο coach σου θα προσθέσει σύντομα το προσωπικό σου πρόγραμμα."}</p><div className="mt-5">{updateReady ? <Button onClick={onOpenUpdate}><Send className="mr-2 h-4 w-4" />Συμπλήρωση update</Button> : trainingPlan ? <Link href="/client-program" className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90">Άνοιγμα προπόνησης<ArrowRight className="ml-2 h-4 w-4" /></Link> : <Link href="/client-messages" className="inline-flex h-9 items-center rounded-md border border-input bg-background px-4 text-sm font-medium shadow-sm transition-colors hover:bg-accent">Επικοινωνία με coach</Link>}</div></div>
        <div className="rounded-lg bg-muted/60 p-5"><p className="text-sm text-muted-foreground">Συνδρομή</p><p className="mt-2 truncate text-lg font-semibold">{client?.planName || "Σε αναμονή πλάνου"}</p>{subscriptionActive ? <><div className="mt-4 flex items-end justify-between gap-3"><div><p className="text-3xl font-bold tabular-nums">{daysRemaining ?? "-"}</p><p className="text-xs text-muted-foreground">ημέρες απομένουν</p></div><CalendarDays className="h-8 w-8 text-primary" /></div><Progress value={subscriptionProgress} className={`mt-4 h-1.5 ${progressColor}`} /><div className="mt-2 flex justify-between text-xs text-muted-foreground"><span>{formatDate(client?.subscriptionStartDate)}</span><span>{formatDate(client?.subscriptionEndDate)}</span></div></> : <div className="mt-4 rounded-md border border-border bg-background/70 px-3 py-2 text-xs text-muted-foreground">Αναμονή επιβεβαίωσης από τον coach</div>}</div>
      </div>
    </Card>

    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md"><div className="flex items-center justify-between"><p className="text-sm text-muted-foreground">Τρέχον βάρος</p><ScaleIcon /></div><p className="mt-3 text-2xl font-bold tabular-nums">{client?.currentWeight ?? "-"}{client?.currentWeight ? " kg" : ""}</p><p className="mt-1 text-xs text-muted-foreground">{dashboard?.lastWeightUpdate ? "Από το τελευταίο check-in" : "Από την εγγραφή σου"}</p></div>
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md"><div className="flex items-center justify-between"><p className="text-sm text-muted-foreground">Ρυθμός updates</p><Flame className="h-4 w-4 text-primary" /></div><p className="mt-3 text-2xl font-bold tabular-nums">{dashboard?.streak ?? 0}</p><p className="mt-1 text-xs text-muted-foreground">συνεχόμενες εβδομάδες</p></div>
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md"><div className="flex items-center justify-between"><p className="text-sm text-muted-foreground">Επόμενο update</p><Clock3 className="h-4 w-4 text-primary" /></div><p className="mt-3 text-lg font-bold">{updateDone ? nextUpdate : updateReady ? "Σήμερα" : nextUpdate}</p><p className="mt-1 text-xs text-muted-foreground">{updateDone ? "Είσαι ενημερωμένος" : "Μην το ξεχάσεις"}</p></div>
      <Link href="/client-progress" className="group rounded-xl border border-border bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-md"><div className="flex items-center justify-between"><p className="text-sm text-muted-foreground">Η πρόοδός μου</p><Activity className="h-4 w-4 transition-transform group-hover:scale-110" /></div><p className="mt-3 text-lg font-bold">Δες αναλυτικά</p><p className="mt-1 text-xs text-muted-foreground">Βάρος, προπονήσεις και check-ins</p></Link>
    </section>

    <PointsWidget />

    <DiscordConnectionCard />

    <section className="grid gap-4 md:grid-cols-3"><DashboardQuickLink href="/client-program" title="Προπόνηση" description={trainingPlan ? `${trainingPlan.days.length} ημέρες προπόνησης` : "Δες το πρόγραμμά σου"} icon={Dumbbell} /><DashboardQuickLink href="/client-nutrition" title="Διατροφή" description={nutritionPlan ? `${nutritionPlan.meals.length} γεύματα στο πλάνο` : "Δες το πλάνο διατροφής"} icon={Salad} /><DashboardQuickLink href="/client-progress" title="Progress" description="Μετρήσεις, φωτογραφίες και ρεκόρ" icon={Activity} /></section>

    <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <Card><CardHeader className="pb-3"><CardTitle className="text-lg">Τελευταία δραστηριότητα</CardTitle></CardHeader><CardContent className="divide-y">{dashboard?.lastUpdate ? <ActivityRow icon={<CheckCircle2 className="h-4 w-4 text-primary" />} title="Υποβλήθηκε εβδομαδιαίο update" detail={formatDate(dashboard.lastUpdate.submittedAt)} /> : <ActivityRow icon={<CalendarDays className="h-4 w-4 text-muted-foreground" />} title="Δεν υπάρχει update ακόμα" detail="Το πρώτο σου check-in θα εμφανιστεί εδώ." />}{trainingPlan && <ActivityRow icon={<Dumbbell className="h-4 w-4 text-primary" />} title="Το πρόγραμμα προπόνησης είναι διαθέσιμο" detail={trainingPlan.title} />}{nutritionPlan && <ActivityRow icon={<Salad className="h-4 w-4 text-primary" />} title="Το πλάνο διατροφής είναι διαθέσιμο" detail={nutritionPlan.title} />}</CardContent></Card>
      <Card variant="dark"><CardContent className="p-5"><p className="text-sm font-extrabold text-white">Μικρό βήμα, σταθερή πρόοδος</p><p className="mt-2 text-sm leading-6 text-neutral-300">Η συνέπεια στα workouts και στα εβδομαδιαία updates βοηθά τον coach να προσαρμόζει το πλάνο σου σωστά.</p><Link href="/client-progress" className="mt-4 inline-flex items-center text-sm font-extrabold text-accent hover:underline">Προβολή Progress<ArrowRight className="ml-1 h-4 w-4" /></Link></CardContent></Card>
    </section>
  </div>
}

type SubscriptionVisualState = "active" | "expiring" | "expired" | "pending"

function subscriptionVisualState(client: DashboardData["client"] | undefined): SubscriptionVisualState {
  if (!client?.subscriptionEndDate) return "pending"
  const days = typeof client.daysRemaining === "number" ? client.daysRemaining : Math.ceil((new Date(client.subscriptionEndDate).getTime() - Date.now()) / 86400000)
  if (client.subscriptionStatus === "expired" || client.subscriptionStatus === "cancelled" || days <= 0) return "expired"
  if (days <= 7 || client.subscriptionStatus === "expiring_soon") return "expiring"
  return "active"
}

function subscriptionDays(client: DashboardData["client"] | undefined) {
  if (typeof client?.daysRemaining === "number") return client.daysRemaining
  return client?.subscriptionEndDate ? Math.ceil((new Date(client.subscriptionEndDate).getTime() - Date.now()) / 86400000) : null
}

function formatExpiryDate(date: string | null | undefined) {
  if (!date) return "-"
  return new Intl.DateTimeFormat("el-GR", { weekday: "short", day: "numeric", month: "short" }).format(new Date(date))
}

function subscriptionDisplayEndDate(client: DashboardData["client"] | undefined) {
  return client?.subscriptionStatus === "cancelled" && client.subscriptionCancelledAt
    ? client.subscriptionCancelledAt
    : client?.subscriptionEndDate
}

function subscriptionEndLabel(client: DashboardData["client"] | undefined) {
  return client?.subscriptionStatus === "cancelled" ? "διακόπηκε στις" : "έληξε στις"
}

function SubscriptionStateCard({ client, className = "" }: { client: DashboardData["client"] | undefined; className?: string }) {
  const state = subscriptionVisualState(client)
  const days = Math.max(0, subscriptionDays(client) ?? 0)
  const start = client?.subscriptionStartDate ? new Date(client.subscriptionStartDate) : null
  const end = client?.subscriptionEndDate ? new Date(client.subscriptionEndDate) : null
  const totalDays = start && end ? Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000)) : 1
  const elapsed = start ? Math.max(0, Math.ceil((Date.now() - start.getTime()) / 86400000)) : 0
  const progress = Math.min(100, Math.max(0, (elapsed / totalDays) * 100))

  if (state === "expired") {
    return <Card variant="dark" className={`relative overflow-hidden rounded-[20px] border-0 ${className}`}><CardContent className="relative flex flex-col gap-3 p-[22px]"><span aria-hidden="true" className="absolute right-[26px] -top-5 h-[200px] w-3 -skew-x-[18deg] bg-accent" /><div className="relative flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-[1px] text-neutral-400">Συνδρομή</p><Badge className="mr-7 bg-[#262626] px-2.5 py-1 text-[11px] font-extrabold tracking-[.5px] text-white">ΕΛΗΞΕ</Badge></div><h2 className="relative text-[24px] font-extrabold leading-[1.15] tracking-[-.4px] text-white">Η συνδρομή σου<br />{subscriptionEndLabel(client)} {formatExpiryDate(subscriptionDisplayEndDate(client))}</h2><p className="relative max-w-[260px] text-[13px] leading-[1.5] text-neutral-300">Το πρόγραμμα και η διατροφή σου είναι σε παύση. Ανανέωσε και συνέχισε από εκεί που σταμάτησες.</p><Button asChild variant="lime" className="relative mt-1 h-11 w-full"><Link href="/client-billing">Ανανέωση συνδρομής <ArrowRight className="ml-2 h-4 w-4" /></Link></Button><Link href="/client-billing" className="relative text-center text-xs font-bold text-white hover:text-accent">Δες όλα τα πακέτα</Link></CardContent></Card>
  }

  if (state === "expiring") {
    return <Card className={`relative overflow-hidden rounded-[20px] border-[1.5px] border-black ${className}`}><span aria-hidden="true" className="absolute inset-y-0 left-0 w-1.5 bg-accent" /><CardContent className="flex flex-col gap-3 p-[22px] pl-[26px]"><div className="flex items-center justify-between gap-3"><p className="text-xs font-bold uppercase tracking-[1px] text-muted-foreground">Συνδρομή</p><Badge className="bg-accent px-2.5 py-1 text-[11px] font-extrabold tracking-[.5px] text-black">ΛΗΓΕΙ ΣΥΝΤΟΜΑ</Badge></div><div className="flex items-baseline gap-2"><p className="text-[40px] font-extrabold italic leading-none tracking-[-1px] tabular-nums">{days}</p><p className="text-[13px] font-semibold">ημέρες · λήγει {formatExpiryDate(client?.subscriptionEndDate)}</p></div><Progress value={progress} className="h-2 [&_[data-slot=progress-indicator]]:bg-black" /><div className="flex items-center gap-2 rounded-xl bg-[#f1fbd6] px-3 py-2.5 text-xs font-semibold leading-[1.4]"><Sparkles className="h-3.5 w-3.5 shrink-0" />Ανανέωσε πριν τη λήξη και πάρε τους πόντους bonus ανανέωσης.</div><Button asChild variant="lime" className="h-11 w-full"><Link href="/client-billing">Ανανέωση συνδρομής <ArrowRight className="ml-2 h-4 w-4" /></Link></Button></CardContent></Card>
  }

  if (state === "active") {
    return <Card className={`rounded-[20px] ${className}`}><CardContent className="flex flex-col gap-3 p-[22px]"><div className="flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-[1px] text-muted-foreground">Συνδρομή</p><Badge className="bg-black px-2.5 py-1 text-[11px] font-extrabold text-accent">PRO</Badge></div><div className="flex items-baseline gap-2"><p className="text-[40px] font-extrabold italic leading-none tracking-[-1px] tabular-nums">{days}</p><span className="text-[13px] text-muted-foreground">ημέρες απομένουν</span></div><Progress value={progress} className="h-2 [&_[data-slot=progress-indicator]]:bg-accent" /><div className="flex justify-between text-xs text-[#8a8a8a]"><span>{formatDate(client?.subscriptionStartDate)}</span><span>{formatDate(client?.subscriptionEndDate)}</span></div><Button asChild variant="outline" className="h-10 w-full border-[1.5px] border-black"><Link href="/client-billing">Διαχείριση συνδρομής</Link></Button></CardContent></Card>
  }

  return <Card className={`rounded-[20px] ${className}`}><CardContent className="p-[22px]"><p className="text-xs font-bold uppercase tracking-[1px] text-muted-foreground">Συνδρομή</p><p className="mt-3 text-sm text-muted-foreground">Αναμονή επιβεβαίωσης από τον coach</p><Button asChild variant="outline" className="mt-4 h-10 w-full border-[1.5px] border-black"><Link href="/client-billing">Διαχείριση συνδρομής</Link></Button></CardContent></Card>
}

function ExpiredSubscriptionBanner({ endDate }: { endDate?: string | null }) {
  return <Card variant="dark" className="relative overflow-hidden rounded-[20px]"><CardContent className="relative flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-7"><span aria-hidden="true" className="absolute right-[30%] -top-8 h-[260px] w-4 -skew-x-[18deg] bg-accent" /><span aria-hidden="true" className="absolute right-[calc(30%+26px)] -top-8 h-[260px] w-[5px] -skew-x-[18deg] bg-accent/45" /><div className="relative max-w-[560px]"><Badge className="bg-[#262626] px-2.5 py-1 text-[11px] font-extrabold tracking-[1px] text-white">Η ΣΥΝΔΡΟΜΗ ΕΛΗΞΕ · {formatExpiryDate(endDate)}</Badge><h2 className="mt-3 text-[28px] font-extrabold italic leading-[1.05] tracking-[-.6px] text-white">ΜΗΝ ΧΑΣΕΙΣ ΤΟΝ <span className="text-accent">ΡΥΘΜΟ ΣΟΥ.</span></h2><p className="mt-2 text-sm leading-[1.55] text-neutral-300">Ανανέωσε και ο coach σου συνεχίζει το πλάνο σου από εκεί που σταμάτησες.</p></div><div className="relative flex w-full shrink-0 flex-col gap-2 sm:w-[220px]"><Button asChild variant="lime" className="h-[50px]"><Link href="/client-billing">Ανανέωση <ArrowRight className="ml-2 h-4 w-4" /></Link></Button><Button asChild variant="outline" className="h-11 border-[#3a3a3a] bg-transparent text-white hover:bg-white/10 hover:text-white"><Link href="/client-billing">Δες τα πακέτα</Link></Button></div></CardContent></Card>
}

function PausedPrograms() {
  return <div className="grid gap-5 md:grid-cols-2">{["Σημερινή προπόνηση", "Διατροφή σήμερα"].map((title) => <Card key={title} className="rounded-[18px] opacity-55"><CardContent className="flex min-h-[130px] items-center gap-3 p-[18px]"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-[#f2f2f0]"><LockKeyhole className="h-4 w-4" /></span><div><p className="text-sm font-extrabold">{title}</p><p className="mt-1 text-xs text-muted-foreground">Σε παύση μέχρι την ανανέωση</p></div></CardContent></Card>)}</div>
}

function numberFrom(value: number | string | null | undefined) {
  return Number(value) || 0
}

function parseFoodQuantity(value: string | null | undefined) {
  const match = String(value || "").trim().match(/^(\d+(?:[.,]\d+)?)\s*(.*)$/)
  return match ? { amount: Number(match[1].replace(",", ".")), unit: match[2].trim() || "g" } : { amount: null, unit: String(value || "").trim() || "g" }
}

const foodCategoryLabels: Record<string, string> = {
  meat: "Κρέας & ψάρι", fish: "Κρέας & ψάρι", eggs: "Αυγά & γαλακτοκομικά", dairy: "Αυγά & γαλακτοκομικά",
  grains: "Δημητριακά", vegetables: "Φρούτα & λαχανικά", fruits: "Φρούτα & λαχανικά", legumes: "Όσπρια",
  nuts: "Ξηροί καρποί & έλαια", oils: "Ξηροί καρποί & έλαια", other: "Άλλα",
}

type ShoppingListItem = { key: string; name: string; amount: number | null; unit: string; category: string; imageUrl?: string | null }

function formatShoppingAmount(amount: number | null, unit: string) {
  if (amount === null) return "—"
  if (unit.toLocaleLowerCase("el-GR") === "g" && amount >= 1000) return `${(amount / 1000).toLocaleString("el-GR", { maximumFractionDigits: 1 })} kg`
  if (/^(τεμ\.?|piece|pieces)$/i.test(unit)) return `${Math.round(amount).toLocaleString("el-GR")} τεμ.`
  return `${amount.toLocaleString("el-GR", { maximumFractionDigits: 1 })}${unit === "g" ? " g" : unit ? ` ${unit}` : ""}`
}

function startOfProgramWeek(value = new Date()) {
  const date = new Date(value)
  const day = date.getDay()
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() - (day === 0 ? 6 : day - 1))
  return date
}

function ShoppingListSheet({ plan, open, onOpenChange }: { plan: NutritionPlanPreview; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [days, setDays] = useState<3 | 7 | 14>(7)
  const storageKey = `shopping-list:dashboard:${plan?.id ?? "none"}`
  const [checked, setChecked] = useState<Record<string, boolean>>({})

  useEffect(() => {
    try { setChecked(JSON.parse(window.localStorage.getItem(storageKey) || "{}")) } catch { setChecked({}) }
  }, [storageKey])

  const items = useMemo<ShoppingListItem[]>(() => {
    const grouped = new Map<string, ShoppingListItem>()
    plan?.meals.flatMap((meal) => meal.foods || []).forEach((food) => {
      const parsed = parseFoodQuantity(food.quantity ?? food.amount)
      const category = foodCategoryLabels[food.food_category || ""] || "Άλλα"
      const key = `${food.name.trim().toLocaleLowerCase("el-GR")}::${parsed.unit.toLocaleLowerCase("el-GR")}`
      const existing = grouped.get(key)
      grouped.set(key, { key, name: food.name, unit: parsed.unit, category, imageUrl: existing?.imageUrl || food.food_image || food.food_image_url || food.image_url, amount: parsed.amount === null || existing?.amount === null ? null : (existing?.amount || 0) + parsed.amount })
    })
    return [...grouped.values()]
  }, [plan])

  const groups = useMemo(() => {
    const result = new Map<string, ShoppingListItem[]>()
    items.forEach((item) => result.set(item.category, [...(result.get(item.category) || []), item]))
    return [...result.entries()]
  }, [items])
  const checkedCount = items.filter((item) => checked[item.key]).length
  const updateChecked = (key: string, next: boolean) => {
    setChecked((current) => {
      const nextChecked = { ...current, [key]: next }
      window.localStorage.setItem(storageKey, JSON.stringify(nextChecked))
      return nextChecked
    })
  }
  const shareText = groups.map(([category, categoryItems]) => `${category}\n${categoryItems.map((item) => `• ${item.name}: ${formatShoppingAmount(item.amount === null ? null : item.amount * days, item.unit)}`).join("\n")}`).join("\n\n")
  const copy = async () => { try { await navigator.clipboard.writeText(shareText) } catch { /* Clipboard access is optional. */ } }
  const share = async () => {
    if (navigator.share) { try { await navigator.share({ title: "Λίστα για ψώνια", text: shareText }); return } catch { /* User cancelled sharing. */ } }
    await copy()
  }
  const exportShoppingList = () => {
    const printWindow = window.open("", "_blank")
    if (!printWindow) return
    const document = printWindow.document
    document.open()
    document.write("<!doctype html><html><head><meta charset=\"utf-8\"><title>Λίστα για ψώνια</title><style>body{font-family:Arial,sans-serif;color:#0b0b0b;margin:40px;max-width:720px}h1{font-size:22px;margin:0 0 24px}h2{font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#6a6a6a;margin:22px 0 4px}ul{list-style:none;padding:0;margin:0}li{display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid #e6e6e2}.food-image,.food-placeholder{width:32px;height:32px;border-radius:50%;flex:0 0 32px;object-fit:cover}.food-placeholder{display:grid;place-items:center;background:#f2f2f0;color:#6a6a6a;font-weight:700}.food-name{flex:1;font-weight:600}.food-quantity{white-space:nowrap;font-weight:700}</style></head><body></body></html>")
    document.close()
    const title = document.createElement("h1"); title.textContent = "Λίστα για ψώνια"; document.body.appendChild(title)
    groups.forEach(([category, categoryItems]) => {
      const heading = document.createElement("h2"); heading.textContent = category; document.body.appendChild(heading)
      const list = document.createElement("ul")
      categoryItems.forEach((item) => {
        const row = document.createElement("li"); const name = document.createElement("span"); const quantity = document.createElement("span")
        name.className = "food-name"; name.textContent = item.name; quantity.className = "food-quantity"; quantity.textContent = formatShoppingAmount(item.amount === null ? null : item.amount * days, item.unit)
        if (item.imageUrl) { const image = document.createElement("img"); image.className = "food-image"; image.alt = ""; image.src = resolveMediaUrl(item.imageUrl); row.appendChild(image) }
        else { const placeholder = document.createElement("span"); placeholder.className = "food-placeholder"; placeholder.textContent = item.name.trim().charAt(0).toLocaleUpperCase("el-GR"); row.appendChild(placeholder) }
        row.append(name, quantity); list.appendChild(row)
      })
      document.body.appendChild(list)
    })
    const images = Array.from(document.images)
    Promise.all(images.map((image) => new Promise<void>((resolve) => { if (image.complete) resolve(); else { image.onload = () => resolve(); image.onerror = () => resolve() } }))).finally(() => { printWindow.focus(); window.setTimeout(() => printWindow.print(), 50) })
  }

  return <Sheet open={open} onOpenChange={onOpenChange}>
    <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-[460px]" showCloseButton={false}>
      <SheetHeader className="gap-3 border-b border-[#ececea] px-7 pb-4 pt-[22px]">
        <div className="flex items-start justify-between gap-4"><div><SheetTitle className="text-xl font-extrabold">Λίστα για ψώνια</SheetTitle><SheetDescription className="mt-1 text-xs">Από το πλάνο διατροφής σου{plan?.updated_at ? ` · ενημ. ${formatDate(plan.updated_at)}` : ""}</SheetDescription></div><Button variant="outline" size="icon" className="h-10 w-10 rounded-xl" onClick={() => onOpenChange(false)} aria-label="Κλείσιμο"><X className="h-[18px] w-[18px]" /></Button></div>
        <div className="flex items-center justify-between gap-3"><span className="text-[13px] font-semibold">Για πόσες ημέρες;</span><div className="flex rounded-xl bg-muted p-[3px]">{([3, 7, 14] as const).map((value) => <button key={value} type="button" onClick={() => setDays(value)} className={`h-8 rounded-[9px] px-3.5 text-[13px] font-bold ${days === value ? "bg-black text-accent" : "text-muted-foreground"}`}>{value}{value === 7 ? " ημέρες" : ""}</button>)}</div></div>
      </SheetHeader>
      <div className="min-h-0 flex-1 overflow-y-auto px-7 py-[18px]">{groups.map(([category, categoryItems]) => <section key={category} className="mb-4"><p className="pb-1.5 text-[11px] font-extrabold uppercase tracking-[1px] text-muted-foreground">{category}</p>{categoryItems.map((item) => { const isChecked = Boolean(checked[item.key]); const total = item.amount === null ? null : item.amount * days; return <label key={item.key} className={`flex cursor-pointer items-center gap-3 border-b border-[#f0f0ee] py-[9px] ${isChecked ? "text-[#9a9a9a]" : ""}`}><Checkbox checked={isChecked} onCheckedChange={(value) => updateChecked(item.key, Boolean(value))} className="h-[22px] w-[22px] rounded-[7px] border-[#cfcfcb] data-[state=checked]:border-black data-[state=checked]:bg-black data-[state=checked]:text-accent" />{item.imageUrl ? <img src={resolveMediaUrl(item.imageUrl)} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" /> : <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#f2f2f0] text-xs font-bold text-[#6a6a6a]">{item.name.trim().charAt(0).toLocaleUpperCase("el-GR")}</span>}<span className={`min-w-0 flex-1 text-sm font-semibold ${isChecked ? "line-through" : ""}`}>{item.name}</span><span className="whitespace-nowrap text-[11px] text-[#9a9a9a]">{item.amount === null ? "χωρίς ποσότητα" : `${formatShoppingAmount(item.amount, item.unit)} × ${days}`}</span><span className="w-16 shrink-0 text-right text-sm font-extrabold">{formatShoppingAmount(total, item.unit)}</span></label> })}</section>)}</div>
      <SheetFooter className="gap-2.5 border-t border-[#ececea] px-7 pb-5 pt-4"><p className="text-[11px] leading-4 text-[#8a8a8a]">Ποσότητα = ημερήσια ποσότητα του πλάνου × ημέρες. {checkedCount} από {items.length} στο καλάθι.</p><Button variant="lime" className="h-[50px] w-full rounded-full" onClick={exportShoppingList}><Download className="mr-2 h-4 w-4" />Εξαγωγή PDF</Button></SheetFooter>
    </SheetContent>
  </Sheet>
}

function ClientHomeOverviewNext({ dashboard, trainingPlan, nutritionPlan, workoutHistory, activeWorkout, onOpenUpdate }: { dashboard: DashboardData | null; trainingPlan: TrainingPlan; nutritionPlan: NutritionPlanPreview; workoutHistory: WorkoutLog[]; activeWorkout: ActiveWorkout; onOpenUpdate: () => void }) {
  const [shoppingOpen, setShoppingOpen] = useState(false)
  const client = dashboard?.client
  const subscriptionState = subscriptionVisualState(client)
  const subscriptionExpired = subscriptionState === "expired"
  const accountActive = client?.subscriptionStatus === "active" || client?.subscriptionStatus === "expiring_soon"
  const updateReady = Boolean(dashboard?.todayIsUpdateDay && !dashboard?.alreadySubmittedThisWeek)
  const daysToNextUpdate = dashboard?.nextUpdateDate ? Math.max(0, Math.ceil((new Date(dashboard.nextUpdateDate).getTime() - Date.now()) / 86400000)) : 7
  const completedUpdateDays = Math.max(0, Math.min(7, 7 - daysToNextUpdate))
  const weekStart = startOfProgramWeek()
  const programWeek = trainingPlan?.start_date ? Math.max(1, Math.floor((Date.now() - new Date(trainingPlan.start_date).getTime()) / 604800000) + 1) : 1
  const planHistory = workoutHistory.filter((log) => log.training_plan_id === trainingPlan?.id && new Date(log.completed_at) >= weekStart).sort((first, second) => new Date(second.completed_at).getTime() - new Date(first.completed_at).getTime())
  const daysCount = trainingPlan?.days.length || 0
  const lastWorkout = planHistory[0]
  const chronologicalHistory = [...planHistory].reverse()
  const lastCycleStart = chronologicalHistory.map((log) => log.day_number).lastIndexOf(1)
  let sequentialCompleted = 0
  if (lastCycleStart >= 0) {
    for (let index = lastCycleStart; index < chronologicalHistory.length; index += 1) {
      if (chronologicalHistory[index].day_number !== sequentialCompleted + 1) break
      sequentialCompleted += 1
    }
  }
  sequentialCompleted = Math.min(sequentialCompleted, daysCount)
  const completedDayNumbers = new Set(Array.from({ length: sequentialCompleted }, (_, index) => index + 1))
  const allDaysCompleted = daysCount > 0 && sequentialCompleted === daysCount
  const nextDayNumber = allDaysCompleted ? 1 : Math.min(daysCount || 1, sequentialCompleted + 1)
  const nextWorkout = trainingPlan?.days[nextDayNumber - 1]
  const activeForPlan = activeWorkout?.training_plan_id === trainingPlan?.id ? activeWorkout : null
  const displayedDayNumber = activeForPlan?.day_number || nextDayNumber
  const selectedWorkout = activeForPlan ? trainingPlan?.days[activeForPlan.day_number - 1] : nextWorkout
  const displayedWorkout = selectedWorkout ? { ...selectedWorkout, name: trainingDayDisplayTitle(selectedWorkout, displayedDayNumber - 1) } : undefined
  const workoutSets = displayedWorkout?.exercises.reduce((sum, exercise) => sum + Math.max(1, Number(exercise.sets) || 1), 0) || 0
  const workoutMinutes = Math.max(1, Math.round((displayedWorkout?.exercises.reduce((sum, exercise) => sum + Math.max(1, Number(exercise.sets) || 1) * (1 + (Number(exercise.rest_seconds) || 90) / 60), 0) || 0)))
  const nutritionTotals = useMemo(() => nutritionPlan?.meals.flatMap((meal) => meal.foods || []).reduce((sum, food) => ({ calories: sum.calories + numberFrom(food.calories), protein: sum.protein + numberFrom(food.protein_g), carbs: sum.carbs + numberFrom(food.carbs_g), fats: sum.fats + numberFrom(food.fat_g) }), { calories: 0, protein: 0, carbs: 0, fats: 0 }) || { calories: 0, protein: 0, carbs: 0, fats: 0 }, [nutritionPlan])
  const calories = numberFrom(nutritionPlan?.daily_calories) || nutritionTotals.calories
  const protein = numberFrom(nutritionPlan?.protein_g) || nutritionTotals.protein
  const carbs = numberFrom(nutritionPlan?.carbs_g) || nutritionTotals.carbs
  const fats = numberFrom(nutritionPlan?.fat_g) || nutritionTotals.fats

  return <div className="relative space-y-5">
    {client?.birthdayToday && <Alert className="relative overflow-hidden rounded-2xl border-0 bg-black px-[18px] py-4"><span aria-hidden="true" className="pointer-events-none absolute right-[70px] -top-4 h-[110px] w-3.5 -skew-x-[18deg] bg-accent" /><div className="relative flex items-center gap-3.5"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent"><Gift className="h-[19px] w-[19px] text-black" /></span><div><AlertTitle className="text-base font-extrabold text-white">Χρόνια πολλά, {client.firstName}!</AlertTitle><AlertDescription className="mt-0.5 text-[13px] text-neutral-300">Σου ευχόμαστε μια δυνατή νέα χρονιά — από όλο το SP Team.</AlertDescription></div></div></Alert>}
    {subscriptionExpired && <div className="grid gap-5 lg:grid-cols-3"><div className="space-y-5 lg:col-span-2"><ExpiredSubscriptionBanner endDate={subscriptionDisplayEndDate(client)} /><PausedPrograms /></div><PointsWidget /></div>}
    {!subscriptionExpired && <section className="grid gap-5 lg:grid-cols-3"><div className="space-y-5 lg:col-span-2">{updateReady ? <Card variant="action" className="min-h-[238px]"><CardContent className="grid items-center gap-6 p-7 sm:grid-cols-[minmax(0,1fr)_9.5rem]"><div><Badge className="h-7 bg-black px-2.5 text-[11px] font-extrabold uppercase tracking-[1px] text-accent">Σήμερα · εκκρεμεί</Badge><h2 className="mt-3 text-2xl font-extrabold tracking-[-0.4px]">Ώρα για το εβδομαδιαίο σου update</h2><p className="mt-2 text-sm leading-[1.55] text-muted-foreground">Σε 3 λεπτά: βάρος, φωτογραφίες και πώς πήγε η εβδομάδα — για να προσαρμόσει ο coach το πλάνο σου.</p><Button variant="lime" onClick={onOpenUpdate} className="mt-4 h-[46px] px-[22px]">Συμπλήρωσε update <ArrowRight className="ml-2 h-4 w-4" /></Button></div></CardContent></Card> : <Card className="rounded-[18px]"><CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:gap-5 sm:px-5"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-black text-accent"><CheckCircle2 className="h-3.5 w-3.5" strokeWidth={4} /></span><div className="shrink-0"><p className="text-[15px] font-extrabold">Εβδομαδιαίο update</p><p className="text-xs text-muted-foreground">{dashboard?.alreadySubmittedThisWeek ? `Στάλθηκε ${formatDate(dashboard?.lastUpdate?.submittedAt)}` : "Δεν εκκρεμεί update"}</p></div><div className="min-w-0 flex-1 px-0 sm:px-2"><div className="mb-1.5 flex justify-between gap-3 text-xs text-muted-foreground"><span><strong className="text-[13px] text-foreground">{daysToNextUpdate} ημέρες</strong> για το επόμενο</span><span>{formatDate(dashboard?.nextUpdateDate)}</span></div><div className="flex gap-1">{Array.from({ length: 7 }, (_, index) => <span key={index} className={`h-1.5 flex-1 rounded-[3px] ${index < completedUpdateDays ? "bg-accent" : "bg-[#ececea]"}`} />)}</div></div><Button asChild variant="outline" size="sm" className="h-[38px] shrink-0 px-4"><Link href="/client-progress">Δες το τελευταίο</Link></Button></CardContent></Card>}
      <div className="grid gap-5 md:grid-cols-2"><Card variant="dark" className="min-h-[270px]"><CardContent className="flex h-full flex-col gap-3 p-[22px]"><div className="flex items-center justify-between gap-3"><p className="text-xs font-bold uppercase tracking-[1px] text-neutral-400">Επόμενη προπόνηση</p><Badge className="bg-[#1f1f1f] text-xs font-bold text-white">Ημέρα {displayedDayNumber} <span className="text-neutral-400">/ {daysCount || "–"}</span></Badge></div><h2 className="text-[19px] font-extrabold leading-[1.2] text-white">{displayedWorkout?.name || displayedWorkout?.title || "Δεν υπάρχει διαθέσιμη προπόνηση"}</h2>{daysCount > 0 && <div className="space-y-1.5"><div className="flex gap-1">{Array.from({ length: daysCount }, (_, index) => <span key={index} className={`h-1.5 flex-1 rounded-[3px] ${index + 1 === displayedDayNumber ? "bg-white" : completedDayNumbers.has(index + 1) ? "bg-accent" : "bg-[#2a2a2a]"}`} />)}</div><p className="text-[11px] text-neutral-400">Εβδομάδα {programWeek} · {completedDayNumbers.size} από {daysCount}{lastWorkout ? ` · τελευταία: Ημέρα ${lastWorkout.day_number}, ${formatDate(lastWorkout.completed_at)}` : ""}</p></div>}<div className="flex flex-wrap gap-2"><Badge className="bg-[#1f1f1f] text-xs font-semibold text-white">{displayedWorkout?.exercises.length || 0} ασκήσεις</Badge><Badge className="bg-[#1f1f1f] text-xs font-semibold text-white">{workoutSets} sets</Badge><Badge className="bg-[#1f1f1f] text-xs font-semibold text-white">~{workoutMinutes}′</Badge></div><Button asChild variant="lime" className="mt-auto h-11 w-full"><Link href="/client-program"><Play className="mr-2 h-[13px] w-[13px] fill-current" />{activeForPlan ? "Συνέχισε" : allDaysCompleted ? "Ολοκλήρωσες την εβδομάδα" : "Ξεκίνα προπόνηση"}</Link></Button></CardContent></Card>
      <Card className="min-h-[270px]"><CardContent className="flex h-full flex-col gap-[14px] p-[22px]"><div className="flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-[1px] text-muted-foreground">Το πλάνο διατροφής μου</p><Link href="/client-nutrition" className="text-xs font-bold">Δες πλάνο →</Link></div><div className="flex items-baseline gap-2"><p className="text-[34px] font-extrabold italic leading-none tracking-[-1px]">{Math.round(calories).toLocaleString("el-GR")}</p><span className="text-[13px] text-muted-foreground">kcal / ημέρα</span></div><div className="grid grid-cols-3 gap-3">{[["bg-black", protein, "Πρωτεΐνη"], ["bg-accent", carbs, "Υδατάνθρακες"], ["bg-[#c9c9c4]", fats, "Λιπαρά"]].map(([color, value, label]) => <div key={String(label)} className="space-y-1.5"><span className={`block h-1.5 rounded-[3px] ${color}`} /><p className="text-base font-extrabold">{Math.round(Number(value))}g</p><p className="-mt-1 text-[11px] text-[#8a8a8a]">{label}</p></div>)}</div><p className="text-xs text-[#8a8a8a]">{nutritionPlan?.meals.length || 0} γεύματα{nutritionPlan?.updated_at ? ` · ενημ. ${formatDate(nutritionPlan.updated_at)}` : ""}</p><Button variant="outline" className="mt-auto h-11 w-full border-[1.5px] border-black" onClick={() => setShoppingOpen(true)}><ShoppingCart className="mr-2 h-4 w-4" />Λίστα για ψώνια</Button></CardContent></Card></div></div><aside className="space-y-5"><SubscriptionStateCard client={client} /><PointsWidget /></aside></section>}
    {accountActive && <section className="grid gap-5 lg:grid-cols-2">
      <Card className="rounded-[20px]"><CardContent className="p-[22px]"><div className="flex items-center justify-between gap-4"><CardTitle className="text-base">Τελευταία δραστηριότητα</CardTitle><Link href="/client-progress" className="text-xs font-extrabold">Πρόοδος <ArrowRight className="inline h-3.5 w-3.5" /></Link></div><div className="mt-2 divide-y divide-[#f0f0ee]">{dashboard?.lastUpdate ? <ActivityRow icon={<CheckCircle2 className="h-4 w-4" />} title="Υποβλήθηκε εβδομαδιαίο update" detail={formatDate(dashboard.lastUpdate.submittedAt)} /> : <ActivityRow icon={<CalendarDays className="h-4 w-4" />} title="Δεν υπάρχει update ακόμα" detail="Το πρώτο σου check-in θα εμφανιστεί εδώ." />}{trainingPlan && <ActivityRow icon={<Dumbbell className="h-4 w-4" />} title="Το πρόγραμμα προπόνησης είναι διαθέσιμο" detail={trainingPlan.title} />}{nutritionPlan && <ActivityRow icon={<Salad className="h-4 w-4" />} title="Το πλάνο διατροφής είναι διαθέσιμο" detail={nutritionPlan.title} />}</div></CardContent></Card>
      <div className="grid gap-5 sm:grid-cols-2"><Card variant="stat" className="rounded-[20px]"><CardContent className="p-[22px]"><p className="text-xs font-bold uppercase tracking-[1px] text-muted-foreground">Τρέχον βάρος</p><p className="mt-2 text-[32px] font-extrabold italic leading-none tracking-[-1px] tabular-nums">{client?.currentWeight ?? "–"}{client?.currentWeight ? " kg" : ""}</p><p className="mt-2 text-xs text-[#8a8a8a]">{dashboard?.lastWeightUpdate ? `τελευταίο check-in · ${formatDate(dashboard.lastWeightUpdate.submittedAt)}` : "από την εγγραφή σου"}</p></CardContent></Card><Link href="/client-progress" className="group rounded-[20px] border border-border bg-card p-[22px] transition-colors hover:bg-muted"><p className="text-xs font-bold uppercase tracking-[1px] text-muted-foreground">Πρόοδος</p><p className="mt-3 text-base font-extrabold">Δες αναλυτικά <ArrowRight className="inline h-4 w-4 transition-transform group-hover:translate-x-1" /></p><p className="mt-2 text-xs text-[#8a8a8a]">βάρος, ρεκόρ, φωτογραφίες</p></Link><div className="sm:col-span-2"><DiscordConnectionCard /></div></div>
    </section>}
    {nutritionPlan && <ShoppingListSheet plan={nutritionPlan} open={shoppingOpen} onOpenChange={setShoppingOpen} />}
  </div>
}

function ClientHomeOverview({ dashboard, trainingPlan, nutritionPlan, onOpenUpdate }: { dashboard: DashboardData | null; trainingPlan: TrainingPlan; nutritionPlan: NutritionPlanPreview; onOpenUpdate: () => void }) {
  const client = dashboard?.client
  const subscriptionState = subscriptionVisualState(client)
  const subscriptionExpired = subscriptionState === "expired"
  const updateReady = Boolean(dashboard?.todayIsUpdateDay && !dashboard?.alreadySubmittedThisWeek)
  const updateDone = Boolean(dashboard?.alreadySubmittedThisWeek)
  const subscriptionActive = client?.subscriptionStatus === "active" || client?.subscriptionStatus === "expiring_soon"
  const startDate = client?.subscriptionStartDate ? new Date(client.subscriptionStartDate) : null
  const endDate = client?.subscriptionEndDate ? new Date(client.subscriptionEndDate) : null
  const totalDays = startDate && endDate ? Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / 86400000)) : 1
  const elapsedDays = startDate ? Math.max(0, Math.ceil((Date.now() - startDate.getTime()) / 86400000)) : 0
  const subscriptionProgress = Math.min(100, Math.max(0, (elapsedDays / totalDays) * 100))
  const daysToNextUpdate = dashboard?.nextUpdateDate ? Math.max(0, Math.ceil((new Date(dashboard.nextUpdateDate).getTime() - Date.now()) / 86400000)) : 7
  const completedUpdateDays = Math.max(0, Math.min(7, 7 - daysToNextUpdate))
  const workout = trainingPlan?.days[0]
  const workoutExercises = workout?.exercises.length || 0
  const workoutSets = workout?.exercises.reduce((total, exercise) => total + (Number(exercise.sets) || 0), 0) || 0

  return <div className={`relative space-y-5 [&>section>div:first-child>:nth-child(3)]:hidden [&>section>aside>div.grid]:hidden ${subscriptionExpired ? "[&>section>div:first-child>:first-child]:hidden [&>section>div:first-child>div:nth-child(2)]:hidden [&>section>aside>a]:hidden" : "[&>section>aside]:lg:pt-[282px]"} [&>section>aside>[data-slot=card]:first-child]:hidden`}>
    {client?.birthdayToday && <Alert className="relative overflow-hidden rounded-2xl border-0 bg-black px-[18px] py-4"><span aria-hidden="true" className="pointer-events-none absolute right-[70px] -top-4 h-[110px] w-3.5 -skew-x-[18deg] bg-accent" /><div className="relative flex items-center gap-3.5"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent"><Gift className="h-[19px] w-[19px] text-black" /></span><div><AlertTitle className="text-base font-extrabold text-white">Χρόνια πολλά, {client.firstName}!</AlertTitle><AlertDescription className="mt-0.5 text-[13px] text-neutral-300">Σου ευχόμαστε μια δυνατή νέα χρονιά — από όλο το SP Team.</AlertDescription></div></div></Alert>}

    {subscriptionExpired && <><div className="lg:mr-[calc((100%+40px)/3)]"><ExpiredSubscriptionBanner endDate={subscriptionDisplayEndDate(client)} /></div><div className={`lg:absolute lg:right-0 lg:z-10 lg:w-[calc((100%_-_40px)/3)] ${client?.birthdayToday ? "lg:top-[102px]" : "lg:top-0"}`}><PointsWidget /></div><div className="lg:mr-[calc((100%+40px)/3)]"><PausedPrograms /></div></>}
    {!subscriptionExpired && <SubscriptionStateCard client={client} className={`lg:absolute lg:right-0 lg:z-10 lg:w-[calc((100%_-_40px)/3)] ${client?.birthdayToday ? "lg:top-[102px]" : "lg:top-0"}`} />}
    <section className="grid gap-5 lg:grid-cols-3">
      <div className="space-y-5 lg:col-span-2">
        {updateReady ? <Card variant="action" className="min-h-[238px]"><CardContent className="grid items-center gap-6 p-7 sm:grid-cols-[minmax(0,1fr)_9.5rem]"><div><Badge className="h-7 bg-black px-2.5 text-[11px] font-extrabold uppercase tracking-[1px] text-accent">Σήμερα · εκκρεμεί</Badge><h2 className="mt-3 text-2xl font-extrabold tracking-[-0.4px]">Ώρα για το εβδομαδιαίο σου update</h2><p className="mt-2 text-sm leading-[1.55] text-muted-foreground">Σε 3 λεπτά: βάρος, φωτογραφίες και πώς πήγε η εβδομάδα — για να προσαρμόσει ο coach το πλάνο σου.</p><Button variant="lime" onClick={onOpenUpdate} className="mt-4 h-[46px] px-[22px]">Συμπλήρωσε update <ArrowRight className="ml-2 h-4 w-4" /></Button></div><div className="hidden space-y-2.5 text-[13px] sm:block"><span className="flex items-center gap-2"><CheckCircle2 className="h-[18px] w-[18px] rounded-full bg-black p-1 text-accent" />Βάρος</span><span className="flex items-center gap-2 text-muted-foreground"><i className="h-[18px] w-[18px] rounded-full border-[1.5px] border-[#cfcfcb]" />Φωτογραφίες</span><span className="flex items-center gap-2 text-muted-foreground"><i className="h-[18px] w-[18px] rounded-full border-[1.5px] border-[#cfcfcb]" />Ερωτηματολόγιο</span></div></CardContent></Card> : <Card className="rounded-[18px]"><CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:gap-5 sm:px-5"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-black text-accent"><CheckCircle2 className="h-3.5 w-3.5" strokeWidth={4} /></span><div className="shrink-0"><p className="text-[15px] font-extrabold">Εβδομαδιαίο update</p><p className="text-xs text-muted-foreground">{updateDone ? `Στάλθηκε ${formatDate(dashboard?.lastUpdate?.submittedAt)}` : "Δεν εκκρεμεί update"}</p></div><div className="min-w-0 flex-1 px-0 sm:px-2"><div className="mb-1.5 flex justify-between gap-3 text-xs text-muted-foreground"><span><strong className="text-[13px] text-foreground">{daysToNextUpdate} ημέρες</strong> για το επόμενο</span><span>{formatDate(dashboard?.nextUpdateDate)}</span></div><div className="flex gap-1">{Array.from({ length: 7 }, (_, index) => <span key={index} className={`h-1.5 flex-1 rounded-[3px] ${index < completedUpdateDays ? "bg-accent" : "bg-[#ececea]"}`} />)}</div></div><Button asChild variant="outline" size="sm" className="h-[38px] shrink-0 px-4"><Link href="/client-progress">Δες το τελευταίο</Link></Button></CardContent></Card>}

        <div className="grid gap-5 md:grid-cols-2">
          <Card variant="dark" className="min-h-[270px]"><CardContent className="p-[22px]"><div className="flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-[1px] text-neutral-400">Σημερινή προπόνηση</p><p className="text-xs text-neutral-300">Ημέρα 1</p></div><h2 className="mt-3 text-[19px] font-extrabold leading-[1.2] text-white">{workout?.name || "Η προπόνησή σου"}</h2><div className="mt-4 flex flex-wrap gap-2"><Badge className="bg-[#1f1f1f] px-2.5 py-1.5 text-xs font-semibold text-white">{workoutExercises} ασκήσεις</Badge><Badge className="bg-[#1f1f1f] px-2.5 py-1.5 text-xs font-semibold text-white">{workoutSets || "-"} sets</Badge><Badge className="bg-[#1f1f1f] px-2.5 py-1.5 text-xs font-semibold text-white">Πρόγραμμα</Badge></div><Button asChild variant="lime" className="mt-auto h-11 w-full"><Link href="/client-program">Ξεκίνα προπόνηση <ArrowRight className="ml-2 h-4 w-4" /></Link></Button></CardContent></Card>
          <Card className="min-h-[270px]"><CardContent className="p-[22px]"><div className="flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-[1px] text-muted-foreground">Διατροφή σήμερα</p><Link href="/client-nutrition" className="text-xs font-bold">Δες πλάνο <ArrowRight className="inline h-3.5 w-3.5" /></Link></div><div className="mt-5 flex items-center gap-4"><div className="grid h-[86px] w-[86px] shrink-0 place-items-center rounded-full bg-[conic-gradient(#0b0b0b_0_44%,#ececea_44%_100%)]"><div className="grid h-[66px] w-[66px] place-items-center rounded-full bg-card text-center"><strong className="text-base font-extrabold">{nutritionPlan?.meals.length || 0}</strong><span className="text-[9px] text-muted-foreground">γεύματα</span></div></div><div className="space-y-2 text-xs font-semibold"><p>Πλάνο διατροφής</p><p className="text-muted-foreground">{nutritionPlan ? `${nutritionPlan.meals.length} γεύματα σήμερα` : "Δεν υπάρχει διαθέσιμο πλάνο"}</p><p className="text-[#9a9a9a]">{nutritionPlan?.title || ""}</p></div></div><Button asChild variant="outline" className="mt-auto h-11 w-full"><Link href="/client-nutrition">Λίστα για ψώνια</Link></Button></CardContent></Card>
        </div>

        <Card><CardContent className="p-[22px] sm:px-6"><CardTitle className="pb-2 text-base">Τελευταία δραστηριότητα</CardTitle><div className="divide-y divide-[#f0f0ee]">{dashboard?.lastUpdate ? <ActivityRow icon={<CheckCircle2 className="h-4 w-4" />} title="Υποβλήθηκε εβδομαδιαίο update" detail={formatDate(dashboard.lastUpdate.submittedAt)} /> : <ActivityRow icon={<CalendarDays className="h-4 w-4" />} title="Δεν υπάρχει update ακόμα" detail="Το πρώτο σου check-in θα εμφανιστεί εδώ." />}{nutritionPlan && <ActivityRow icon={<Salad className="h-4 w-4" />} title="Το πλάνο διατροφής είναι διαθέσιμο" detail={nutritionPlan.title} />}</div></CardContent></Card>
      </div>

      <aside className="space-y-5"><Card><CardContent className="p-[22px]"><div className="flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-[1px] text-muted-foreground">Συνδρομή</p><Badge className="bg-black px-2.5 py-1 text-[11px] font-extrabold text-accent">{client?.planName || "ΠΛΑΝΟ"}</Badge></div><div className="mt-3 flex items-baseline gap-2"><p className="text-[40px] font-extrabold italic leading-none tracking-[-1px] tabular-nums">{subscriptionActive ? client?.daysRemaining ?? "-" : "-"}</p><span className="text-[13px] text-muted-foreground">ημέρες απομένουν</span></div>{subscriptionActive ? <><Progress value={subscriptionProgress} className="mt-4 h-2" /><div className="mt-2 flex justify-between text-xs text-[#8a8a8a]"><span>{formatDate(client?.subscriptionStartDate)}</span><span>{formatDate(client?.subscriptionEndDate)}</span></div></> : <p className="mt-4 text-xs text-muted-foreground">Αναμονή επιβεβαίωσης από τον coach</p>}<Button asChild variant="outline" className="mt-4 h-10 w-full"><Link href="/client-payments">Διαχείριση συνδρομής</Link></Button></CardContent></Card><PointsWidget /><div className="grid grid-cols-2 gap-3"><Card variant="stat" className="rounded-2xl"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Τρέχον βάρος</p><p className="mt-1 text-2xl font-extrabold tabular-nums">{client?.currentWeight ?? "-"}{client?.currentWeight ? " kg" : ""}</p><p className="text-[11px] text-[#8a8a8a]">τελευταίο check-in</p></CardContent></Card><Link href="/client-progress" className="rounded-2xl border border-border bg-card p-4 transition-colors hover:bg-muted"><p className="text-xs text-muted-foreground">Πρόοδος</p><p className="mt-2 text-base font-extrabold">Δες αναλυτικά <ArrowRight className="inline h-4 w-4" /></p><p className="mt-1 text-[11px] text-[#8a8a8a]">βάρος, ρεκόρ, φωτό</p></Link></div></aside>
    </section>
  </div>
}

function ActivityRow({ icon, title, detail }: { icon: ReactNode; title: string; detail: string }) { return <div className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"><span className="grid h-9 w-9 place-items-center rounded-[10px] bg-[var(--sp-lime-soft)] text-black">{icon}</span><div className="min-w-0"><p className="text-sm font-semibold">{title}</p><p className="truncate text-xs text-[#8a8a8a]">{detail}</p></div></div> }
function ScaleIcon() { return <Dumbbell className="h-4 w-4 text-primary" /> }

const confettiColors = ["bg-lime-400", "bg-white", "bg-lime-300", "bg-neutral-400"]

function BirthdayCelebration({ firstName, onClose }: { firstName: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-hidden bg-black/60 p-4 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-labelledby="birthday-title">
      <style>{`@keyframes birthday-confetti { 0% { opacity: 0; transform: translateY(-14vh) rotate(0deg) scale(.7); } 12% { opacity: 1; } 78% { opacity: 1; } 100% { opacity: 0; transform: translateY(82vh) rotate(450deg) scale(1); } } @keyframes birthday-card { 0% { opacity: 0; transform: translateY(18px) scale(.96); } 100% { opacity: 1; transform: translateY(0) scale(1); } }`}</style>
      {Array.from({ length: 18 }, (_, index) => (
        <span
          key={index}
          aria-hidden="true"
          className={`pointer-events-none absolute h-2 w-2 rounded-full ${confettiColors[index % confettiColors.length]}`}
          style={{ left: `${7 + ((index * 23) % 86)}%`, animation: `birthday-confetti ${1.25 + (index % 4) * 0.16}s cubic-bezier(.2,.8,.3,1) ${((index * 67) % 360) / 1000}s forwards` }}
        />
      ))}
      <Card className="relative w-full max-w-[23rem] overflow-hidden rounded-3xl border-0 bg-black text-center shadow-2xl" style={{ animation: "birthday-card 280ms cubic-bezier(.2,.8,.3,1) both" }}>
        <CardContent className="relative p-0">
          <span aria-hidden="true" className="pointer-events-none" style={{ position: "absolute", left: "40px", top: "-30px", width: "22px", height: "280px", background: "#b0f90c", transform: "skewX(-18deg)" }} />
          <button
            type="button"
            onClick={onClose}
            aria-label="Κλείσιμο"
            className="absolute right-4 top-4 z-10 grid h-8 w-8 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"
          >
            <X className="h-4 w-4" />
          </button>
          <span aria-hidden="true" className="absolute right-6 top-3 h-1.5 w-1.5 rounded-full bg-lime-400" />

          <div className="relative px-7 pb-7 pt-10">
            <span className="mx-auto grid h-20 w-20 place-items-center rounded-full border-2 border-lime-400 bg-black shadow-[0_0_0_6px_rgba(163,230,53,0.08)]">
              <Gift className="h-9 w-9 text-lime-400" />
            </span>
            <div className="mt-4 flex items-center justify-center gap-1.5 text-xs font-bold tracking-widest text-lime-400">
              <Sparkles className="h-3.5 w-3.5" /> {greekCaps("Μια ξεχωριστή μέρα")} <Sparkles className="h-3.5 w-3.5" />
            </div>
            <h2 id="birthday-title" className="mt-4 text-3xl font-black italic leading-tight tracking-tight text-white">
              {greekCaps("Χρόνια πολλά,")}<br /><span className="text-lime-400">{greekCaps(`${firstName}!`)}</span>
            </h2>
            <p className="mt-3 text-sm leading-6 text-neutral-400">Σου ευχόμαστε υγεία, χαρά και μια χρονιά γεμάτη πρόοδο.</p>
            <Button type="button" className="mt-6 h-11 w-full rounded-full bg-lime-400 font-bold text-black hover:bg-lime-300" onClick={onClose}>Συνέχεια <ArrowRight className="ml-2 h-4 w-4" /></Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function ClientDashboardContent() {
  const { user, logout } = useAuth()
  const [dashboard, setDashboard] = useState<DashboardData | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [updates, setUpdates] = useState<Update[]>([])
  const [trainingPlan, setTrainingPlan] = useState<TrainingPlan>(null)
  const [nutritionPlan, setNutritionPlan] = useState<NutritionPlanPreview>(null)
  const [workoutHistory, setWorkoutHistory] = useState<WorkoutLog[]>([])
  const [activeWorkout, setActiveWorkout] = useState<ActiveWorkout>(null)
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null)
  const [answers, setAnswers] = useState<Record<number, string | string[]>>({})
  const [files, setFiles] = useState<UpdateFile[]>([])
  const [activeTab, setActiveTab] = useState("overview")
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState("")
  const [showBirthdayCelebration, setShowBirthdayCelebration] = useState(false)

  const loadDashboard = async () => {
    setLoading(true)
    try {
      const [dashboardResponse, updatesResponse, questionsResponse, trainingResponse, nutritionResponse, paymentsResponse, workoutHistoryResponse, activeWorkoutResponse] = await Promise.all([
        api.get<DashboardData>("/client/dashboard"),
        api.get<Update[]>("/client/updates"),
        api.get<Question[]>("/updates/questions"),
        api.get<TrainingPlan>("/client/training-plan", { cache: "no-store" }),
        api.get<NutritionPlanPreview>("/client/nutrition-plan"),
        api.get<PaymentData>("/client/payments"),
        api.get<WorkoutLog[]>("/client/workout/history", { cache: "no-store" }),
        api.get<ActiveWorkout>("/client/workout/active", { cache: "no-store" }),
      ])
      setDashboard(dashboardResponse)
      setUpdates(updatesResponse)
      setQuestions(questionsResponse)
      setTrainingPlan(trainingResponse)
      setNutritionPlan(nutritionResponse)
      setPaymentData(paymentsResponse)
      setWorkoutHistory(workoutHistoryResponse)
      setActiveWorkout(activeWorkoutResponse)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Δεν ήταν δυνατή η φόρτωση του dashboard.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void loadDashboard() }, [])

  useEffect(() => {
    const refreshAfterReturn = () => {
      if (document.visibilityState === "visible") void loadDashboard()
    }
    window.addEventListener("pageshow", refreshAfterReturn)
    document.addEventListener("visibilitychange", refreshAfterReturn)
    window.addEventListener("workout-completed", refreshAfterReturn)
    return () => {
      window.removeEventListener("pageshow", refreshAfterReturn)
      document.removeEventListener("visibilitychange", refreshAfterReturn)
      window.removeEventListener("workout-completed", refreshAfterReturn)
    }
  }, [])

  useEffect(() => {
    if (!dashboard?.client.birthdayToday || !user?.id || user.role !== "client") return

    const todayKey = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Athens" })
    const storageKey = `birthday-celebration:v2:${user.id}:${todayKey}`
    try {
      if (window.localStorage.getItem(storageKey)) return
      window.localStorage.setItem(storageKey, "shown")
      setShowBirthdayCelebration(true)
    } catch {
      setShowBirthdayCelebration(true)
    }
  }, [dashboard?.client.birthdayToday, user?.id])
  const chartData = useMemo(() => updates
    .map((update) => {
      return update.weight ? { date: formatDate(update.submittedAt), weight: Number(update.weight) } : null
    })
    .filter((entry): entry is { date: string; weight: number } => entry !== null)
    .reverse(), [updates])

  const setProgressPhoto = (questionId: number, angle: "front" | "side" | "back", file?: File) => {
    setFiles((current) => {
      const withoutAngle = current.filter((entry) => entry.questionId !== questionId || entry.angle !== angle)
      return file ? [...withoutAngle, { file, questionId, angle }] : withoutAngle
    })
  }

  const addUpdateFiles = (questionId: number, nextFiles: File[], angle: UpdateFile["angle"] = "other") => {
    setFiles((current) => [...current, ...nextFiles.map((file) => ({ file, questionId, angle }))].slice(0, 5))
  }

  const renderQuestion = (question: Question) => {
    const value = answers[question.id] ?? (question.type === "multi_select" ? [] : "")
    const setValue = (next: string | string[]) => setAnswers((current) => ({ ...current, [question.id]: next }))
    const required = question.isRequired ? <span className="text-destructive"> *</span> : null

    if (question.allowPhotos || question.allowPdf || question.type === "photos" || question.type === "pdf") {
      const supportsPhotos = question.allowPhotos || question.type === "photos"
      const supportsPdf = question.allowPdf || question.type === "pdf"
      const questionFiles = files.filter((entry) => entry.questionId === question.id)

      return <div key={question.id} className="space-y-3">
        <div className="space-y-1">
          <Label className="text-base font-semibold">{question.question}{required}</Label>
          {supportsPhotos && <p className="text-xs text-muted-foreground">Πρόσθεσε μία φωτογραφία για κάθε όψη, ώστε ο coach να βλέπει καθαρά την πρόοδό σου.</p>}
        </div>
        {supportsPhotos && <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {updatePhotoAngles.map((photoAngle) => {
            const selected = questionFiles.find((entry) => entry.angle === photoAngle.key)
            return <div key={photoAngle.key} className="space-y-1.5">
              <label className={`flex h-28 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed p-2 text-center transition-colors ${selected ? "border-accent bg-[color:var(--sp-lime-soft)]" : "border-border bg-muted/20 hover:bg-muted/40"}`}>
                <Input
                  className="hidden"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onClick={(event) => { event.currentTarget.value = "" }}
                  onChange={(event) => setProgressPhoto(question.id, photoAngle.key, event.target.files?.[0])}
                />
                <span className={`grid h-8 w-8 place-items-center rounded-full ${selected ? "bg-accent text-accent-foreground" : "bg-background text-muted-foreground"}`}><ImagePlus className="h-4 w-4" /></span>
                <span className="text-xs font-extrabold">{photoAngle.label}</span>
                <span className="max-w-full truncate text-[10px] text-muted-foreground">{selected ? selected.file.name : "Πρόσθεσε"}</span>
              </label>
              {selected && <button type="button" onClick={() => setProgressPhoto(question.id, photoAngle.key)} className="w-full text-[10px] font-semibold text-muted-foreground hover:text-foreground">Αφαίρεση</button>}
            </div>
          })}
        </div>}
        {supportsPdf && <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-border bg-muted/20 p-3 text-sm transition-colors hover:bg-muted/40"><span className="grid h-8 w-8 place-items-center rounded-md bg-background"><Paperclip className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="block font-medium">Πρόσθεσε PDF</span><span className="block text-xs text-muted-foreground">Έως 1 αρχείο, 5MB</span></span><Input className="hidden" type="file" accept="application/pdf" onClick={(event) => { event.currentTarget.value = "" }} onChange={(event) => addUpdateFiles(question.id, Array.from(event.target.files ?? []))} /></label>}
      </div>
    }

    if (question.type === "rating") {
      return <div key={question.id} className="space-y-3"><Label className="text-base font-semibold">{question.question}{required}</Label><div className="rounded-lg border border-border bg-muted/30 p-4"><StarRating value={Number(value) || 0} onChange={(rating) => setValue(String(rating))} /></div></div>
    }
    if (question.type === "textarea") {
      return <div key={question.id} className="space-y-2"><Label className="text-base font-semibold">{question.question}{required}</Label><Textarea value={String(value)} placeholder={question.placeholder ?? ""} onChange={(event) => setValue(event.target.value)} className="min-h-28 resize-y" /></div>
    }
    if (question.type === "select" || question.type === "single_select") {
      return <fieldset key={question.id} className="space-y-3"><legend className="text-base font-semibold">{question.question}{required}</legend><div className="flex flex-wrap gap-2">{(question.options ?? []).map((option) => <button type="button" key={option} onClick={() => setValue(option)} className={`rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${value === option ? "border-primary bg-primary/10 text-foreground" : "bg-background hover:bg-muted"}`}>{option}</button>)}</div></fieldset>
    }
    if (question.type === "multi_select") {
      const selected = Array.isArray(value) ? value : []
      return <fieldset key={question.id} className="space-y-3"><legend className="text-base font-semibold">{question.question}{required}</legend><div className="flex flex-wrap gap-2">{(question.options ?? []).map((option) => <button type="button" key={option} onClick={() => setValue(selected.includes(option) ? selected.filter((item) => item !== option) : [...selected, option])} className={`rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${selected.includes(option) ? "border-primary bg-primary/10 text-foreground" : "bg-background hover:bg-muted"}`}>{option}</button>)}</div></fieldset>
    }
    return <div key={question.id} className="space-y-3"><div className="space-y-2"><Label className="text-base font-semibold">{question.question}{required}</Label><Input type={question.type === "number" ? "number" : question.type === "url" ? "url" : "text"} autoComplete={question.type === "url" ? "off" : undefined} value={String(value)} placeholder={question.placeholder ?? ""} onChange={(event) => setValue(event.target.value)} className="h-11" /></div></div>
  }

  const submitUpdate = async (event: FormEvent) => {
    event.preventDefault()
    setError("")
    const unansweredRequired = questions.some((question) => question.isRequired && (!answers[question.id] || (Array.isArray(answers[question.id]) && answers[question.id].length === 0)) && !files.some((entry) => entry.questionId === question.id))
    if (unansweredRequired) { setError("Συμπλήρωσε όλα τα υποχρεωτικά πεδία."); return }
    setSubmitting(true)
    try {
      const formData = new FormData()
      formData.append("answers", JSON.stringify(Object.entries(answers).map(([questionId, answer]) => ({ questionId: Number(questionId), answer }))))
      files.forEach(({ file }) => formData.append("files", file))
      formData.append("fileQuestionIds", JSON.stringify(files.map(({ questionId }) => questionId)))
      formData.append("fileAngles", JSON.stringify(files.map(({ angle }) => angle ?? "other")))
      await api.upload("/client/updates/submit", formData)
      setSubmitted(true)
      setAnswers({})
      setFiles([])
      await loadDashboard()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Δεν ήταν δυνατή η υποβολή του update.")
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <ClientShell user={user} logout={logout} paymentApproved={false}><div className="p-6 text-muted-foreground">Φόρτωση dashboard...</div></ClientShell>
  if (error && !dashboard) return <ClientShell user={user} logout={logout} paymentApproved={false}><div className="p-6"><Alert variant="destructive"><AlertTitle>Σφάλμα φόρτωσης</AlertTitle><AlertDescription>{error}</AlertDescription></Alert></div></ClientShell>

  const subscriptionActive = dashboard?.client.subscriptionStatus === "active"
  const upcomingDate = formatDate(dashboard?.nextUpdateDate)

  return (
    <ClientShell user={user} logout={logout} paymentApproved={subscriptionActive} subscriptionStatus={dashboard?.client.subscriptionStatus} daysRemaining={dashboard?.client.daysRemaining} active="dashboard">
      {showBirthdayCelebration && <BirthdayCelebration firstName={dashboard?.client.firstName || ""} onClose={() => setShowBirthdayCelebration(false)} />}
      <main className="mx-auto w-full max-w-none space-y-5 p-4 sm:p-6 lg:px-10 lg:py-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div><h1 className="text-2xl font-extrabold tracking-[-0.5px] sm:text-[28px]">Γεια σου, {dashboard?.client.firstName || ""}</h1><p className="mt-1 text-sm text-muted-foreground">Η προσωπική σου προπόνηση, διατροφή και πρόοδος σε ένα μέρος.</p></div>
          <span className="inline-flex h-[34px] w-fit items-center gap-2 rounded-full border border-border bg-card px-3.5 text-[13px] font-bold"><i className="h-2 w-2 rounded-full bg-accent shadow-[0_0_0_3px_rgb(176_249_12_/_25%)]" />{dashboard?.streak || 0} εβδομάδες συνέπεια</span>
        </div>
        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <div className={activeTab === "overview" ? "hidden" : "w-full overflow-x-auto"}><TabsList className="h-auto"><TabsTrigger value="overview">Αρχική</TabsTrigger><TabsTrigger value="update">Update</TabsTrigger></TabsList></div>

          <TabsContent value="overview" className="space-y-6">
            <ClientHomeOverviewNext dashboard={dashboard} trainingPlan={trainingPlan} nutritionPlan={nutritionPlan} workoutHistory={workoutHistory} activeWorkout={activeWorkout} onOpenUpdate={() => setActiveTab("update")} />
            <div className="hidden">
            {dashboard?.todayIsUpdateDay && !dashboard.alreadySubmittedThisWeek && <Alert><CalendarDays className="h-4 w-4" /><AlertTitle>Σήμερα είναι ημέρα update</AlertTitle><AlertDescription className="flex flex-wrap items-center gap-3">Συμπλήρωσε το εβδομαδιαίο σου update για να ενημερωθεί ο coach σου.<Button size="sm" onClick={() => setActiveTab("update")}>Συμπλήρωση update</Button></AlertDescription></Alert>}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <PlanCard title="Τρέχον βάρος" icon={<Dumbbell className="h-5 w-5 text-primary" />}><p className="text-3xl font-bold">{dashboard?.client.currentWeight ?? "-"}{dashboard?.client.currentWeight ? " kg" : ""}</p></PlanCard>
              <PlanCard title="Ημέρες συνδρομής" icon={<CalendarDays className="h-5 w-5 text-primary" />}><p className="text-3xl font-bold">{dashboard?.client.daysRemaining ?? "-"}</p><p className="text-xs text-muted-foreground">{dashboard?.client.planName ?? "Χωρίς ενεργό πλάνο"}</p></PlanCard>
              <PlanCard title="Σερί updates" icon={<CheckCircle2 className="h-5 w-5 text-primary" />}><p className="text-3xl font-bold">{dashboard?.streak ?? 0}</p><p className="text-xs text-muted-foreground">συνεχόμενες εβδομάδες</p></PlanCard>
              <PlanCard title="Τελευταίο update" icon={<Send className="h-5 w-5 text-primary" />}><p className="text-sm font-medium">{formatDate(dashboard?.lastUpdate?.submittedAt)}</p>{dashboard?.lastUpdate?.averageRating && <StarRating value={dashboard.lastUpdate.averageRating} readOnly />}</PlanCard>
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <PlanCard title="Πρόγραμμα Προπόνησης" icon={<Dumbbell className="h-5 w-5 text-primary" />}>{trainingPlan ? <><p className="font-medium">{trainingPlan.title}</p><p className="mt-1 text-sm text-muted-foreground">{trainingPlan.days.length} ημέρες προπόνησης</p><Button className="mt-4" variant="outline" size="sm" onClick={() => setActiveTab("training")}>Δες το πρόγραμμα</Button></> : <p className="text-sm text-muted-foreground">Δεν έχει ανατεθεί πρόγραμμα προπόνησης ακόμα.</p>}</PlanCard>
              <PlanCard title="Πλάνο Διατροφής" icon={<Salad className="h-5 w-5 text-primary" />}>{nutritionPlan ? <><p className="font-medium">{nutritionPlan.title}</p><p className="mt-1 text-sm text-muted-foreground">{nutritionPlan.meals.length} γεύματα</p><Button asChild nativeButton={false} className="mt-4" variant="outline" size="sm"><Link href="/client-nutrition">Δες τη διατροφή</Link></Button></> : <p className="text-sm text-muted-foreground">Δεν έχει ανατεθεί διατροφικό πλάνο ακόμα.</p>}</PlanCard>
            </div>
            </div>
          </TabsContent>

          <TabsContent value="training"><PlanCard title="Πρόγραμμα Προπόνησης" icon={<Dumbbell className="h-5 w-5 text-primary" />}>{trainingPlan ? <div className="space-y-6"><p className="text-muted-foreground">{trainingPlan.title}</p>{trainingPlan.days.map((day) => <section key={day.name} className="border-t pt-4"><h2 className="font-semibold">{day.name}</h2><div className="mt-3 grid gap-3 sm:grid-cols-2">{day.exercises.map((exercise, index) => <div key={`${exercise.name}-${index}`} className="flex items-center gap-3 rounded-md border p-3">{exercise.imageUrl && <img className="h-12 w-12 rounded object-cover" src={resolveMediaUrl(exercise.imageUrl)} alt="" />}<div><p className="font-medium">{exercise.name}</p><p className="text-xs text-muted-foreground">{exercise.sets ? `${exercise.sets} σετ` : ""}{exercise.reps ? ` · ${exercise.reps}` : ""}</p></div></div>)}</div></section>)}</div> : <p className="text-muted-foreground">Δεν υπάρχει διαθέσιμο πρόγραμμα προπόνησης.</p>}</PlanCard></TabsContent>

          <TabsContent value="progress" className="space-y-6">
            <PlanCard title="Πρόοδος βάρους" icon={<Dumbbell className="h-5 w-5 text-primary" />}>{chartData.length > 1 ? <AreaChart className="h-64" data={chartData} index="date" categories={["weight"]} colors={["blue"]} valueFormatter={(value) => `${value} kg`} /> : <p className="text-sm text-muted-foreground">Χρειάζονται τουλάχιστον δύο ενημερώσεις με βάρος για το γράφημα.</p>}</PlanCard>
            <PlanCard title="Φωτογραφίες προόδου" icon={<Upload className="h-5 w-5 text-primary" />}>{updates.flatMap((update) => update.photos).length ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{updates.flatMap((update) => update.photos).slice(0, 8).map((photo, index) => <a key={`${photo}-${index}`} href={resolveMediaUrl(photo)} target="_blank" rel="noreferrer"><img className="aspect-square w-full rounded-md object-cover" src={resolveMediaUrl(photo)} alt="Φωτογραφία προόδου" /></a>)}</div> : <p className="text-sm text-muted-foreground">Δεν υπάρχουν φωτογραφίες προόδου ακόμα.</p>}</PlanCard>
            <PlanCard title="Ιστορικό updates" icon={<FileText className="h-5 w-5 text-primary" />}>{updates.length ? <div className="space-y-3">{updates.map((update) => <div key={update.id} className="flex flex-wrap items-center justify-between gap-3 border-b pb-3 last:border-0"><div><p className="font-medium">{formatDate(update.submittedAt)}</p><p className="text-xs text-muted-foreground">{update.answers?.length || 0} απαντήσεις · {update.photos?.length || 0} φωτογραφίες</p></div></div>)}</div> : <p className="text-sm text-muted-foreground">Δεν έχεις υποβάλει update ακόμα.</p>}</PlanCard>
          </TabsContent>

          <TabsContent value="payments"><div className="grid gap-6 lg:grid-cols-3"><PlanCard title="Συνδρομή" icon={<CalendarDays className="h-5 w-5 text-primary" />}><Badge>{paymentData?.subscription?.status === "active" ? "Ενεργή" : "-"}</Badge><p className="mt-3 font-medium">{paymentData?.subscription?.planName ?? "Δεν υπάρχει ενεργή συνδρομή"}</p><p className="text-sm text-muted-foreground">{paymentData?.subscription?.daysRemaining != null ? `${paymentData.subscription.daysRemaining} ημέρες απομένουν` : ""}</p></PlanCard><PlanCard title="Πληρωμές" icon={<FileText className="h-5 w-5 text-primary" />}><p className="text-3xl font-bold">{paymentData?.payments.length ?? 0}</p><p className="text-sm text-muted-foreground">καταγεγραμμένες πληρωμές</p></PlanCard><PlanCard title="Επόμενη λήξη" icon={<CalendarDays className="h-5 w-5 text-primary" />}><p className="text-lg font-semibold">{formatDate(paymentData?.subscription?.endDate)}</p></PlanCard></div><PlanCard title="Ιστορικό πληρωμών" icon={<FileText className="h-5 w-5 text-primary" />}>{paymentData?.payments.length ? <div className="space-y-3">{paymentData.payments.map((payment) => <div key={payment.id} className="flex items-center justify-between border-b pb-3 last:border-0"><div><p className="font-medium">€{Number(payment.amount).toFixed(2)}</p><p className="text-xs text-muted-foreground">{formatDate(payment.paidAt)} · {paymentMethod[payment.method] ?? payment.method}</p></div><Badge variant={payment.status === "confirmed" ? "default" : "secondary"}>{payment.status === "confirmed" ? "Εγκρίθηκε" : "Εκκρεμεί"}</Badge></div>)}</div> : <p className="text-sm text-muted-foreground">Δεν υπάρχουν πληρωμές ακόμα.</p>}</PlanCard></TabsContent>

          <TabsContent value="update">
            {submitted ? <Card><CardContent className="flex min-h-72 flex-col items-center justify-center text-center"><CheckCircle2 className="h-14 w-14 text-green-600" /><h2 className="mt-4 text-xl font-semibold">Το update υποβλήθηκε!</h2><p className="mt-2 text-sm text-muted-foreground">Ο coach σου ενημερώθηκε.</p></CardContent></Card> : dashboard?.alreadySubmittedThisWeek ? <Card><CardContent className="flex min-h-72 flex-col items-center justify-center text-center"><CheckCircle2 className="h-14 w-14 text-green-600" /><h2 className="mt-4 text-xl font-semibold">Έχεις ήδη υποβάλει το update σου</h2><p className="mt-2 text-sm text-muted-foreground">Το επόμενο update είναι στις {upcomingDate}.</p></CardContent></Card> : !dashboard?.todayIsUpdateDay ? <Card><CardContent className="flex min-h-72 flex-col items-center justify-center text-center"><CalendarDays className="h-14 w-14 text-primary" /><h2 className="mt-4 text-xl font-semibold">Το επόμενο update είναι στις {upcomingDate}</h2><p className="mt-2 text-sm text-muted-foreground">Επιστρέψε εκείνη την ημέρα για να συμπληρώσεις το εβδομαδιαίο σου update.</p><p className="mt-5 text-xs text-muted-foreground">Έχεις υποβάλει {dashboard?.updatesCount ?? 0} updates συνολικά.</p></CardContent></Card> : <Card><CardHeader><CardTitle>Εβδομαδιαίο Update</CardTitle><CardDescription>Συμπλήρωσε την εβδομαδιαία σου αναφορά. Τα στοιχεία θα σταλούν απευθείας στον coach σου.</CardDescription></CardHeader><CardContent><form className="space-y-6" onSubmit={submitUpdate}>{questions.map(renderQuestion)}<div className="border-t pt-5"><Button type="submit" size="lg" disabled={submitting}><Send className="mr-2 h-4 w-4" />{submitting ? "Υποβολή..." : "Υποβολή Update"}</Button></div></form></CardContent></Card>}
          </TabsContent>
        </Tabs>
      </main>
    </ClientShell>
  )
}

export default function ClientDashboardPage() {
  return <ProtectedRoute allow="client-dashboard"><ClientDashboardContent /></ProtectedRoute>
}
