"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { ChevronDown, Clock3, Dumbbell, ExternalLink, ImageOff, Info, Play, Plus, Volume2, VolumeX, X } from "lucide-react"
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { useAuth } from "@/lib/auth/auth-context"
import { api } from "@/lib/api/client"
import { resolveMediaUrl } from "@/lib/media"

type Exercise = { id: number; exercise_id?: number | null; exercise_name?: string; name?: string; sets?: string; reps?: string; rest_seconds?: string | number | null; notes?: string | null; image_url?: string | null; muscle_group?: string | null; equipment?: string | null; video_url?: string | null; instructions?: string | null }
type TrainingDay = { id: number; day_of_week: number; title?: string | null; name?: string; exercises: Exercise[] }
type TrainingPlan = { id: number; title: string; description?: string | null; days: TrainingDay[] } | null
type WorkoutLog = { id: number; training_plan_id: number; day_number: number; completed_at: string; duration_seconds: number }
type LastSet = { exerciseName: string; setNumber: number; weightKg: number; repsCompleted: number }
type HistorySession = { completedAt: string; sets: Array<{ setNumber: number; weightKg: number; repsCompleted: number }> }
type SetState = { weight: number; reps: number; completed: boolean }
type Dashboard = { client?: { subscriptionStatus?: string | null }; unreadNotifications?: number }

const dateFormat = new Intl.DateTimeFormat("el-GR", { day: "numeric", month: "short", year: "numeric" })
const baseSetCount = (exercise: Exercise) => Math.max(1, Number.parseInt(String(exercise.sets || "1"), 10) || 1)
const plannedReps = (exercise: Exercise) => Number.parseInt(String(exercise.reps || "0"), 10) || 0
const restSeconds = (exercise: Exercise) => Math.max(0, Number.parseInt(String(exercise.rest_seconds || "0"), 10) || 0)
const exerciseKey = (exercise: Exercise) => String(exercise.exercise_id || exercise.id)
const setKey = (exercise: Exercise, setNumber: number) => `${exerciseKey(exercise)}-${setNumber}`
const workoutTime = (seconds: number) => `${String(Math.floor(seconds / 3600)).padStart(2, "0")}:${String(Math.floor((seconds % 3600) / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`
const displayName = (exercise: Exercise) => exercise.exercise_name || exercise.name || "Άσκηση"

function playSound(kind: "tick" | "bell" | "fanfare", enabled: boolean) {
  if (!enabled || typeof window === "undefined") return
  const Context = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Context) return
  const context = new Context(); const oscillator = context.createOscillator(); const gain = context.createGain()
  oscillator.type = kind === "bell" ? "sine" : "triangle"; oscillator.frequency.value = kind === "tick" ? 800 : kind === "bell" ? 440 : 660
  gain.gain.setValueAtTime(0.08, context.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + (kind === "tick" ? 0.12 : 0.8))
  oscillator.connect(gain); gain.connect(context.destination); oscillator.start(); oscillator.stop(context.currentTime + (kind === "tick" ? 0.12 : 0.8))
}

function ExerciseHistory({ exerciseName }: { exerciseName: string }) {
  const [open, setOpen] = useState(false)
  const [sessions, setSessions] = useState<HistorySession[] | null>(null)
  const [loading, setLoading] = useState(false)
  const load = async (nextOpen: boolean) => {
    setOpen(nextOpen)
    if (!nextOpen || sessions !== null) return
    setLoading(true)
    try { setSessions(await api.get<HistorySession[]>(`/client/workout/exercise-history?exerciseName=${encodeURIComponent(exerciseName)}&limit=5`)) }
    catch { setSessions([]) }
    finally { setLoading(false) }
  }
  return <Collapsible open={open} onOpenChange={load}><CollapsibleTrigger className="flex w-full items-center justify-between rounded-md py-1 text-sm font-medium"><span className="flex items-center gap-2"><Info className="h-4 w-4 text-primary" />Ιστορικό</span><ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} /></CollapsibleTrigger><CollapsibleContent><ScrollArea className="mt-2 max-h-56 rounded-md bg-muted/30 p-3">{loading ? <p className="text-xs text-muted-foreground">Φόρτωση...</p> : sessions?.length ? <div className="space-y-4">{sessions.map((session) => <div key={session.completedAt}><p className="text-xs font-medium">{dateFormat.format(new Date(session.completedAt))}</p>{session.sets.map((set) => <p key={set.setNumber} className="mt-1 text-xs text-muted-foreground">Σετ {set.setNumber}: {set.weightKg}kg × {set.repsCompleted}</p>)}</div>)}</div> : <p className="text-xs text-muted-foreground">Δεν υπάρχει ιστορικό για αυτή την άσκηση.</p>}</ScrollArea></CollapsibleContent></Collapsible>
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
  const [restExerciseName, setRestExerciseName] = useState<string | null>(null)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [exitOpen, setExitOpen] = useState(false)
  const [summaryNotes, setSummaryNotes] = useState("")
  const [saving, setSaving] = useState(false)
  const [infoExercise, setInfoExercise] = useState<Exercise | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError("")
    try { const [training, workoutHistory, dashboard] = await Promise.all([api.get<TrainingPlan>("/client/training-plan"), api.get<WorkoutLog[]>("/client/workout/history"), api.get<Dashboard>("/client/dashboard")]); setPlan(training); setHistory(workoutHistory); setPaymentApproved(dashboard.client?.subscriptionStatus === "active"); setUnreadNotifications(dashboard.unreadNotifications || 0) }
    catch (caughtError) { setError(caughtError instanceof Error ? caughtError.message : "Δεν φορτώθηκε το πρόγραμμα προπόνησης.") }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { void load(); setSoundEnabled(window.localStorage.getItem("workout-sound-enabled") !== "false") }, [load])
  useEffect(() => { if (phase !== "workout") return; const timer = window.setInterval(() => setElapsedSeconds((value) => value + 1), 1000); return () => window.clearInterval(timer) }, [phase])

  const days = plan?.days || []; const day = days[dayIndex]
  const visibleSetCount = useCallback((exercise: Exercise) => baseSetCount(exercise) + (extraSets[exerciseKey(exercise)] || 0), [extraSets])
  const allSets = useMemo(() => day?.exercises.flatMap((exercise) => Array.from({ length: visibleSetCount(exercise) }, (_, index) => ({ exercise, setNumber: index + 1 }))) || [], [day, visibleSetCount])
  const completedSets = allSets.filter(({ exercise, setNumber }) => sets[setKey(exercise, setNumber)]?.completed).length
  const totalVolume = allSets.reduce((sum, { exercise, setNumber }) => { const state = sets[setKey(exercise, setNumber)]; return sum + (state?.completed ? state.weight * state.reps : 0) }, 0)
  const startRest = (exercise: Exercise) => { const seconds = restSeconds(exercise); if (seconds) { setRestTotal(seconds); setRestLeft(seconds); setRestExerciseName(displayName(exercise)) } }

  const startWorkout = async (index: number) => {
    if (!plan || !days[index]) return
    try { const selectedDay = days[index]; const result = await api.post<{ workoutLogId: number }>("/client/workout/start", { trainingPlanId: plan.id, dayNumber: index + 1, dayName: selectedDay.title || selectedDay.name || `Ημέρα ${index + 1}` }); const last = await api.get<{ sets: LastSet[] }>(`/client/workout/last/${plan.id}/${index + 1}`); const initial: Record<string, SetState> = {}; const previous: Record<string, { weight: number; reps: number }> = {}; selectedDay.exercises.forEach((exercise) => Array.from({ length: baseSetCount(exercise) }, (_, setIndex) => setIndex + 1).forEach((setNumber) => { const prior = last.sets.find((entry) => entry.exerciseName === displayName(exercise) && entry.setNumber === setNumber); const value = { weight: prior?.weightKg || 0, reps: prior?.repsCompleted || plannedReps(exercise) }; initial[setKey(exercise, setNumber)] = { ...value, completed: false }; if (prior) previous[setKey(exercise, setNumber)] = value })); setSets(initial); setPreviousSets(previous); setExtraSets({}); setFocusSet(null); setWorkoutLogId(result.workoutLogId); setDayIndex(index); setElapsedSeconds(0); setRestLeft(0); setRestTotal(0); setRestExerciseName(null); setPhase("workout") }
    catch (caughtError) { setError(caughtError instanceof Error ? caughtError.message : "Δεν ξεκίνησε η προπόνηση.") }
  }
  const addSet = (exercise: Exercise) => { const setNumber = visibleSetCount(exercise) + 1; const prior = sets[setKey(exercise, setNumber - 1)] || { weight: 0, reps: plannedReps(exercise), completed: false }; const key = setKey(exercise, setNumber); setExtraSets((current) => ({ ...current, [exerciseKey(exercise)]: (current[exerciseKey(exercise)] || 0) + 1 })); setSets((current) => ({ ...current, [key]: { weight: prior.weight, reps: prior.reps, completed: false } })); setFocusSet(key) }
  const toggleSet = async (exercise: Exercise, setNumber: number, completed: boolean) => { const key = setKey(exercise, setNumber); const state = sets[key] || { weight: 0, reps: plannedReps(exercise), completed: false }; if (!completed) { setSets((current) => ({ ...current, [key]: { ...state, completed: false } })); return } if (!workoutLogId) return; try { await api.post("/client/workout/log-set", { workoutLogId, exerciseName: displayName(exercise), exerciseId: exercise.exercise_id || null, setNumber, targetReps: plannedReps(exercise), repsCompleted: state.reps, weightKg: state.weight }); setSets((current) => ({ ...current, [key]: { ...state, completed: true } })); playSound("tick", soundEnabled); startRest(exercise) } catch (caughtError) { setError(caughtError instanceof Error ? caughtError.message : "Δεν αποθηκεύτηκε το σετ.") } }
  const cancelWorkout = async () => { if (workoutLogId) { try { await api.post("/client/workout/cancel", { workoutLogId }) } catch { /* The local workout still closes after a transient failure. */ } } setWorkoutLogId(null); setRestLeft(0); setRestExerciseName(null); setExitOpen(false); setPhase("overview") }
  const saveWorkout = async () => { if (!workoutLogId) return; setSaving(true); try { await api.post("/client/workout/complete", { workoutLogId, durationSeconds: elapsedSeconds, totalSetsCompleted: completedSets, totalVolumeKg: totalVolume, notes: summaryNotes }); playSound("fanfare", soundEnabled); setWorkoutLogId(null); setSummaryNotes(""); setPhase("overview"); await load() } catch (caughtError) { setError(caughtError instanceof Error ? caughtError.message : "Δεν ολοκληρώθηκε η προπόνηση.") } finally { setSaving(false) } }
  const toggleSound = () => setSoundEnabled((enabled) => { const next = !enabled; window.localStorage.setItem("workout-sound-enabled", String(next)); return next })

  if (loading) return <ClientShell title="Η Προπόνησή μου" user={user} logout={logout} paymentApproved={false} active="training"><p className="text-muted-foreground">Φόρτωση...</p></ClientShell>

  return <ClientShell title="Η Προπόνησή μου" user={user} logout={logout} paymentApproved={paymentApproved} unreadNotifications={unreadNotifications} active="training"><div className="mx-auto max-w-5xl space-y-6">{error && <Alert variant="destructive"><AlertTitle>Σφάλμα</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}{!plan || !days.length ? <Card><CardContent className="py-16 text-center text-muted-foreground">Δεν έχει ανατεθεί πρόγραμμα προπόνησης ακόμα.</CardContent></Card> : <><section><div className="flex flex-wrap items-center gap-3"><h1 className="text-2xl font-bold">{plan.title}</h1><Badge>Ενεργό</Badge></div>{plan.description && <p className="mt-2 text-muted-foreground">{plan.description}</p>}</section><div className="grid gap-4 md:grid-cols-2">{days.map((item, index) => { const last = history.find((log) => log.training_plan_id === plan.id && log.day_number === index + 1); const estimate = item.exercises.reduce((sum, exercise) => sum + (baseSetCount(exercise) * restSeconds(exercise)) + 120, 0); return <Card key={item.id}><CardHeader><CardTitle>Ημέρα {index + 1} - {item.title || item.name || "Προπόνηση"}</CardTitle><CardDescription>{item.exercises.length} ασκήσεις · ~{Math.max(1, Math.round(estimate / 60))} λεπτά</CardDescription></CardHeader><CardContent className="space-y-4"><p className="text-sm text-muted-foreground">{item.exercises.slice(0, 3).map(displayName).join(", ")}{item.exercises.length > 3 ? "..." : ""}</p>{last && <p className="text-xs text-muted-foreground">Τελευταία φορά: {dateFormat.format(new Date(last.completed_at))} · {Math.round(last.duration_seconds / 60)} λεπτά</p>}<Button className="w-full" onClick={() => void startWorkout(index)}><Play className="mr-2 h-4 w-4" />Έναρξη Προπόνησης</Button></CardContent></Card> })}</div></>}</div>
    {phase === "workout" && day && <div className="fixed inset-0 z-50 overflow-y-auto bg-background"><header className="sticky top-0 z-20 border-b bg-background/95 px-4 py-3 backdrop-blur"><div className="mx-auto flex max-w-4xl items-center justify-between gap-3"><Button size="icon" variant="ghost" onClick={() => setExitOpen(true)} aria-label="Έξοδος"><X className="h-5 w-5" /></Button><p className="min-w-0 truncate text-center font-medium">Ημέρα {dayIndex + 1} - {day.title || day.name}</p><div className="flex items-center gap-2"><span className="flex items-center gap-1 text-sm tabular-nums text-muted-foreground"><Clock3 className="h-4 w-4" />{workoutTime(elapsedSeconds)}</span><Button size="icon" variant="ghost" onClick={toggleSound} aria-label="Ρύθμιση ήχου">{soundEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}</Button></div></div></header><main className="mx-auto max-w-4xl space-y-0 p-4 pb-28 sm:p-8 sm:pb-32">{day.exercises.map((exercise, exerciseIndex) => <div key={exercise.id}><Card className="rounded-xl border-border bg-card shadow-sm"><CardContent className="space-y-4 p-4"><div className="flex items-center gap-3">{exercise.image_url ? <button type="button" onClick={() => setInfoExercise(exercise)} className="shrink-0 cursor-pointer rounded-full ring-2 ring-transparent transition hover:ring-primary hover:ring-offset-2"><img src={resolveMediaUrl(exercise.image_url)} alt="" className="h-12 w-12 rounded-full object-cover" /></button> : <button type="button" onClick={() => setInfoExercise(exercise)} className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-muted ring-2 ring-transparent transition hover:ring-primary hover:ring-offset-2"><ImageOff className="h-5 w-5 text-muted-foreground" /></button>}<div className="min-w-0 flex-1"><h2 className="truncate text-base font-semibold">{displayName(exercise)}</h2><p className="text-xs text-muted-foreground">{exercise.muscle_group || "-"}{exercise.equipment ? ` · ${exercise.equipment}` : ""}</p><div className="mt-1 flex items-center gap-2"><span className="flex items-center gap-1 text-xs text-muted-foreground"><Clock3 className="h-3.5 w-3.5" />Rest: {restSeconds(exercise)}&quot;</span><Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => startRest(exercise)}><Clock3 className="mr-1 h-3.5 w-3.5" />Εκκίνηση</Button></div></div></div><ExerciseHistory exerciseName={displayName(exercise)} /><div className="overflow-hidden rounded-lg border border-border"><table className="w-full text-sm"><thead className="bg-muted/50 text-left text-xs text-muted-foreground"><tr><th className="p-3">ΣΕΤ</th><th className="p-3">ΠΡΟΗΓ.</th><th className="p-3">KG</th><th className="p-3">ΕΠΑΝ.</th><th className="p-3 text-right">ΟΛΟΚΛΗΡΩΣΗ</th></tr></thead><tbody>{Array.from({ length: visibleSetCount(exercise) }, (_, index) => { const setNumber = index + 1; const key = setKey(exercise, setNumber); const state = sets[key] || { weight: 0, reps: plannedReps(exercise), completed: false }; return <SetRow key={key} setNumber={setNumber} previous={previousSets[key]} weightKg={state.weight} repsCompleted={state.reps} isCompleted={state.completed} autoFocusKg={focusSet === key} onWeightChange={(weight) => setSets((current) => ({ ...current, [key]: { ...state, weight } }))} onRepsChange={(reps) => setSets((current) => ({ ...current, [key]: { ...state, reps } }))} onComplete={(completed) => void toggleSet(exercise, setNumber, completed)} /> })}</tbody></table><Button variant="ghost" className="h-10 w-full justify-center text-sm text-muted-foreground" onClick={() => addSet(exercise)}><Plus className="mr-1 h-4 w-4" />Προσθήκη Σετ</Button></div>{exercise.notes && <p className="rounded-md bg-muted/30 p-2 text-xs italic text-muted-foreground">{exercise.notes}</p>}</CardContent></Card>{exerciseIndex < day.exercises.length - 1 && <Separator className="my-6" />}</div>)}</main><footer className="sticky bottom-0 border-t bg-background/95 p-4 backdrop-blur"><div className="mx-auto max-w-4xl"><Button className="w-full" size="lg" disabled={completedSets === 0} onClick={() => setPhase("complete")}><Dumbbell className="mr-2 h-5 w-5" />Ολοκλήρωση Προπόνησης</Button></div></footer>{restLeft > 0 && <RestTimer seconds={restLeft} totalSeconds={restTotal} exerciseName={restExerciseName || undefined} onChange={setRestLeft} onComplete={() => { setRestLeft(0); setRestExerciseName(null); playSound("bell", soundEnabled) }} />}</div>}
    <Dialog open={Boolean(infoExercise)} onOpenChange={(open) => !open && setInfoExercise(null)}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">{infoExercise && <><DialogHeader><DialogTitle>{displayName(infoExercise)}</DialogTitle><DialogDescription>{infoExercise.muscle_group || "-"}{infoExercise.equipment ? ` · ${infoExercise.equipment}` : ""}</DialogDescription></DialogHeader>{infoExercise.image_url && <img src={resolveMediaUrl(infoExercise.image_url)} alt="" className="max-h-[300px] w-full rounded-md object-cover" />}<div className="space-y-4 text-sm">{infoExercise.instructions && <section><h3 className="font-semibold">Περιγραφή</h3><p className="mt-1 text-muted-foreground">{infoExercise.instructions}</p></section>}{infoExercise.notes && <section><h3 className="font-semibold">Εκτέλεση</h3><p className="mt-1 text-muted-foreground">{infoExercise.notes}</p></section>}{infoExercise.video_url && <Button asChild variant="outline"><a href={infoExercise.video_url} target="_blank" rel="noreferrer">Δες το βίντεο <ExternalLink className="ml-2 h-4 w-4" /></a></Button>}{!infoExercise.instructions && !infoExercise.notes && !infoExercise.video_url && <p className="text-muted-foreground">Δεν υπάρχουν επιπλέον πληροφορίες για αυτή την άσκηση.</p>}</div></>}</DialogContent></Dialog>
    {phase === "complete" && <WorkoutSummary durationSeconds={elapsedSeconds} completedSets={completedSets} totalSets={allSets.length} volumeKg={totalVolume} exerciseCount={day?.exercises.length || 0} notes={summaryNotes} onNotesChange={setSummaryNotes} onSave={() => void saveWorkout()} saving={saving} />}{exitOpen && <AlertDialog open onOpenChange={setExitOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Έξοδος από την προπόνηση;</AlertDialogTitle><AlertDialogDescription>Η πρόοδός σου θα χαθεί.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Μείνε</AlertDialogCancel><AlertDialogAction onClick={() => void cancelWorkout()}>Έξοδος</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>}
  </ClientShell>
}

export default function ClientProgramPage() { return <ProtectedRoute allow="client-active"><ClientProgramContent /></ProtectedRoute> }
