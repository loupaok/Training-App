"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Clock3, Dumbbell, ImageOff, Play, Plus, Volume2, VolumeX, X } from "lucide-react"
import { ProtectedRoute } from "@/components/auth/protected-route"
import { ClientShell } from "@/components/shell/client-shell"
import { RestTimer } from "@/components/client/rest-timer"
import { SetRow } from "@/components/client/set-row"
import { WorkoutSummary } from "@/components/client/workout-summary"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { useAuth } from "@/lib/auth/auth-context"
import { api } from "@/lib/api/client"
import { resolveMediaUrl } from "@/lib/media"

type Exercise = { id: number; exercise_id?: number | null; exercise_name?: string; name?: string; sets?: string; reps?: string; rest_seconds?: string | number | null; notes?: string | null; image_url?: string | null; muscle_group?: string | null; equipment?: string | null }
type TrainingDay = { id: number; day_of_week: number; title?: string | null; name?: string; exercises: Exercise[] }
type TrainingPlan = { id: number; title: string; description?: string | null; days: TrainingDay[] } | null
type WorkoutLog = { id: number; training_plan_id: number; day_number: number; completed_at: string; duration_seconds: number }
type LastSet = { exerciseName: string; setNumber: number; weightKg: number; repsCompleted: number }
type SetState = { weight: number; reps: number; completed: boolean }
type Dashboard = { client?: { subscriptionStatus?: string | null }; unreadNotifications?: number }

const dateFormat = new Intl.DateTimeFormat("el-GR", { day: "numeric", month: "short" })
const baseSetCount = (exercise: Exercise) => Math.max(1, Number.parseInt(String(exercise.sets || "1"), 10) || 1)
const plannedReps = (exercise: Exercise) => Number.parseInt(String(exercise.reps || "0"), 10) || 0
const restSeconds = (exercise: Exercise) => Math.max(0, Number.parseInt(String(exercise.rest_seconds || "0"), 10) || 0)
const exerciseKey = (exercise: Exercise) => String(exercise.exercise_id || exercise.id)
const setKey = (exercise: Exercise, setNumber: number) => `${exerciseKey(exercise)}-${setNumber}`
const workoutTime = (seconds: number) => `${String(Math.floor(seconds / 3600)).padStart(2, "0")}:${String(Math.floor((seconds % 3600) / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`

function playSound(kind: "tick" | "bell" | "fanfare", enabled: boolean) {
  if (!enabled || typeof window === "undefined") return
  const Context = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Context) return
  const context = new Context(); const oscillator = context.createOscillator(); const gain = context.createGain()
  oscillator.type = kind === "bell" ? "sine" : "triangle"; oscillator.frequency.value = kind === "tick" ? 800 : kind === "bell" ? 440 : 660
  gain.gain.setValueAtTime(0.08, context.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + (kind === "tick" ? 0.12 : 0.8))
  oscillator.connect(gain); gain.connect(context.destination); oscillator.start(); oscillator.stop(context.currentTime + (kind === "tick" ? 0.12 : 0.8))
}

function ClientProgramContent() {
  const { user, logout } = useAuth()
  const [plan, setPlan] = useState<TrainingPlan>(null)
  const [history, setHistory] = useState<WorkoutLog[]>([])
  const [paymentApproved, setPaymentApproved] = useState(false)
  const [unreadNotifications, setUnreadNotifications] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [phase, setPhase] = useState<"overview" | "workout" | "complete">("overview")
  const [workoutLogId, setWorkoutLogId] = useState<number | null>(null)
  const [dayIndex, setDayIndex] = useState(0)
  const [sets, setSets] = useState<Record<string, SetState>>({})
  const [previousSets, setPreviousSets] = useState<Record<string, { weight: number; reps: number }>>({})
  const [extraSets, setExtraSets] = useState<Record<string, number>>({})
  const [focusSet, setFocusSet] = useState<string | null>(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [restLeft, setRestLeft] = useState(0)
  const [restTotal, setRestTotal] = useState(0)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [exitOpen, setExitOpen] = useState(false)
  const [summaryNotes, setSummaryNotes] = useState("")
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError("")
    try {
      const [training, workoutHistory, dashboard] = await Promise.all([api.get<TrainingPlan>("/client/training-plan"), api.get<WorkoutLog[]>("/client/workout/history"), api.get<Dashboard>("/client/dashboard")])
      setPlan(training); setHistory(workoutHistory); setPaymentApproved(dashboard.client?.subscriptionStatus === "active"); setUnreadNotifications(dashboard.unreadNotifications || 0)
    } catch (caughtError) { setError(caughtError instanceof Error ? caughtError.message : "Δεν φορτώθηκε το πρόγραμμα προπόνησης.") }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void load(); setSoundEnabled(window.localStorage.getItem("workout-sound-enabled") !== "false") }, [load])
  useEffect(() => { if (phase !== "workout") return; const timer = window.setInterval(() => setElapsedSeconds((value) => value + 1), 1000); return () => window.clearInterval(timer) }, [phase])

  const days = plan?.days || []
  const day = days[dayIndex]
  const visibleSetCount = useCallback((exercise: Exercise) => baseSetCount(exercise) + (extraSets[exerciseKey(exercise)] || 0), [extraSets])
  const allSets = useMemo(() => day?.exercises.flatMap((exercise) => Array.from({ length: visibleSetCount(exercise) }, (_, index) => ({ exercise, setNumber: index + 1 }))) || [], [day, visibleSetCount])
  const completedSets = allSets.filter(({ exercise, setNumber }) => sets[setKey(exercise, setNumber)]?.completed).length
  const totalVolume = allSets.reduce((sum, { exercise, setNumber }) => { const state = sets[setKey(exercise, setNumber)]; return sum + (state?.completed ? state.weight * state.reps : 0) }, 0)

  const startWorkout = async (index: number) => {
    if (!plan || !days[index]) return
    try {
      const selectedDay = days[index]
      const result = await api.post<{ workoutLogId: number }>("/client/workout/start", { trainingPlanId: plan.id, dayNumber: index + 1, dayName: selectedDay.title || selectedDay.name || `Ημέρα ${index + 1}` })
      const last = await api.get<{ sets: LastSet[] }>(`/client/workout/last/${plan.id}/${index + 1}`)
      const initial: Record<string, SetState> = {}; const previous: Record<string, { weight: number; reps: number }> = {}
      selectedDay.exercises.forEach((exercise) => Array.from({ length: baseSetCount(exercise) }, (_, index) => index + 1).forEach((setNumber) => {
        const prior = last.sets.find((entry) => entry.exerciseName === (exercise.exercise_name || exercise.name) && entry.setNumber === setNumber)
        const value = { weight: prior?.weightKg || 0, reps: prior?.repsCompleted || plannedReps(exercise) }
        initial[setKey(exercise, setNumber)] = { ...value, completed: false }
        if (prior) previous[setKey(exercise, setNumber)] = value
      }))
      setSets(initial); setPreviousSets(previous); setExtraSets({}); setFocusSet(null); setWorkoutLogId(result.workoutLogId); setDayIndex(index); setElapsedSeconds(0); setRestLeft(0); setRestTotal(0); setPhase("workout")
    } catch (caughtError) { setError(caughtError instanceof Error ? caughtError.message : "Δεν ξεκίνησε η προπόνηση.") }
  }

  const addSet = (exercise: Exercise) => {
    const number = visibleSetCount(exercise) + 1
    const previousState = sets[setKey(exercise, number - 1)] || { weight: 0, reps: plannedReps(exercise), completed: false }
    const key = setKey(exercise, number)
    setExtraSets((current) => ({ ...current, [exerciseKey(exercise)]: (current[exerciseKey(exercise)] || 0) + 1 }))
    setSets((current) => ({ ...current, [key]: { weight: previousState.weight, reps: previousState.reps, completed: false } }))
    setFocusSet(key)
  }

  const toggleSet = async (exercise: Exercise, setNumber: number, completed: boolean) => {
    const key = setKey(exercise, setNumber); const state = sets[key] || { weight: 0, reps: plannedReps(exercise), completed: false }
    if (!completed) { setSets((current) => ({ ...current, [key]: { ...state, completed: false } })); return }
    if (!workoutLogId) return
    try {
      await api.post("/client/workout/log-set", { workoutLogId, exerciseName: exercise.exercise_name || exercise.name, exerciseId: exercise.exercise_id || null, setNumber, targetReps: plannedReps(exercise), repsCompleted: state.reps, weightKg: state.weight })
      setSets((current) => ({ ...current, [key]: { ...state, completed: true } })); playSound("tick", soundEnabled)
      if (restSeconds(exercise) > 0) { setRestTotal(restSeconds(exercise)); setRestLeft(restSeconds(exercise)) }
    } catch (caughtError) { setError(caughtError instanceof Error ? caughtError.message : "Δεν αποθηκεύτηκε το σετ.") }
  }

  const cancelWorkout = async () => {
    if (workoutLogId) { try { await api.post("/client/workout/cancel", { workoutLogId }) } catch { /* The local workout still closes after a transient failure. */ } }
    setWorkoutLogId(null); setRestLeft(0); setExitOpen(false); setPhase("overview")
  }

  const saveWorkout = async () => {
    if (!workoutLogId) return
    setSaving(true)
    try {
      await api.post("/client/workout/complete", { workoutLogId, durationSeconds: elapsedSeconds, totalSetsCompleted: completedSets, totalVolumeKg: totalVolume, notes: summaryNotes })
      playSound("fanfare", soundEnabled); setWorkoutLogId(null); setSummaryNotes(""); setPhase("overview"); await load()
    } catch (caughtError) { setError(caughtError instanceof Error ? caughtError.message : "Δεν ολοκληρώθηκε η προπόνηση.") }
    finally { setSaving(false) }
  }

  const toggleSound = () => setSoundEnabled((enabled) => { const next = !enabled; window.localStorage.setItem("workout-sound-enabled", String(next)); return next })

  if (loading) return <ClientShell title="Η Προπόνησή μου" user={user} logout={logout} paymentApproved={false} active="training"><p className="text-muted-foreground">Φόρτωση...</p></ClientShell>

  return <ClientShell title="Η Προπόνησή μου" user={user} logout={logout} paymentApproved={paymentApproved} unreadNotifications={unreadNotifications} active="training">
    <div className="mx-auto max-w-5xl space-y-6">
      {error && <Alert variant="destructive"><AlertTitle>Σφάλμα</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
      {!plan || !days.length ? <Card><CardContent className="py-16 text-center text-muted-foreground">Δεν έχει ανατεθεί πρόγραμμα προπόνησης ακόμα.</CardContent></Card> : <>
        <section><div className="flex flex-wrap items-center gap-3"><h1 className="text-2xl font-bold">{plan.title}</h1><Badge>Ενεργό</Badge></div>{plan.description && <p className="mt-2 text-muted-foreground">{plan.description}</p>}</section>
        <div className="grid gap-4 md:grid-cols-2">{days.map((item, index) => { const last = history.find((log) => log.training_plan_id === plan.id && log.day_number === index + 1); const estimate = item.exercises.reduce((sum, exercise) => sum + (baseSetCount(exercise) * restSeconds(exercise)) + 120, 0); return <Card key={item.id}><CardHeader><CardTitle>Ημέρα {index + 1} - {item.title || item.name || "Προπόνηση"}</CardTitle><CardDescription>{item.exercises.length} ασκήσεις · ~{Math.max(1, Math.round(estimate / 60))} λεπτά</CardDescription></CardHeader><CardContent className="space-y-4"><p className="text-sm text-muted-foreground">{item.exercises.slice(0, 3).map((exercise) => exercise.exercise_name || exercise.name).join(", ")}{item.exercises.length > 3 ? "..." : ""}</p>{last && <p className="text-xs text-muted-foreground">Τελευταία φορά: {dateFormat.format(new Date(last.completed_at))} · {Math.round(last.duration_seconds / 60)} λεπτά</p>}<Button className="w-full" onClick={() => void startWorkout(index)}><Play className="mr-2 h-4 w-4" />Έναρξη Προπόνησης</Button></CardContent></Card> })}</div>
      </>}
    </div>
    {phase === "workout" && day && <div className="fixed inset-0 z-50 overflow-y-auto bg-background">
      <header className="sticky top-0 z-20 border-b bg-background/95 px-4 py-3 backdrop-blur"><div className="mx-auto flex max-w-4xl items-center justify-between gap-3"><Button size="icon" variant="ghost" onClick={() => setExitOpen(true)} aria-label="Έξοδος"><X className="h-5 w-5" /></Button><p className="min-w-0 truncate text-center font-medium">Ημέρα {dayIndex + 1} - {day.title || day.name}</p><div className="flex items-center gap-2"><span className="flex items-center gap-1 text-sm tabular-nums text-muted-foreground"><Clock3 className="h-4 w-4" />{workoutTime(elapsedSeconds)}</span><Button size="icon" variant="ghost" onClick={toggleSound} aria-label="Ρύθμιση ήχου">{soundEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}</Button></div></div></header>
      <main className="mx-auto max-w-4xl space-y-0 p-4 pb-28 sm:p-8 sm:pb-32">{day.exercises.map((exercise, exerciseIndex) => <div key={exercise.id}><Card className="rounded-xl border-border bg-card shadow-sm"><CardContent className="space-y-4 p-4"><div className="flex items-center gap-3">{exercise.image_url ? <img src={resolveMediaUrl(exercise.image_url)} alt="" className="h-12 w-12 rounded-full object-cover" /> : <div className="grid h-12 w-12 place-items-center rounded-full bg-muted"><ImageOff className="h-5 w-5 text-muted-foreground" /></div>}<div className="min-w-0"><h2 className="truncate text-base font-semibold">{exercise.exercise_name || exercise.name}</h2><p className="text-xs text-muted-foreground">{exercise.muscle_group || "-"}{exercise.equipment ? ` · ${exercise.equipment}` : ""}</p><p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><Clock3 className="h-3.5 w-3.5" />Rest: {restSeconds(exercise)}&quot;</p></div></div><div className="overflow-hidden rounded-lg border border-border"><table className="w-full text-sm"><thead className="bg-muted/50 text-left text-xs text-muted-foreground"><tr><th className="p-3">ΣΕΤ</th><th className="p-3">ΠΡΟΗΓ.</th><th className="p-3">KG</th><th className="p-3">ΕΠΑΝ.</th><th className="p-3 text-right">ΟΛΟΚΛΗΡΩΣΗ</th></tr></thead><tbody>{Array.from({ length: visibleSetCount(exercise) }, (_, index) => { const setNumber = index + 1; const key = setKey(exercise, setNumber); const state = sets[key] || { weight: 0, reps: plannedReps(exercise), completed: false }; return <SetRow key={key} setNumber={setNumber} previous={previousSets[key]} weightKg={state.weight} repsCompleted={state.reps} isCompleted={state.completed} autoFocusKg={focusSet === key} onWeightChange={(weight) => setSets((current) => ({ ...current, [key]: { ...state, weight } }))} onRepsChange={(reps) => setSets((current) => ({ ...current, [key]: { ...state, reps } }))} onComplete={(completed) => void toggleSet(exercise, setNumber, completed)} /> })}</tbody></table><Button variant="ghost" className="h-10 w-full justify-center text-sm text-muted-foreground" onClick={() => addSet(exercise)}><Plus className="mr-1 h-4 w-4" />Προσθήκη Σετ</Button></div>{exercise.notes && <p className="rounded-md bg-muted/30 p-2 text-xs italic text-muted-foreground">{exercise.notes}</p>}</CardContent></Card>{exerciseIndex < day.exercises.length - 1 && <Separator className="my-6" />}</div>)}</main>
      <footer className="sticky bottom-0 border-t bg-background/95 p-4 backdrop-blur"><div className="mx-auto max-w-4xl"><Button className="w-full" size="lg" disabled={completedSets === 0} onClick={() => setPhase("complete")}><Dumbbell className="mr-2 h-5 w-5" />Ολοκλήρωση Προπόνησης</Button></div></footer>
      {restLeft > 0 && <RestTimer seconds={restLeft} totalSeconds={restTotal} onChange={setRestLeft} onComplete={() => { setRestLeft(0); playSound("bell", soundEnabled) }} />}
    </div>}
    {phase === "complete" && <WorkoutSummary durationSeconds={elapsedSeconds} completedSets={completedSets} totalSets={allSets.length} volumeKg={totalVolume} exerciseCount={day?.exercises.length || 0} notes={summaryNotes} onNotesChange={setSummaryNotes} onSave={() => void saveWorkout()} saving={saving} />}
    {exitOpen && <AlertDialog open onOpenChange={setExitOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Έξοδος από την προπόνηση;</AlertDialogTitle><AlertDialogDescription>Η πρόοδός σου θα χαθεί.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Μείνε</AlertDialogCancel><AlertDialogAction onClick={() => void cancelWorkout()}>Έξοδος</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>}
  </ClientShell>
}

export default function ClientProgramPage() { return <ProtectedRoute allow="client-active"><ClientProgramContent /></ProtectedRoute> }
