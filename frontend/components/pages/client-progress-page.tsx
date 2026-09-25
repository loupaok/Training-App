"use client"

import { useEffect, useMemo, useState } from "react"
import { AreaChart, BarChart } from "@tremor/react"
import { CalendarDays, Camera, Dumbbell, ImageOff, Scale, TrendingDown, TrendingUp, Trophy } from "lucide-react"
import { ProtectedRoute } from "@/components/auth/protected-route"
import { ClientShell } from "@/components/shell/client-shell"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { api } from "@/lib/api/client"
import { useAuth } from "@/lib/auth/auth-context"
import { resolveMediaUrl } from "@/lib/media"

type WeeklyUpdate = {
  id: number
  submittedAt: string
  weekStart?: string | null
  weight: number | null
  trainingRating?: number | null
  nutritionRating?: number | null
  generalRating?: number | null
  notes?: string | null
  photos?: string[]
}

type ProgressResponse = {
  weights: Array<{ submittedAt: string; weight: number }>
  photos: string[]
  updates: WeeklyUpdate[]
}

type Workout = {
  id: number
  day_name?: string | null
  completed_at: string
  duration_seconds?: number | null
  total_sets_completed?: number | null
  total_volume_kg?: number | null
  workout_feeling?: string | null
  setLogs?: Array<{ exercise_name?: string; weight_kg?: number | null; reps_completed?: number | null }>
}

const dayFormatter = new Intl.DateTimeFormat("el-GR", { day: "numeric", month: "short", year: "numeric" })
const monthFormatter = new Intl.DateTimeFormat("el-GR", { month: "short" })
const number = (value: number | null | undefined) => Number(value || 0)
const formatDate = (value?: string | null) => value ? dayFormatter.format(new Date(value)) : "-"
const formatDuration = (seconds?: number | null) => {
  const minutes = Math.round(number(seconds) / 60)
  return minutes ? `${minutes} λεπτά` : "-"
}
const stars = (rating?: number | null) => rating ? "★".repeat(Math.max(0, Math.min(5, Math.round(rating)))) + "☆".repeat(Math.max(0, 5 - Math.round(rating))) : "-"
const feelings: Record<string, string> = { easy: "Εύκολο", good: "Καλά", hard: "Δύσκολο", pr: "PR" }

function StatCard({ label, value, detail, icon: Icon, trend }: { label: string; value: string; detail: string; icon: typeof Scale; trend?: "up" | "down" }) {
  const TrendIcon = trend === "down" ? TrendingDown : TrendingUp
  return <Card className="rounded-xl border-border shadow-sm"><CardContent className="p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-bold tabular-nums">{value}</p><p className="mt-1 text-xs text-muted-foreground">{detail}</p></div><span className="grid h-10 w-10 place-items-center rounded-lg bg-muted"><Icon className="h-5 w-5" /></span></div>{trend && <span className="mt-4 flex items-center gap-1 text-xs text-muted-foreground"><TrendIcon className="h-3.5 w-3.5" />Μεταβολή από την αρχή</span>}</CardContent></Card>
}

function ClientProgressContent() {
  const { user, logout } = useAuth()
  const [data, setData] = useState<ProgressResponse | null>(null)
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [totalVolume, setTotalVolume] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [photo, setPhoto] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    Promise.all([
      api.get<ProgressResponse>("/client/progress"),
      api.get<Workout[]>("/client/workout/history"),
      api.get<{ totalVolumeKg: number }>("/client/workout/total-volume"),
    ]).then(([progress, workoutRows, volume]) => {
      if (!active) return
      setData(progress)
      setWorkouts(Array.isArray(workoutRows) ? workoutRows : [])
      setTotalVolume(number(volume.totalVolumeKg))
    }).catch((loadError) => {
      if (active) setError(loadError instanceof Error ? loadError.message : "Δεν ήταν δυνατή η φόρτωση της προόδου.")
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const weights = useMemo(() => (data?.weights || []).map((entry) => ({ ...entry, date: formatDate(entry.submittedAt) })), [data])
  const startWeight = weights[0]?.weight ?? null
  const currentWeight = weights.at(-1)?.weight ?? null
  const weightChange = startWeight !== null && currentWeight !== null ? currentWeight - startWeight : null
  const currentMonth = new Date().getMonth()
  const currentYear = new Date().getFullYear()
  const monthlyWorkouts = workouts.filter((workout) => {
    const date = new Date(workout.completed_at)
    return date.getMonth() === currentMonth && date.getFullYear() === currentYear
  }).length
  const recentUpdates = data?.updates || []
  const fourWeeksAgo = Date.now() - 28 * 24 * 60 * 60 * 1000
  const updateConsistency = recentUpdates.filter((update) => new Date(update.submittedAt).getTime() >= fourWeeksAgo).length
  const monthlyVolume = useMemo(() => {
    const buckets = new Map<string, number>()
    for (let offset = 5; offset >= 0; offset -= 1) {
      const date = new Date(currentYear, currentMonth - offset, 1)
      buckets.set(`${date.getFullYear()}-${date.getMonth()}`, 0)
    }
    workouts.forEach((workout) => {
      const date = new Date(workout.completed_at)
      const key = `${date.getFullYear()}-${date.getMonth()}`
      if (buckets.has(key)) buckets.set(key, number(buckets.get(key)) + number(workout.total_volume_kg))
    })
    return [...buckets.entries()].map(([key, volume]) => {
      const [year, month] = key.split("-").map(Number)
      return { month: monthFormatter.format(new Date(year, month, 1)), volume: Math.round(volume) }
    })
  }, [workouts, currentMonth, currentYear])
  const personalBests = useMemo(() => {
    const bests = new Map<string, number>()
    workouts.forEach((workout) => workout.setLogs?.forEach((set) => {
      const exercise = set.exercise_name?.trim()
      if (!exercise) return
      bests.set(exercise, Math.max(bests.get(exercise) || 0, number(set.weight_kg)))
    }))
    return [...bests.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)
  }, [workouts])
  const paymentApproved = user?.status === "active"

  return <ClientShell title="Progress" user={user} logout={logout} paymentApproved={paymentApproved} active="progress">
    <main className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
      <div><h1 className="text-2xl font-bold">Η πρόοδός μου</h1><p className="mt-1 text-sm text-muted-foreground">Οι μετρήσεις, τα check-ins και οι προπονήσεις σου σε ένα μέρος.</p></div>
      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      {loading ? <div className="space-y-6"><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-36" />)}</div><Skeleton className="h-80" /></div> : <>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Τρέχον βάρος" value={currentWeight !== null ? `${currentWeight.toLocaleString("el-GR")} kg` : "-"} detail={weightChange === null ? "Πρόσθεσε check-in με βάρος" : `${weightChange > 0 ? "+" : ""}${weightChange.toLocaleString("el-GR", { maximumFractionDigits: 1 })} kg από την αρχή`} icon={Scale} trend={weightChange === null ? undefined : weightChange <= 0 ? "down" : "up"} />
          <StatCard label="Προπονήσεις μήνα" value={String(monthlyWorkouts)} detail="Ολοκληρωμένες προπονήσεις" icon={Dumbbell} />
          <StatCard label="Συνολικός όγκος" value={`${Math.round(totalVolume).toLocaleString("el-GR")} kg`} detail="Από τις καταγεγραμμένες προπονήσεις" icon={Trophy} />
          <StatCard label="Συνέπεια updates" value={`${updateConsistency}/4`} detail="Check-ins τις τελευταίες 4 εβδομάδες" icon={CalendarDays} />
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="h-auto w-full justify-start overflow-x-auto"><TabsTrigger value="overview">Επισκόπηση</TabsTrigger><TabsTrigger value="workouts">Προπονήσεις</TabsTrigger><TabsTrigger value="checkins">Check-ins</TabsTrigger></TabsList>
          <TabsContent value="overview" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(18rem,0.85fr)]">
              <Card><CardHeader><CardTitle className="text-lg">Βάρος</CardTitle></CardHeader><CardContent>{weights.length > 1 ? <AreaChart className="h-72" data={weights} index="date" categories={["weight"]} colors={["blue"]} valueFormatter={(value) => `${value} kg`} /> : <EmptyChart text="Χρειάζονται τουλάχιστον δύο check-ins με βάρος για το γράφημα." />}</CardContent></Card>
              <Card><CardHeader><CardTitle className="text-lg">Προσωπικά ρεκόρ</CardTitle></CardHeader><CardContent className="space-y-3">{personalBests.length ? personalBests.map(([exercise, weight]) => <div key={exercise} className="flex items-center justify-between gap-3 rounded-lg bg-muted/50 px-3 py-3"><span className="truncate text-sm font-medium">{exercise}</span><Badge variant="outline" className="shrink-0">{weight.toLocaleString("el-GR")} kg</Badge></div>) : <p className="py-8 text-center text-sm text-muted-foreground">Τα προσωπικά ρεκόρ θα εμφανιστούν μετά την πρώτη σου προπόνηση.</p>}</CardContent></Card>
            </div>
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(18rem,0.85fr)]">
              <Card><CardHeader><CardTitle className="text-lg">Μηνιαίος όγκος προπόνησης</CardTitle></CardHeader><CardContent>{workouts.length ? <BarChart className="h-64" data={monthlyVolume} index="month" categories={["volume"]} colors={["emerald"]} valueFormatter={(value) => `${value.toLocaleString("el-GR")} kg`} /> : <EmptyChart text="Δεν υπάρχουν ολοκληρωμένες προπονήσεις ακόμα." />}</CardContent></Card>
              <PhotosCard photos={data?.photos || []} onSelect={setPhoto} />
            </div>
          </TabsContent>
          <TabsContent value="workouts"><WorkoutList workouts={workouts} /></TabsContent>
          <TabsContent value="checkins"><CheckinList updates={recentUpdates} onSelectPhoto={setPhoto} /></TabsContent>
        </Tabs>
      </>}
    </main>
    <Dialog open={Boolean(photo)} onOpenChange={(open) => !open && setPhoto(null)}><DialogContent className="max-w-3xl p-2"><img src={photo ? resolveMediaUrl(photo) : ""} alt="Φωτογραφία προόδου" className="max-h-[80vh] w-full rounded-md object-contain" /></DialogContent></Dialog>
  </ClientShell>
}

function EmptyChart({ text }: { text: string }) { return <div className="grid h-64 place-items-center text-center text-sm text-muted-foreground">{text}</div> }

function PhotosCard({ photos, onSelect }: { photos: string[]; onSelect: (photo: string) => void }) {
  return <Card><CardHeader><CardTitle className="text-lg">Φωτογραφίες προόδου</CardTitle></CardHeader><CardContent>{photos.length ? <div className="grid grid-cols-2 gap-3">{photos.slice(0, 4).map((item, index) => <button key={`${item}-${index}`} type="button" onClick={() => onSelect(item)} className="group relative aspect-square overflow-hidden rounded-lg bg-muted"><img src={resolveMediaUrl(item)} alt="Φωτογραφία προόδου" className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105" /></button>)}</div> : <div className="grid h-48 place-items-center text-center text-sm text-muted-foreground"><span><Camera className="mx-auto mb-2 h-5 w-5" />Δεν υπάρχουν φωτογραφίες ακόμα.</span></div>}</CardContent></Card>
}

function WorkoutList({ workouts }: { workouts: Workout[] }) {
  return <Card><CardHeader><CardTitle className="text-lg">Πρόσφατες προπονήσεις</CardTitle></CardHeader><CardContent>{workouts.length ? <div className="divide-y">{workouts.map((workout) => <div key={workout.id} className="flex flex-wrap items-center gap-4 py-4 first:pt-0"><span className="grid h-10 w-10 place-items-center rounded-lg bg-muted"><Dumbbell className="h-5 w-5" /></span><div className="min-w-[12rem] flex-1"><p className="font-medium">{workout.day_name || "Προπόνηση"}</p><p className="text-xs text-muted-foreground">{formatDate(workout.completed_at)}</p></div><div className="text-sm"><p className="font-medium">{formatDuration(workout.duration_seconds)}</p><p className="text-xs text-muted-foreground">Διάρκεια</p></div><div className="text-sm"><p className="font-medium">{Math.round(number(workout.total_volume_kg)).toLocaleString("el-GR")} kg</p><p className="text-xs text-muted-foreground">Όγκος</p></div><div className="text-sm"><p className="font-medium">{number(workout.total_sets_completed)}</p><p className="text-xs text-muted-foreground">Σετ</p></div>{workout.workout_feeling && <Badge variant="secondary">{feelings[workout.workout_feeling] || workout.workout_feeling}</Badge>}</div>)}</div> : <EmptyChart text="Δεν υπάρχουν ολοκληρωμένες προπονήσεις ακόμα." />}</CardContent></Card>
}

function CheckinList({ updates, onSelectPhoto }: { updates: WeeklyUpdate[]; onSelectPhoto: (photo: string) => void }) {
  return <Card><CardHeader><CardTitle className="text-lg">Ιστορικό check-ins</CardTitle></CardHeader><CardContent>{updates.length ? <Accordion defaultValue={updates.slice(0, 1).map((update) => String(update.id))}>{updates.map((update) => <AccordionItem key={update.id} value={String(update.id)}><AccordionTrigger className="hover:no-underline"><div className="flex min-w-0 flex-1 items-center justify-between gap-4 pr-3"><span className="text-left"><span className="block font-medium">{formatDate(update.submittedAt)}</span><span className="text-xs text-muted-foreground">{update.weight !== null ? `${update.weight} kg` : "Χωρίς καταχώριση βάρους"}</span></span><span className="hidden text-xs text-muted-foreground sm:block">Προπόνηση {stars(update.trainingRating)} · Διατροφή {stars(update.nutritionRating)}</span></div></AccordionTrigger><AccordionContent className="space-y-4 pb-4"><div className="grid gap-3 sm:grid-cols-3"><Rating label="Προπόνηση" value={update.trainingRating} /><Rating label="Διατροφή" value={update.nutritionRating} /><Rating label="Εβδομάδα" value={update.generalRating} /></div>{update.notes && <p className="rounded-lg bg-muted/60 p-3 text-sm text-muted-foreground">{update.notes}</p>}{update.photos?.length ? <><Separator /><div className="flex gap-3 overflow-x-auto pb-1">{update.photos.map((item, index) => <button key={`${item}-${index}`} type="button" onClick={() => onSelectPhoto(item)} className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-muted"><img src={resolveMediaUrl(item)} alt="Φωτογραφία update" className="h-full w-full object-cover" /></button>)}</div></> : null}</AccordionContent></AccordionItem>)}</Accordion> : <EmptyChart text="Δεν έχεις υποβάλει check-in ακόμα." />}</CardContent></Card>
}

function Rating({ label, value }: { label: string; value?: number | null }) { return <div className="rounded-lg bg-muted/50 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-sm tracking-wide text-amber-500">{stars(value)}</p></div> }

export default function ClientProgressPage() { return <ProtectedRoute allow="client-active"><ClientProgressContent /></ProtectedRoute> }
