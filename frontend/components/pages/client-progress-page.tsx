"use client"

import { useEffect, useMemo, useState } from "react"
import { AreaChart, BarChart } from "@tremor/react"
import { CalendarDays, Camera, Dumbbell, ImageOff, Scale, Target, TrendingDown, TrendingUp, Trophy } from "lucide-react"
import { ProtectedRoute } from "@/components/auth/protected-route"
import { ClientShell } from "@/components/shell/client-shell"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardHint, CardLabel, CardTitle, CardValue } from "@/components/ui/card"
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
  startingWeight?: number | null
  targetWeight?: number | null
  fitnessGoal?: string | null
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
  return <Card variant="stat"><CardContent className="p-5"><div className="flex items-start justify-between gap-3"><div><CardLabel>{label}</CardLabel><CardValue className="mt-2">{value}</CardValue><CardHint className="mt-1">{detail}</CardHint></div><span className="grid h-10 w-10 place-items-center rounded-xl bg-muted"><Icon className="h-5 w-5" /></span></div>{trend && <span className="mt-4 flex items-center gap-1 text-xs text-muted-foreground"><TrendIcon className="h-3.5 w-3.5" />Μεταβολή από την αρχή</span>}</CardContent></Card>
}

function GoalStat({ targetWeight, remaining, progress }: { targetWeight: number | null; remaining: number | null; progress: number | null }) {
  return <Card variant="stat"><CardContent className="p-5"><div className="flex items-start justify-between gap-3"><div><CardLabel>Στόχος βάρους</CardLabel><CardValue className="mt-2">{targetWeight !== null ? `${targetWeight.toLocaleString("el-GR")} kg` : "—"}</CardValue><CardHint className="mt-1">{targetWeight === null ? "Δεν έχει οριστεί ακόμη" : remaining === 0 ? "Έφτασες τον στόχο σου" : `${remaining?.toLocaleString("el-GR", { maximumFractionDigits: 1 })} kg απομένουν`}</CardHint></div><span className="grid h-10 w-10 place-items-center rounded-xl bg-muted"><Target className="h-5 w-5" /></span></div>{progress !== null && <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-accent" style={{ width: `${progress}%` }} /></div>}</CardContent></Card>
}

type WeightPoint = { submittedAt: string; weight: number; date: string }

function ProgressWeightChart({ points, targetWeight }: { points: WeightPoint[]; targetWeight: number | null }) {
  if (points.length < 2) return <EmptyChart text="Χρειάζονται τουλάχιστον δύο καταγραφές βάρους για να εμφανιστεί η πορεία σου." />
  const values = [...points.map((point) => point.weight), ...(targetWeight === null ? [] : [targetWeight])]
  const min = Math.min(...values) - 0.5
  const max = Math.max(...values) + 0.5
  const x = (index: number) => 28 + (index / Math.max(points.length - 1, 1)) * 560
  const y = (value: number) => 24 + ((max - value) / Math.max(max - min, 0.1)) * 164
  const line = points.map((point, index) => `${index === 0 ? "M" : "L"}${x(index)} ${y(point.weight)}`).join(" ")
  const fill = `${line} L ${x(points.length - 1)} 202 L ${x(0)} 202 Z`
  const targetY = targetWeight === null ? null : y(targetWeight)
  return <div className="relative h-[250px] w-full overflow-hidden"><svg viewBox="0 0 620 226" className="h-full w-full overflow-visible" role="img" aria-label="Διάγραμμα βάρους"><defs><linearGradient id="progress-weight-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#B0F90C" stopOpacity=".3" /><stop offset="100%" stopColor="#B0F90C" stopOpacity="0" /></linearGradient></defs>{[62, 106, 150].map((lineY) => <line key={lineY} x1="28" x2="588" y1={lineY} y2={lineY} stroke="currentColor" className="text-border" strokeDasharray="3 5" />)}{targetY !== null && <><line x1="28" x2="588" y1={targetY} y2={targetY} stroke="#B0F90C" strokeDasharray="6 5" /><text x="584" y={targetY - 7} textAnchor="end" fontSize="10" fontWeight="800" fill="#6A6A6A">στόχος {targetWeight} kg</text></>}<path d={fill} fill="url(#progress-weight-fill)" /><path d={line} fill="none" stroke="currentColor" className="text-foreground" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />{points.map((point, index) => <circle key={`${point.submittedAt}-${index}`} cx={x(index)} cy={y(point.weight)} r={index === points.length - 1 ? 5 : 3} fill={index === points.length - 1 ? "#B0F90C" : "currentColor"} className={index === points.length - 1 ? "" : "text-foreground"} />)}</svg><div className="absolute bottom-0 left-7 right-8 flex justify-between text-[10px] font-bold text-muted-foreground"><span>{points[0].date}</span><span>{points.at(-1)?.date}</span></div></div>
}

function VolumeBars({ data }: { data: Array<{ month: string; volume: number }> }) {
  const highest = Math.max(...data.map((item) => item.volume), 1)
  return <div className="flex h-[180px] items-end gap-3 pt-5">{data.map((item) => <div key={item.month} className="flex h-full min-w-0 flex-1 flex-col justify-end gap-2"><div className="group relative flex-1 rounded-t-[8px] bg-muted"><span className="absolute inset-x-0 bottom-0 rounded-t-[8px] bg-foreground transition-[height]" style={{ height: `${Math.max(5, (item.volume / highest) * 100)}%` }} /><span className="pointer-events-none absolute -top-6 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-foreground px-2 py-1 text-[10px] font-bold text-background group-hover:block">{item.volume.toLocaleString("el-GR")} kg</span></div><span className="truncate text-center text-[10px] font-bold text-muted-foreground">{item.month}</span></div>)}</div>
}

function ConsistencyGrid({ workouts }: { workouts: Workout[] }) {
  const completed = new Set(workouts.map((workout) => new Date(workout.completed_at).toISOString().slice(0, 10)))
  const days = Array.from({ length: 84 }, (_, index) => {
    const date = new Date()
    date.setHours(12, 0, 0, 0)
    date.setDate(date.getDate() - 83 + index)
    return { id: date.toISOString().slice(0, 10), label: date.toLocaleDateString("el-GR", { day: "numeric", month: "short" }) }
  })
  return <div className="overflow-x-auto pb-1"><div className="grid min-w-[360px] grid-flow-col grid-rows-7 gap-1.5">{days.map((day) => <span key={day.id} title={day.label} className={`h-4 w-4 rounded-[4px] ${completed.has(day.id) ? "bg-accent" : "bg-muted"}`} />)}</div><div className="mt-3 flex items-center justify-between text-[10px] font-bold text-muted-foreground"><span>12 εβδομάδες</span><span className="flex items-center gap-1"><i className="h-3 w-3 rounded-[3px] bg-muted" /> λιγότερο <i className="ml-1 h-3 w-3 rounded-[3px] bg-accent" /> περισσότερο</span></div></div>
}

function ProgressPhotoComparison({ updates, photos, onSelect }: { updates: WeeklyUpdate[]; photos: string[]; onSelect: (photo: string) => void }) {
  const timeline = updates.flatMap((update) => (update.photos || []).map((url) => ({ url, date: update.submittedAt, weight: update.weight })))
  const available = timeline.length ? timeline : photos.map((url) => ({ url, date: "", weight: null }))
  const first = available[0]
  const last = available.at(-1) || first
  if (!first) return <EmptyChart text="Οι φωτογραφίες προόδου θα εμφανιστούν εδώ μετά το πρώτο σου update." />
  return <div className="grid grid-cols-2 gap-3">{[{ ...first, label: "Πριν" }, { ...last, label: "Τώρα" }].map((item, index) => <button key={`${item.url}-${index}`} type="button" onClick={() => onSelect(item.url)} className="group overflow-hidden rounded-[14px] border border-border bg-muted text-left"><div className="aspect-[4/5] overflow-hidden"><img src={resolveMediaUrl(item.url)} alt={`Φωτογραφία ${item.label.toLowerCase()}`} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" /></div><div className="flex items-center justify-between px-3 py-2"><span className="text-[11px] font-extrabold uppercase tracking-[.7px]">{item.label}</span><span className="text-[10px] text-muted-foreground">{item.weight ? `${item.weight} kg` : item.date ? formatDate(item.date) : ""}</span></div></button>)}</div>
}

function ProgressOverview({ weights, targetWeight, personalBests, monthlyVolume, workouts, updates, photos, onSelectPhoto }: { weights: WeightPoint[]; targetWeight: number | null; personalBests: Array<[string, number]>; monthlyVolume: Array<{ month: string; volume: number }>; workouts: Workout[]; updates: WeeklyUpdate[]; photos: string[]; onSelectPhoto: (photo: string) => void }) {
  return <div className="space-y-5"><div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(19rem,1fr)]"><Card className="rounded-[20px] border-border shadow-none"><CardHeader className="flex-row items-start justify-between gap-4 space-y-0 p-5 pb-0"><div><CardTitle className="text-[18px] font-extrabold">Η πορεία του βάρους σου</CardTitle><CardDescription className="mt-1 text-[12px]">Κάθε καταγραφή σε φέρνει πιο κοντά στον στόχο.</CardDescription></div><Badge className="rounded-full bg-foreground px-3 py-1 text-[10px] font-extrabold text-background">{weights.length} καταγραφές</Badge></CardHeader><CardContent className="p-5"><ProgressWeightChart points={weights} targetWeight={targetWeight} /></CardContent></Card><Card className="rounded-[20px] border-border shadow-none"><CardHeader className="p-5 pb-2"><CardTitle className="flex items-center gap-2 text-[18px] font-extrabold"><Trophy className="h-[18px] w-[18px] text-accent" />Προσωπικά ρεκόρ</CardTitle><CardDescription className="mt-1 text-[12px]">Τα καλύτερα κιλά σου ανά άσκηση.</CardDescription></CardHeader><CardContent className="space-y-2 p-5 pt-2">{personalBests.length ? personalBests.map(([exercise, weight], index) => <div key={exercise} className="flex items-center gap-3 rounded-[13px] border border-border px-3 py-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-foreground text-[11px] font-extrabold text-background">{index + 1}</span><span className="min-w-0 flex-1 truncate text-[13px] font-bold">{exercise}</span><span className="shrink-0 text-[13px] font-extrabold italic">{weight.toLocaleString("el-GR")} kg</span></div>) : <EmptyChart text="Τα ρεκόρ θα εμφανιστούν μετά την πρώτη ολοκληρωμένη προπόνηση." />}</CardContent></Card></div><div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(19rem,1fr)]"><Card className="rounded-[20px] border-border shadow-none"><CardHeader className="p-5 pb-0"><CardTitle className="text-[16px] font-extrabold">Όγκος προπόνησης</CardTitle><CardDescription className="mt-1 text-[12px]">Συνολικά κιλά ανά μήνα.</CardDescription></CardHeader><CardContent className="p-5"><VolumeBars data={monthlyVolume} /></CardContent></Card><Card className="rounded-[20px] border-border shadow-none"><CardHeader className="p-5 pb-3"><CardTitle className="text-[16px] font-extrabold">Συνέπεια 12 εβδομάδων</CardTitle><CardDescription className="mt-1 text-[12px]">Οι ολοκληρωμένες προπονήσεις σου.</CardDescription></CardHeader><CardContent className="p-5 pt-0"><ConsistencyGrid workouts={workouts} /></CardContent></Card><Card className="rounded-[20px] border-border shadow-none"><CardHeader className="p-5 pb-3"><CardTitle className="text-[16px] font-extrabold">Η αλλαγή σου</CardTitle><CardDescription className="mt-1 text-[12px]">Σύγκρινε τις φωτογραφίες προόδου.</CardDescription></CardHeader><CardContent className="p-5 pt-0"><ProgressPhotoComparison updates={updates} photos={photos} onSelect={onSelectPhoto} /></CardContent></Card></div></div>
}

function ProgressReferenceOverview({ weights, targetWeight, personalBests, monthlyVolume, workouts, updates, photos, onSelectPhoto }: { weights: WeightPoint[]; targetWeight: number | null; personalBests: Array<[string, number]>; monthlyVolume: Array<{ month: string; volume: number }>; workouts: Workout[]; updates: WeeklyUpdate[]; photos: string[]; onSelectPhoto: (photo: string) => void }) {
  const totalWorkouts = workouts.length
  const weeklyAverage = totalWorkouts ? (totalWorkouts / 12).toLocaleString("el-GR", { maximumFractionDigits: 1 }) : "0"
  return <div className="space-y-5">
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
      <Card className="rounded-[20px] border-border shadow-none"><CardHeader className="flex-row items-center justify-between gap-3 space-y-0 p-[22px]"><div><CardTitle className="text-[18px] font-extrabold">Βάρος</CardTitle><CardDescription className="mt-0.5 text-[12px]">από τα εβδομαδιαία updates</CardDescription></div><div className="flex gap-1">{["1Μ", "3Μ", "6Μ", "Όλα"].map((range) => <span key={range} className={`grid h-[30px] place-items-center rounded-[8px] px-2.5 text-[12px] font-extrabold ${range === "6Μ" ? "bg-foreground text-background" : "bg-muted text-muted-foreground"}`}>{range}</span>)}</div></CardHeader><CardContent className="p-[22px] pt-0"><ProgressWeightChart points={weights} targetWeight={targetWeight} /></CardContent></Card>
      <Card className="rounded-[20px] border-border shadow-none"><CardHeader className="flex-row items-baseline justify-between gap-3 space-y-0 p-[20px] px-[22px] pb-2"><CardTitle className="text-[18px] font-extrabold">Μετρήσεις σώματος</CardTitle><CardDescription className="text-[12px]">vs αρχή</CardDescription></CardHeader><CardContent className="p-[20px] px-[22px] pt-0"><div className="grid min-h-[220px] place-items-center rounded-[14px] border border-dashed border-border px-5 text-center text-[12px] leading-5 text-muted-foreground">Οι μετρήσεις σώματος θα εμφανιστούν εδώ μόλις καταγραφούν στο εβδομαδιαίο update.</div></CardContent></Card>
    </div>
    <div className="grid gap-5 xl:grid-cols-3">
      <Card className="rounded-[20px] border-border shadow-none"><CardHeader className="flex-row items-baseline justify-between space-y-0 p-[20px] px-[22px] pb-2"><CardTitle className="text-[18px] font-extrabold">Προσωπικά ρεκόρ</CardTitle><span className="text-[12px] font-extrabold">Όλα →</span></CardHeader><CardContent className="p-[20px] px-[22px] pt-0">{personalBests.length ? <div>{personalBests.slice(0, 4).map(([exercise, weight], index) => <div key={exercise} className="flex items-center gap-3 border-b border-border/70 py-[11px] last:border-0"><span className={`grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[10px] ${index === 0 ? "bg-accent text-accent-foreground" : "bg-muted"}`}><Trophy className="h-4 w-4" /></span><div className="min-w-0 flex-1"><p className="truncate text-[14px] font-bold">{exercise}</p><p className="text-[11px] text-muted-foreground">Καλύτερη επίδοση</p></div>{index === 0 && <Badge className="rounded-full bg-foreground px-1.5 py-0 text-[10px] font-extrabold text-accent">ΝΕΟ</Badge>}<span className="shrink-0 text-[15px] font-extrabold">{weight.toLocaleString("el-GR")} kg</span></div>)}</div> : <EmptyChart text="Τα προσωπικά ρεκόρ θα εμφανιστούν μετά την πρώτη ολοκληρωμένη προπόνηση." />}</CardContent></Card>
      <Card className="rounded-[20px] border-border shadow-none"><CardHeader className="flex-row items-baseline justify-between space-y-0 p-[20px] px-[22px] pb-0"><CardTitle className="text-[18px] font-extrabold">Μηνιαίος όγκος</CardTitle><CardDescription className="text-[12px]">κιλά × επαναλήψεις</CardDescription></CardHeader><CardContent className="p-[20px] px-[22px] pt-0"><VolumeBars data={monthlyVolume} /></CardContent></Card>
      <Card className="rounded-[20px] border-border shadow-none"><CardHeader className="flex-row items-baseline justify-between space-y-0 p-[20px] px-[22px] pb-3"><CardTitle className="text-[18px] font-extrabold">Συνέπεια προπονήσεων</CardTitle><CardDescription className="text-[12px]">12 εβδομάδες</CardDescription></CardHeader><CardContent className="p-[20px] px-[22px] pt-0"><ConsistencyGrid workouts={workouts} /><div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted-foreground"><span><b className="text-foreground">{totalWorkouts}</b> προπονήσεις</span><span><b className="text-foreground">{weeklyAverage}</b> / εβδομάδα</span></div></CardContent></Card>
    </div>
    <Card className="rounded-[20px] border-border shadow-none"><CardHeader className="flex-row items-center justify-between gap-3 space-y-0 p-[20px] px-[22px] pb-3"><div><CardTitle className="text-[18px] font-extrabold">Φωτογραφίες προόδου</CardTitle><CardDescription className="mt-1 text-[12px]">Σύγκρινε την αρχή με το τώρα.</CardDescription></div><span className="rounded-[8px] bg-foreground px-2.5 py-2 text-[12px] font-extrabold text-background">Μπροστά</span></CardHeader><CardContent className="p-[20px] px-[22px] pt-0"><ProgressPhotoComparison updates={updates} photos={photos} onSelect={onSelectPhoto} /><div className="mt-3 flex items-center justify-between gap-3 text-[12px] text-muted-foreground"><span>Σύγκρινε οποιαδήποτε δύο updates</span><span className="hidden rounded-full border-[1.5px] border-foreground px-3 py-2 font-extrabold text-foreground sm:inline-flex">Όλες οι φωτογραφίες</span></div></CardContent></Card>
  </div>
}

function ProgressReferenceSummary({ currentWeight, change, targetWeight, remaining, targetProgress, monthlyWorkouts, previousMonthWorkouts, updateConsistency, startedAt }: { currentWeight: number | null; change: number | null; targetWeight: number | null; remaining: number | null; targetProgress: number | null; monthlyWorkouts: number; previousMonthWorkouts: number; updateConsistency: number; startedAt?: string }) {
  const weightChange = change === null ? null : `${change > 0 ? "+" : ""}${change.toLocaleString("el-GR", { maximumFractionDigits: 1 })} kg από την αρχή`
  const trainingChange = monthlyWorkouts - previousMonthWorkouts
  return <><div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="text-[28px] font-extrabold tracking-[-.5px]">Η πρόοδός μου</h1><p className="mt-1 text-[14px] text-muted-foreground">Βάρος, μετρήσεις, προπονήσεις, ρεκόρ και φωτογραφίες σε ένα μέρος.</p></div>{startedAt && <span className="inline-flex h-10 w-fit items-center gap-2 rounded-full border border-border bg-card px-4 text-[13px] font-bold"><CalendarDays className="h-[15px] w-[15px]" />Από την αρχή · {formatDate(startedAt)}</span>}</div><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Card className="rounded-[20px] border-border shadow-none"><CardContent className="space-y-2 p-5"><div className="flex items-center justify-between"><span className="text-[11px] font-extrabold uppercase tracking-[1px] text-muted-foreground">Τρέχον βάρος</span><span className="grid h-[34px] w-[34px] place-items-center rounded-[10px] bg-muted"><Scale className="h-[17px] w-[17px]" /></span></div><p className="text-[32px] font-extrabold italic leading-none tracking-[-1px]">{currentWeight === null ? "—" : `${currentWeight} kg`}</p>{weightChange ? <span className="inline-flex h-6 items-center gap-1 rounded-full bg-[color:var(--sp-lime-soft)] px-2 text-[12px] font-extrabold"><TrendingDown className="h-3 w-3" />{weightChange}</span> : <p className="text-[12px] text-muted-foreground">Πρόσθεσε το πρώτο σου check-in</p>}</CardContent></Card><Card className="rounded-[20px] border-border shadow-none"><CardContent className="space-y-2 p-5"><div className="flex items-center justify-between"><span className="text-[11px] font-extrabold uppercase tracking-[1px] text-muted-foreground">Στόχος</span><span className="grid h-[34px] w-[34px] place-items-center rounded-[10px] bg-muted"><Target className="h-[17px] w-[17px]" /></span></div><p className="text-[32px] font-extrabold italic leading-none tracking-[-1px]">{targetWeight === null ? "—" : `${remaining === null ? "" : "−"}${remaining?.toLocaleString("el-GR", { maximumFractionDigits: 1 })} kg`}</p><p className="text-[12px] text-muted-foreground">{targetWeight === null ? "Δεν έχει οριστεί στόχος" : `ακόμα, για τα ${targetWeight} kg`}</p><div className="pt-1"><div className="h-2 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-accent" style={{ width: `${targetProgress ?? 0}%` }} /></div><div className="mt-1 flex justify-between text-[10px] text-muted-foreground"><span>Αρχή</span><b className="text-foreground">{Math.round(targetProgress ?? 0)}%</b><span>Στόχος</span></div></div></CardContent></Card><Card className="rounded-[20px] border-border shadow-none"><CardContent className="space-y-2 p-5"><div className="flex items-center justify-between"><span className="text-[11px] font-extrabold uppercase tracking-[1px] text-muted-foreground">Προπονήσεις μήνα</span><span className="grid h-[34px] w-[34px] place-items-center rounded-[10px] bg-muted"><Dumbbell className="h-[17px] w-[17px]" /></span></div><p className="text-[32px] font-extrabold italic leading-none tracking-[-1px]">{monthlyWorkouts}</p><span className="inline-flex h-6 items-center gap-1 rounded-full bg-[color:var(--sp-lime-soft)] px-2 text-[12px] font-extrabold"><TrendingUp className="h-3 w-3" />{trainingChange >= 0 ? "+" : ""}{trainingChange} από προηγούμενο μήνα</span></CardContent></Card><Card className="rounded-[20px] border-border shadow-none"><CardContent className="space-y-2 p-5"><div className="flex items-center justify-between"><span className="text-[11px] font-extrabold uppercase tracking-[1px] text-muted-foreground">Συνέπεια updates</span><span className="grid h-[34px] w-[34px] place-items-center rounded-[10px] bg-muted"><CalendarDays className="h-[17px] w-[17px]" /></span></div><p className="text-[32px] font-extrabold italic leading-none tracking-[-1px]">{updateConsistency}/4</p><p className="text-[12px] text-muted-foreground">τις τελευταίες 4 εβδομάδες</p><div className="flex gap-1">{Array.from({ length: 4 }, (_, index) => <span key={index} className={`h-2 flex-1 rounded-full ${index < updateConsistency ? "bg-accent" : "bg-muted"}`} />)}</div></CardContent></Card></div></>
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
  const startWeight = data?.startingWeight ?? weights[0]?.weight ?? null
  const currentWeight = weights.at(-1)?.weight ?? null
  const targetWeight = data?.targetWeight ?? null
  const weightChange = startWeight !== null && currentWeight !== null ? currentWeight - startWeight : null
  const remainingToTarget = currentWeight !== null && targetWeight !== null ? Math.abs(currentWeight - targetWeight) : null
  const targetProgress = startWeight !== null && currentWeight !== null && targetWeight !== null && startWeight !== targetWeight
    ? Math.min(100, Math.max(0, Math.abs((currentWeight - startWeight) / (targetWeight - startWeight)) * 100))
    : null
  const currentMonth = new Date().getMonth()
  const currentYear = new Date().getFullYear()
  const monthlyWorkouts = workouts.filter((workout) => {
    const date = new Date(workout.completed_at)
    return date.getMonth() === currentMonth && date.getFullYear() === currentYear
  }).length
  const previousMonthWorkouts = workouts.filter((workout) => {
    const date = new Date(workout.completed_at)
    const previous = new Date(currentYear, currentMonth - 1, 1)
    return date.getMonth() === previous.getMonth() && date.getFullYear() === previous.getFullYear()
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
    <main className="mx-auto max-w-[var(--container-7xl)] space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="hidden"><h1 className="text-2xl font-bold">Η πρόοδός μου</h1><p className="mt-1 text-sm text-muted-foreground">Οι μετρήσεις, τα check-ins και οι προπονήσεις σου σε ένα μέρος.</p></div>
      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      {loading ? <div className="space-y-6"><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-40 rounded-[20px]" />)}</div><Skeleton className="h-80 rounded-[20px]" /></div> : <>
        <ProgressReferenceSummary currentWeight={currentWeight} change={weightChange} targetWeight={targetWeight} remaining={remainingToTarget} targetProgress={targetProgress} monthlyWorkouts={monthlyWorkouts} previousMonthWorkouts={previousMonthWorkouts} updateConsistency={updateConsistency} startedAt={weights[0]?.submittedAt} />
        <div className="hidden grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Τρέχον βάρος" value={currentWeight !== null ? `${currentWeight.toLocaleString("el-GR")} kg` : "-"} detail={weightChange === null ? "Πρόσθεσε check-in με βάρος" : `${weightChange > 0 ? "+" : ""}${weightChange.toLocaleString("el-GR", { maximumFractionDigits: 1 })} kg από την αρχή`} icon={Scale} trend={weightChange === null ? undefined : weightChange <= 0 ? "down" : "up"} />
          <GoalStat targetWeight={targetWeight} remaining={remainingToTarget} progress={targetProgress} />
          <StatCard label="Προπονήσεις μήνα" value={String(monthlyWorkouts)} detail={previousMonthWorkouts ? `${monthlyWorkouts >= previousMonthWorkouts ? "+" : ""}${monthlyWorkouts - previousMonthWorkouts} από τον προηγούμενο μήνα` : "Η πρώτη σου προπόνηση αυτόν τον μήνα"} icon={Dumbbell} />
          <StatCard label="Συνέπεια updates" value={`${updateConsistency}/4`} detail="Check-ins τις τελευταίες 4 εβδομάδες" icon={CalendarDays} />
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="h-auto w-full justify-start overflow-x-auto rounded-[14px] border border-border bg-card p-1 [&>button]:h-[38px] [&>button]:shrink-0 [&>button]:rounded-[10px] [&>button]:px-[18px] [&>button]:text-[13px] [&>button]:font-bold [&>button[data-state=active]]:bg-accent [&>button[data-state=active]]:text-accent-foreground [&>button[data-state=active]]:shadow-none"><TabsTrigger value="overview">Επισκόπηση</TabsTrigger><TabsTrigger value="weight">Βάρος & μετρήσεις</TabsTrigger><TabsTrigger value="workouts">Προπονήσεις</TabsTrigger><TabsTrigger value="records">Ρεκόρ</TabsTrigger><TabsTrigger value="checkins">Check-ins</TabsTrigger><TabsTrigger value="photos">Φωτογραφίες</TabsTrigger></TabsList>
          <TabsContent value="overview" className="space-y-6">
            <ProgressReferenceOverview weights={weights} targetWeight={targetWeight} personalBests={personalBests} monthlyVolume={monthlyVolume} workouts={workouts} updates={recentUpdates} photos={data?.photos || []} onSelectPhoto={setPhoto} />
            <div className="hidden">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(18rem,0.85fr)]">
              <Card><CardHeader><CardTitle className="text-lg">Βάρος</CardTitle></CardHeader><CardContent>{weights.length > 1 ? <AreaChart className="h-72" data={weights} index="date" categories={["weight"]} colors={["blue"]} valueFormatter={(value) => `${value} kg`} /> : <EmptyChart text="Χρειάζονται τουλάχιστον δύο check-ins με βάρος για το γράφημα." />}</CardContent></Card>
              <Card><CardHeader><CardTitle className="text-lg">Προσωπικά ρεκόρ</CardTitle></CardHeader><CardContent className="space-y-3">{personalBests.length ? personalBests.map(([exercise, weight]) => <div key={exercise} className="flex items-center justify-between gap-3 rounded-lg bg-muted/50 px-3 py-3"><span className="truncate text-sm font-medium">{exercise}</span><Badge variant="outline" className="shrink-0">{weight.toLocaleString("el-GR")} kg</Badge></div>) : <p className="py-8 text-center text-sm text-muted-foreground">Τα προσωπικά ρεκόρ θα εμφανιστούν μετά την πρώτη σου προπόνηση.</p>}</CardContent></Card>
            </div>
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(18rem,0.85fr)]">
              <Card><CardHeader><CardTitle className="text-lg">Μηνιαίος όγκος προπόνησης</CardTitle></CardHeader><CardContent>{workouts.length ? <BarChart className="h-64" data={monthlyVolume} index="month" categories={["volume"]} colors={["emerald"]} valueFormatter={(value) => `${value.toLocaleString("el-GR")} kg`} /> : <EmptyChart text="Δεν υπάρχουν ολοκληρωμένες προπονήσεις ακόμα." />}</CardContent></Card>
              <PhotosCard photos={data?.photos || []} onSelect={setPhoto} />
            </div>
            </div>
          </TabsContent>
          <TabsContent value="weight" className="space-y-6"><Card><CardHeader><CardTitle className="text-lg">Βάρος & στόχος</CardTitle><CardDescription>{targetWeight !== null ? `Στόχος: ${targetWeight} kg` : "Δεν έχει οριστεί βάρος στόχου."}</CardDescription></CardHeader><CardContent>{weights.length > 1 ? <AreaChart className="h-80" data={weights} index="date" categories={["weight"]} colors={["gray"]} valueFormatter={(value) => `${value} kg`} /> : <EmptyChart text="Χρειάζονται τουλάχιστον δύο check-ins με βάρος για το γράφημα." />}{targetProgress !== null && <div className="mt-5"><div className="flex justify-between text-xs font-semibold"><span>Πρόοδος προς τον στόχο</span><span>{Math.round(targetProgress)}%</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-accent" style={{ width: `${targetProgress}%` }} /></div></div>}</CardContent></Card></TabsContent>
          <TabsContent value="workouts"><WorkoutList workouts={workouts} /></TabsContent>
          <TabsContent value="records"><Card><CardHeader><CardTitle className="text-lg">Προσωπικά ρεκόρ</CardTitle></CardHeader><CardContent className="space-y-3">{personalBests.length ? personalBests.map(([exercise, weight], index) => <div key={exercise} className="flex items-center justify-between gap-3 rounded-[14px] bg-muted/60 px-4 py-3"><span className="flex min-w-0 items-center gap-3"><span className="grid h-8 w-8 place-items-center rounded-full bg-[var(--sp-emphasis)] text-xs font-extrabold text-accent">{index + 1}</span><span className="truncate font-bold">{exercise}</span></span><Badge className="bg-[var(--sp-emphasis)] text-accent">{weight.toLocaleString("el-GR")} kg</Badge></div>) : <EmptyChart text="Τα προσωπικά ρεκόρ θα εμφανιστούν μετά την πρώτη σου προπόνηση." />}</CardContent></Card></TabsContent>
          <TabsContent value="checkins"><CheckinList updates={recentUpdates} onSelectPhoto={setPhoto} /></TabsContent>
          <TabsContent value="photos"><PhotosCard photos={data?.photos || []} onSelect={setPhoto} /></TabsContent>
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
