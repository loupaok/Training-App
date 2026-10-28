"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { LineChart } from "@tremor/react"
import { ChevronDown, ChevronLeft, ChevronRight, Clock3, Dumbbell, ImageOff, Info, Layers3, Play, Plus, Settings2, TrendingUp, Volume2, VolumeX, X } from "lucide-react"
import { ProtectedRoute } from "@/components/auth/protected-route"
import { ManualWorkoutClock, RestTimer, type ManualClockStatus } from "@/components/client/rest-timer"
import { MobileWorkoutFlow } from "@/components/client/mobile-workout-flow"
import { SetRow } from "@/components/client/set-row"
import { WorkoutSummary, type WorkoutFeeling } from "@/components/client/workout-summary"
import { ClientShell } from "@/components/shell/client-shell"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { useAuth } from "@/lib/auth/auth-context"
import { api } from "@/lib/api/client"
import { resolveMediaUrl } from "@/lib/media"
import { cacheOfflineData, createOfflineWorkoutId, isOnline, queueOfflineWorkout, readOfflineData, syncOfflineWorkouts } from "@/lib/offline-client"
import { toast } from "sonner"

type Exercise = { id: number; exercise_id?: number | null; exercise_name?: string; name?: string; sets?: string; reps?: string; rest_seconds?: string | number | null; notes?: string | null; image_url?: string | null; muscle_group?: string | null; equipment?: string | null; video_url?: string | null; instructions?: string | null }
type TrainingDay = { id: number; day_of_week: number; title?: string | null; name?: string; notes?: string | null; coach_notes?: string | null; exercises: Exercise[] }
type TrainingPlan = { id: number; title: string; description?: string | null; created_at?: string | null; days: TrainingDay[] } | null
type WorkoutLog = { id: number; training_plan_id: number; day_number: number; day_name?: string | null; completed_at: string; duration_seconds: number; total_volume_kg?: number | null; workout_feeling?: "easy" | "good" | "hard" | "pr" | null; notes?: string | null; setLogs?: Array<{ exercise_name?: string; weight_kg?: number | null }> }
type LastSet = { exerciseName: string; setNumber: number; weightKg: number; repsCompleted: number }
type HistorySession = { completedAt: string; sets: Array<{ setNumber: number; weightKg: number; repsCompleted: number }> }
type SetState = { weight: number; reps: number; completed: boolean }
const defaultDayNames = new Set(["Κυριακή", "Δευτέρα", "Τρίτη", "Τετάρτη", "Πέμπτη", "Παρασκευή", "Σάββατο"])

function getDayTitle(day: TrainingDay, index: number): string {
  const customName = day.name || day.title
  if (customName?.trim() && !defaultDayNames.has(customName.trim()) && !/^(ημέρα|day|μέρα)\s*\d+$/i.test(customName.trim())) return customName.trim()

  const muscleGroups = day.exercises
    .map((exercise) => exercise.muscle_group || "")
    .filter(Boolean)
    .map((muscleGroup) => muscleGroup.split("/")[0].split(",")[0].trim())
  const unique = [...new Set(muscleGroups)]

  return unique.length ? unique.slice(0, 3).join(" & ") : `Ημέρα ${index + 1}`
}
type Dashboard = { client?: { subscriptionStatus?: string | null }; unreadNotifications?: number }
type ProgramOfflineCache = { training: TrainingPlan; workoutHistory: WorkoutLog[]; dashboard: Dashboard }
type WorkoutSettings = { weightUnit: "kg" | "lbs"; defaultRest: number; autoRest: boolean; soundEnabled: boolean; keepAwake: boolean; exerciseView: "single" | "all" }

const dateFormat = new Intl.DateTimeFormat("el-GR", { day: "numeric", month: "short", year: "numeric" })
const workoutFeelingMeta: Record<string, { emoji: string; label: string }> = {
  easy: { emoji: "😊", label: "Εύκολο" },
  good: { emoji: "😄", label: "Καλά" },
  hard: { emoji: "😤", label: "Δύσκολο" },
  pr: { emoji: "🏆", label: "PR" },
}
const settingsKey = "workout-settings"
const workoutDraftKey = "workout-draft"
const defaultSettings: WorkoutSettings = { weightUnit: "kg", defaultRest: 90, autoRest: true, soundEnabled: true, keepAwake: true, exerciseView: "single" }
const baseSetCount = (exercise: Exercise) => Math.max(1, Number.parseInt(String(exercise.sets || "1"), 10) || 1)
const plannedReps = (exercise: Exercise) => Number.parseInt(String(exercise.reps || "0"), 10) || 0
const restSeconds = (exercise: Exercise) => Math.max(0, Number.parseInt(String(exercise.rest_seconds || "0"), 10) || 0)
const exerciseKey = (exercise: Exercise) => String(exercise.exercise_id || exercise.id)
const setKey = (exercise: Exercise, setNumber: number) => `${exerciseKey(exercise)}-${setNumber}`
const workoutTime = (seconds: number) => `${String(Math.floor(seconds / 3600)).padStart(2, "0")}:${String(Math.floor((seconds % 3600) / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`
const displayName = (exercise: Exercise) => exercise.exercise_name || exercise.name || "Άσκηση"
const displayWeight = (weightKg: number, unit: WorkoutSettings["weightUnit"]) => unit === "lbs" ? Math.round(weightKg * 2.20462 * 10) / 10 : weightKg

function playSound(kind: "tick" | "bell" | "fanfare", enabled: boolean) {
  if (!enabled || typeof window === "undefined") return
  const Context = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Context) return
  const context = new Context()
  const oscillator = context.createOscillator()
  const gain = context.createGain()
  oscillator.type = kind === "bell" ? "sine" : "triangle"
  oscillator.frequency.value = kind === "tick" ? 800 : kind === "bell" ? 440 : 660
  gain.gain.setValueAtTime(0.08, context.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + (kind === "tick" ? 0.12 : 0.8))
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
    catch { setSessions([]) } finally { setLoading(false) }
  }
  const chartData = useMemo(() => (sessions || []).slice(0, 8).reverse().map((session) => ({ date: dateFormat.format(new Date(session.completedAt)), weight: Math.max(...session.sets.map((set) => set.weightKg), 0) })), [sessions])
  return <Collapsible open={open} onOpenChange={load}><CollapsibleTrigger className="flex w-full items-center justify-between rounded-md py-1 text-sm font-medium"><span className="flex items-center gap-2"><Info className="h-4 w-4 text-primary" />Ιστορικό</span><ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} /></CollapsibleTrigger><CollapsibleContent><div className="mt-3 rounded-md bg-muted/30 p-3">{loading ? <div className="space-y-3"><Skeleton className="h-[150px] w-full" /><Skeleton className="h-8 w-2/3" /></div> : sessions?.length ? <>{chartData.length >= 2 ? <LineChart className="h-[150px]" data={chartData} index="date" categories={["weight"]} colors={["blue"]} showLegend={false} showXAxis={false} showYAxis={false} valueFormatter={(value) => `${value}kg`} /> : <p className="mb-3 text-xs text-muted-foreground">Χρειάζονται 2+ προπονήσεις για γράφημα</p>}<ScrollArea className="max-h-56"><div className="space-y-4 pr-3">{sessions.map((session) => <div key={session.completedAt}><p className="text-xs font-medium">{dateFormat.format(new Date(session.completedAt))}</p>{session.sets.map((set) => <p key={set.setNumber} className="mt-1 text-xs text-muted-foreground">Σετ {set.setNumber}: {set.weightKg}kg × {set.repsCompleted}</p>)}</div>)}</div></ScrollArea></> : <p className="text-xs text-muted-foreground">Δεν υπάρχει ιστορικό για αυτή την άσκηση.</p>}</div></CollapsibleContent></Collapsible>
}

function ClientProgramContent() {
  const { user, logout } = useAuth()
  const [plan, setPlan] = useState<TrainingPlan>(null)
  const [history, setHistory] = useState<WorkoutLog[]>([])
  const [paymentApproved, setPaymentApproved] = useState(false)
  const [unreadNotifications, setUnreadNotifications] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [phase, setPhase] = useState<"overview" | "list" | "details" | "workout" | "complete" | "recap">("list")
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [workoutLogId, setWorkoutLogId] = useState<number | null>(null)
  const [offlineWorkoutId, setOfflineWorkoutId] = useState<string | null>(null)
  const [dayIndex, setDayIndex] = useState(0)
  const [sets, setSets] = useState<Record<string, SetState>>({})
  const [previousSets, setPreviousSets] = useState<Record<string, { weight: number; reps: number }>>({})
  const [personalBests, setPersonalBests] = useState<Record<string, number>>({})
  const [personalBestsReady, setPersonalBestsReady] = useState(false)
  const [extraSets, setExtraSets] = useState<Record<string, number>>({})
  const [focusSet, setFocusSet] = useState<string | null>(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [workoutStartedAt, setWorkoutStartedAt] = useState<number | null>(null)
  const [openExerciseIndex, setOpenExerciseIndex] = useState(0)
  const [restLeft, setRestLeft] = useState(0)
  const [manualClockOpen, setManualClockOpen] = useState(false)
  const [manualClockStatus, setManualClockStatus] = useState<ManualClockStatus>({ mode: null, display: "", running: false })
  const [restTotal, setRestTotal] = useState(0)
  const [restExerciseName, setRestExerciseName] = useState<string | null>(null)
  const [settings, setSettings] = useState<WorkoutSettings>(defaultSettings)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [exitOpen, setExitOpen] = useState(false)
  const [summaryNotes, setSummaryNotes] = useState("")
  const [workoutFeeling, setWorkoutFeeling] = useState<WorkoutFeeling>(null)
  const [saving, setSaving] = useState(false)
  const [infoExercise, setInfoExercise] = useState<Exercise | null>(null)
  const [totalVolumeKg, setTotalVolumeKg] = useState<number | null>(null)
  const [lastDayVolume, setLastDayVolume] = useState<number | null>(null)
  const [lastVolumeByDay, setLastVolumeByDay] = useState<Record<number, number | null>>({})
  const [draftRestored, setDraftRestored] = useState(false)

  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has("clock")) return
    setManualClockOpen(true)
    window.history.replaceState({}, "", window.location.pathname)
  }, [])

  const load = useCallback(async () => {
    if (!user?.id) { setLoading(false); return }
    setLoading(true); setError("")
    try {
      const [training, dashboard] = await Promise.all([api.get<TrainingPlan>("/client/training-plan"), api.get<Dashboard>("/client/dashboard")])
      const workoutHistory = training ? await api.get<WorkoutLog[]>(`/client/workout/history?planId=${training.id}&limit=100`) : []
      setPlan(training); setHistory(workoutHistory); setPaymentApproved(dashboard.client?.subscriptionStatus === "active"); setUnreadNotifications(dashboard.unreadNotifications || 0)
      cacheOfflineData<ProgramOfflineCache>(user.id, "training", { training, workoutHistory, dashboard })
      if (training?.days?.length) {
        const entries = await Promise.all(training.days.map(async (_, index) => {
          try {
            const last = await api.get<{ totalVolumeKg?: number | null }>(`/client/workout/last/${training.id}/${index + 1}`)
            return [index, last.totalVolumeKg ?? null] as const
          } catch { return [index, null] as const }
        }))
        setLastVolumeByDay(Object.fromEntries(entries))
      }
    } catch (caughtError) {
      const cached = readOfflineData<ProgramOfflineCache>(user.id, "training")
      if (cached) {
        setPlan(cached.training); setHistory(cached.workoutHistory); setPaymentApproved(cached.dashboard.client?.subscriptionStatus === "active"); setUnreadNotifications(cached.dashboard.unreadNotifications || 0)
        setError("Είσαι εκτός σύνδεσης. Εμφανίζεται η τελευταία αποθηκευμένη προπόνηση.")
      } else setError(caughtError instanceof Error ? caughtError.message : "Δεν φορτώθηκε το πρόγραμμα προπόνησης.")
    } finally { setLoading(false) }
    if (isOnline()) api.get<{ totalVolumeKg: number }>("/client/workout/total-volume").then((result) => setTotalVolumeKg(result.totalVolumeKg)).catch(() => {})
  }, [user?.id])

  const openDayDetails = (index: number, planId: number) => {
    setSelectedDay(index); setPhase("details"); setLastDayVolume(null)
    api.get<{ totalVolumeKg?: number | null }>(`/client/workout/last/${planId}/${index + 1}`)
      .then((last) => setLastDayVolume(last.totalVolumeKg ?? null))
      .catch(() => setLastDayVolume(null))
  }

  useEffect(() => {
    void load()
    const saved = window.localStorage.getItem(settingsKey)
    if (saved) {
      try { setSettings({ ...defaultSettings, ...JSON.parse(saved) }) } catch { window.localStorage.removeItem(settingsKey) }
    }
    // Resume an in-progress workout after an accidental refresh — the server
    // still has the open workout_logs row, so we just restore the local
    // entered sets/timer and keep logging against the same workoutLogId.
    try {
      const draft = window.sessionStorage.getItem(workoutDraftKey)
      if (draft) {
        const parsed = JSON.parse(draft)
        if (parsed.phase === "workout" || parsed.phase === "complete") {
          setDayIndex(parsed.dayIndex ?? 0)
          setWorkoutLogId(parsed.workoutLogId ?? null)
          setOfflineWorkoutId(parsed.offlineWorkoutId ?? null)
          setSets(parsed.sets || {})
          setPreviousSets(parsed.previousSets || {})
          setPersonalBests(parsed.personalBests || {})
          setPersonalBestsReady(true)
          setExtraSets(parsed.extraSets || {})
          setElapsedSeconds(parsed.elapsedSeconds || 0)
          setWorkoutStartedAt(parsed.workoutStartedAt || Date.now() - ((parsed.elapsedSeconds || 0) * 1000))
          setSummaryNotes(parsed.summaryNotes || "")
          setWorkoutFeeling(parsed.workoutFeeling ?? null)
          setPhase(parsed.phase)
        }
      }
    } catch { window.sessionStorage.removeItem(workoutDraftKey) }
    setDraftRestored(true)
  }, [load])
  useEffect(() => { window.localStorage.setItem(settingsKey, JSON.stringify(settings)) }, [settings])
  useEffect(() => {
    if (phase !== "workout" || !workoutStartedAt) return
    const update = () => setElapsedSeconds(Math.max(0, Math.floor((Date.now() - workoutStartedAt) / 1000)))
    update()
    const timer = window.setInterval(update, 1000)
    document.addEventListener("visibilitychange", update)
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", update) }
  }, [phase, workoutStartedAt])
  useEffect(() => {
    if (phase !== "workout" || !settings.keepAwake || !("wakeLock" in navigator)) return
    let lock: { release: () => Promise<void> } | null = null
    const request = async () => { try { lock = await (navigator as Navigator & { wakeLock: { request: (type: "screen") => Promise<{ release: () => Promise<void> }> } }).wakeLock.request("screen") } catch { /* unsupported or refused */ } }
    void request()
    const restore = () => { if (document.visibilityState === "visible") void request() }
    document.addEventListener("visibilitychange", restore)
    return () => { document.removeEventListener("visibilitychange", restore); if (lock) void lock.release() }
  }, [phase, settings.keepAwake])
  useEffect(() => {
    if (!draftRestored) return
    if (phase === "workout" || phase === "complete") {
      window.sessionStorage.setItem(workoutDraftKey, JSON.stringify({ phase, dayIndex, workoutLogId, offlineWorkoutId, sets, previousSets, personalBests, extraSets, elapsedSeconds, workoutStartedAt, summaryNotes, workoutFeeling }))
    } else {
      window.sessionStorage.removeItem(workoutDraftKey)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftRestored, phase, dayIndex, workoutLogId, offlineWorkoutId, sets, previousSets, personalBests, extraSets, elapsedSeconds, workoutStartedAt, summaryNotes, workoutFeeling])

  const rawDays = plan?.days || []
  const days = rawDays.map((currentDay, index) => ({ ...currentDay, title: getDayTitle(currentDay, index), name: getDayTitle(currentDay, index) }))
  const nextDayIndex = useMemo(() => {
    if (!plan || !days.length) return 0
    const startOfWeek = new Date(); startOfWeek.setHours(0, 0, 0, 0); startOfWeek.setDate(startOfWeek.getDate() - ((startOfWeek.getDay() + 6) % 7))
    const latest = history.filter((log) => log.training_plan_id === plan.id && new Date(log.completed_at) >= startOfWeek).sort((a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime())[0]
    return latest ? latest.day_number % days.length : 0
  }, [days.length, history, plan])
  const day = days[dayIndex]
  const visibleSetCount = useCallback((exercise: Exercise) => baseSetCount(exercise) + (extraSets[exerciseKey(exercise)] || 0), [extraSets])
  const allSets = useMemo(() => day?.exercises.flatMap((exercise) => Array.from({ length: visibleSetCount(exercise) }, (_, index) => ({ exercise, setNumber: index + 1 }))) || [], [day, visibleSetCount])
  const completedSets = allSets.filter(({ exercise, setNumber }) => sets[setKey(exercise, setNumber)]?.completed).length
  const totalVolume = allSets.reduce((sum, { exercise, setNumber }) => { const state = sets[setKey(exercise, setNumber)]; return sum + (state?.completed ? state.weight * state.reps : 0) }, 0)
  const effectiveBest = (exercise: Exercise) => Math.max(personalBests[displayName(exercise)] || 0, ...Array.from({ length: visibleSetCount(exercise) }, (_, index) => {
    const state = sets[setKey(exercise, index + 1)]
    return state?.completed ? state.weight : 0
  }))
  const completedExercises = day?.exercises.filter((exercise) => Array.from({ length: visibleSetCount(exercise) }, (_, index) => sets[setKey(exercise, index + 1)]?.completed).some(Boolean)).length || 0
  const activeExerciseNumber = Math.min((day?.exercises.findIndex((exercise) => !Array.from({ length: visibleSetCount(exercise) }, (_, index) => sets[setKey(exercise, index + 1)]?.completed).every(Boolean)) ?? 0) + 1, day?.exercises.length || 1)
  const exerciseProgress = day?.exercises.length ? (activeExerciseNumber / day.exercises.length) * 100 : 0

  const startRest = (exercise: Exercise) => {
    const seconds = restSeconds(exercise) || settings.defaultRest
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") void Notification.requestPermission().catch(() => undefined)
    setRestTotal(seconds); setRestLeft(seconds); setRestExerciseName(displayName(exercise))
  }
  const loadPersonalBests = async (exercises: Exercise[]) => {
    setPersonalBestsReady(false)
    const entries = await Promise.all(exercises.map(async (exercise) => {
      try {
        const record = await api.get<{ bestWeight: number }>(`/client/workout/exercise-best?exerciseName=${encodeURIComponent(displayName(exercise))}`)
        return [displayName(exercise), record.bestWeight || 0] as const
      } catch { return [displayName(exercise), 0] as const }
    }))
    setPersonalBests(Object.fromEntries(entries))
    setPersonalBestsReady(true)
  }

  const startWorkout = async (index: number) => {
    if (!plan || !days[index]) return
    if (!isOnline()) {
      const selectedDay = days[index]
      const initial: Record<string, SetState> = {}
      selectedDay.exercises.forEach((exercise) => Array.from({ length: baseSetCount(exercise) }, (_, setIndex) => setIndex + 1).forEach((setNumber) => {
        initial[setKey(exercise, setNumber)] = { weight: 0, reps: plannedReps(exercise), completed: false }
      }))
      setSets(initial); setPreviousSets({}); setPersonalBests({}); setPersonalBestsReady(false); setExtraSets({}); setFocusSet(null); setOpenExerciseIndex(0); setWorkoutLogId(null); setOfflineWorkoutId(createOfflineWorkoutId()); setDayIndex(index); setElapsedSeconds(0); setWorkoutStartedAt(Date.now()); setRestLeft(0); setRestTotal(0); setRestExerciseName(null); setWorkoutFeeling(null); setPhase("workout")
      toast.message("Η προπόνηση καταγράφεται offline και θα συγχρονιστεί όταν επανέλθει η σύνδεση.")
      return
    }
    try {
      const selectedDay = days[index]
      const result = await api.post<{ workoutLogId: number }>("/client/workout/start", { trainingPlanId: plan.id, dayNumber: index + 1, dayName: getDayTitle(selectedDay, index) })
      const last = await api.get<{ sets: LastSet[] }>(`/client/workout/last/${plan.id}/${index + 1}`)
      const initial: Record<string, SetState> = {}; const previous: Record<string, { weight: number; reps: number }> = {}
      selectedDay.exercises.forEach((exercise) => Array.from({ length: baseSetCount(exercise) }, (_, setIndex) => setIndex + 1).forEach((setNumber) => {
        const prior = last.sets.find((entry) => entry.exerciseName === displayName(exercise) && entry.setNumber === setNumber)
        const value = { weight: prior?.weightKg || 0, reps: prior?.repsCompleted || plannedReps(exercise) }
        initial[setKey(exercise, setNumber)] = { ...value, completed: false }
        if (prior) previous[setKey(exercise, setNumber)] = value
      }))
      setSets(initial); setPreviousSets(previous); setPersonalBestsReady(false); setExtraSets({}); setFocusSet(null); setOpenExerciseIndex(0); setWorkoutLogId(result.workoutLogId); setOfflineWorkoutId(null); setDayIndex(index); setElapsedSeconds(0); setWorkoutStartedAt(Date.now()); setRestLeft(0); setRestTotal(0); setRestExerciseName(null); setWorkoutFeeling(null); setPhase("workout")
      void loadPersonalBests(selectedDay.exercises)
    } catch (caughtError) { setError(caughtError instanceof Error ? caughtError.message : "Δεν ξεκίνησε η προπόνηση.") }
  }

  const addSet = (exercise: Exercise) => {
    const setNumber = visibleSetCount(exercise) + 1; const prior = sets[setKey(exercise, setNumber - 1)] || { weight: 0, reps: plannedReps(exercise), completed: false }; const key = setKey(exercise, setNumber)
    setExtraSets((current) => ({ ...current, [exerciseKey(exercise)]: (current[exerciseKey(exercise)] || 0) + 1 }))
    setSets((current) => ({ ...current, [key]: { weight: prior.weight, reps: prior.reps, completed: false } })); setFocusSet(key)
  }
  const advanceExerciseIfFinished = (exercise: Exercise, completedSet: number) => {
    if (!day || settings.exerciseView !== "single") return
    const finished = Array.from({ length: visibleSetCount(exercise) }, (_, index) => {
      const number = index + 1
      return number === completedSet || sets[setKey(exercise, number)]?.completed
    }).every(Boolean)
    if (finished) {
      const current = day.exercises.findIndex((item) => exerciseKey(item) === exerciseKey(exercise))
      if (current >= 0 && current < day.exercises.length - 1) window.setTimeout(() => setOpenExerciseIndex(current + 1), 250)
    }
  }
  const toggleSet = async (exercise: Exercise, setNumber: number, completed: boolean) => {
    const key = setKey(exercise, setNumber); const state = sets[key] || { weight: 0, reps: plannedReps(exercise), completed: false }
    if (!completed) { setSets((current) => ({ ...current, [key]: { ...state, completed: false } })); return }
    const bestBefore = Math.max(personalBests[displayName(exercise)] || 0, ...Array.from({ length: setNumber - 1 }, (_, index) => sets[setKey(exercise, index + 1)]?.weight || 0))
    const isNewRecord = personalBestsReady && state.weight > 0 && state.weight > bestBefore
    const vibrateOnCompletion = () => navigator.vibrate?.(isNewRecord ? [12, 24, 38] : 15)
    if (!workoutLogId && !offlineWorkoutId) return
    if (offlineWorkoutId) {
      setSets((current) => ({ ...current, [key]: { ...state, completed: true } })); vibrateOnCompletion(); playSound("tick", settings.soundEnabled)
      if (settings.autoRest) startRest(exercise)
      advanceExerciseIfFinished(exercise, setNumber)
      return
    }
    try {
      await api.post("/client/workout/log-set", { workoutLogId, exerciseName: displayName(exercise), exerciseId: exercise.exercise_id || null, setNumber, targetReps: plannedReps(exercise), repsCompleted: state.reps, weightKg: state.weight })
      setSets((current) => ({ ...current, [key]: { ...state, completed: true } })); vibrateOnCompletion(); playSound("tick", settings.soundEnabled)
      if (settings.autoRest) startRest(exercise)
      advanceExerciseIfFinished(exercise, setNumber)
    } catch (caughtError) { setError(caughtError instanceof Error ? caughtError.message : "Δεν αποθηκεύτηκε το σετ.") }
  }
  const cancelWorkout = async () => {
    if (workoutLogId) { try { await api.post("/client/workout/cancel", { workoutLogId }) } catch { /* The local workout still closes after a transient failure. */ } }
    setWorkoutLogId(null); setOfflineWorkoutId(null); setRestLeft(0); setRestExerciseName(null); setExitOpen(false); setPhase("list")
  }
  const saveAndExitWorkout = () => {
    setRestLeft(0); setRestExerciseName(null); setExitOpen(false); setPhase("list")
  }
  const saveWorkout = async () => {
    if (!workoutLogId && !offlineWorkoutId) return
    if (offlineWorkoutId && user && day) {
      const offlineSets = allSets.flatMap(({ exercise, setNumber }) => {
        const state = sets[setKey(exercise, setNumber)]
        return state?.completed ? [{ exerciseName: displayName(exercise), exerciseId: exercise.exercise_id || null, setNumber, targetReps: plannedReps(exercise), repsCompleted: state.reps, weightKg: state.weight }] : []
      })
      queueOfflineWorkout({ id: offlineWorkoutId, clientId: user.id, trainingPlanId: plan!.id, dayNumber: dayIndex + 1, dayName: getDayTitle(day, dayIndex), durationSeconds: elapsedSeconds, totalSetsCompleted: completedSets, totalVolumeKg: totalVolume, notes: summaryNotes, workoutFeeling, sets: offlineSets, createdAt: new Date().toISOString() })
      const synced = await syncOfflineWorkouts(user.id)
      setOfflineWorkoutId(null); setWorkoutLogId(null); setSummaryNotes(""); window.dispatchEvent(new Event("workout-completed")); setPhase("recap")
      toast.success(synced ? "Η προπόνηση συγχρονίστηκε." : "Η προπόνηση αποθηκεύτηκε στη συσκευή και θα συγχρονιστεί αυτόματα.")
      return
    }
    setSaving(true)
    try {
      await api.post("/client/workout/complete", { workoutLogId, durationSeconds: elapsedSeconds, totalSetsCompleted: completedSets, totalVolumeKg: totalVolume, notes: summaryNotes, workoutFeeling })
      playSound("fanfare", settings.soundEnabled); setWorkoutLogId(null); setSummaryNotes(""); window.dispatchEvent(new Event("workout-completed")); await load(); setPhase("recap")
    } catch (caughtError) { setError(caughtError instanceof Error ? caughtError.message : "Δεν ολοκληρώθηκε η προπόνηση.") } finally { setSaving(false) }
  }

  if (loading) return <ClientShell title="Η Προπόνησή μου" user={user} logout={logout} paymentApproved={false} active="training"><p className="text-muted-foreground">Φόρτωση...</p></ClientShell>

  return <ClientShell title="Η Προπόνησή μου" user={user} logout={logout} paymentApproved={paymentApproved} unreadNotifications={unreadNotifications} active="training">
    {phase === "list" && <ProgramList plan={plan} days={days} history={history} nextDayIndex={nextDayIndex} lastVolumeByDay={lastVolumeByDay} totalVolumeKg={totalVolumeKg} error={error} onOpenDay={(index) => plan && openDayDetails(index, plan.id)} onStartDay={(index) => void startWorkout(index)} />}
    {phase === "details" && selectedDay !== null && days[selectedDay] && <DayOverview day={days[selectedDay]} dayIndex={selectedDay} totalDays={days.length} onBack={() => setPhase("list")} onStart={() => void startWorkout(selectedDay)} />}
    {phase === "recap" && day && <div className="mx-auto max-w-4xl space-y-6"><Button variant="ghost" className="px-0" onClick={() => setPhase("list")}><ChevronLeft className="mr-1 h-4 w-4" />Επιστροφή στις Προπονήσεις</Button><section><h1 className="text-xl font-bold">{day.title || day.name || `Ημέρα ${dayIndex + 1}`}</h1><p className="mt-1 text-sm text-muted-foreground">{dateFormat.format(new Date())}</p></section><div className="grid gap-3 sm:grid-cols-3"><Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Διάρκεια</p><p className="mt-1 text-lg font-semibold">{Math.max(1, Math.round(elapsedSeconds / 60))} λεπτά</p></CardContent></Card><Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Κιλά</p><p className="mt-1 text-lg font-semibold">{totalVolume.toLocaleString("el-GR")} kg</p></CardContent></Card><Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Σετ</p><p className="mt-1 text-lg font-semibold">{completedSets}</p></CardContent></Card></div><div className="divide-y border-y">{day.exercises.map((exercise) => { const exerciseSets = Array.from({ length: visibleSetCount(exercise) }, (_, index) => sets[setKey(exercise, index + 1)]).filter((set): set is SetState => Boolean(set?.completed)); if (!exerciseSets.length) return null; const exerciseVolume = exerciseSets.reduce((sum, set) => sum + set.weight, 0); return <div key={exercise.id} className="flex items-center gap-3 py-3">{exercise.image_url ? <img src={resolveMediaUrl(exercise.image_url)} alt="" className="h-11 w-11 rounded-md object-cover" /> : <span className="grid h-11 w-11 place-items-center rounded-md bg-muted"><Dumbbell className="h-4 w-4 text-muted-foreground" /></span>}<div className="min-w-0 flex-1"><p className="font-medium">{displayName(exercise)}</p><p className="mt-0.5 text-sm text-muted-foreground">{exerciseSets.length} σετ · {exerciseVolume.toLocaleString("el-GR")} kg</p><p className="mt-1 truncate text-xs text-muted-foreground">{exerciseSets.map((set) => `${set.weight}×${set.reps}`).join(" · ")}</p></div></div> })}</div>{workoutFeeling && <Card><CardContent className="flex items-center gap-2 p-4"><span className="text-xl">{workoutFeeling === "easy" ? "😊" : workoutFeeling === "good" ? "😄" : workoutFeeling === "hard" ? "😤" : "🏆"}</span><div><p className="text-xs text-muted-foreground">Πώς πήγε;</p><p className="font-medium">{workoutFeeling === "easy" ? "Εύκολο" : workoutFeeling === "good" ? "Καλά" : workoutFeeling === "hard" ? "Δύσκολο" : "PR"}</p></div></CardContent></Card>}<Button className="w-full" size="lg" onClick={() => setPhase("list")}>Επιστροφή στις Προπονήσεις</Button></div>}
    {phase === "overview" && <div className="mx-auto max-w-4xl space-y-6">
      {error && <Alert variant="destructive"><AlertTitle>Σφάλμα</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
      {!plan || !days.length ? <Card><CardContent className="py-16 text-center text-muted-foreground">Δεν έχει ανατεθεί πρόγραμμα προπόνησης ακόμα.</CardContent></Card> : <><section><div className="flex flex-wrap items-center gap-3"><h1 className="text-2xl font-bold">Το πρόγραμμά μου</h1><Badge>Ενεργό</Badge></div>{plan.description && <p className="mt-2 text-muted-foreground">{plan.description}</p>}</section><div className="grid gap-4 md:grid-cols-2">{days.map((item, index) => {
        const last = history.find((log) => log.training_plan_id === plan.id && log.day_number === index + 1)
        const estimate = item.exercises.reduce((sum, exercise) => sum + (baseSetCount(exercise) * restSeconds(exercise)) + 120, 0)
        return <Card key={item.id}><CardHeader><CardTitle>Ημέρα {index + 1} - {item.title || item.name || "Προπόνηση"}</CardTitle><CardDescription>{item.exercises.length} ασκήσεις · ~{Math.max(1, Math.round(estimate / 60))} λεπτά</CardDescription></CardHeader><CardContent className="space-y-4"><p className="text-sm text-muted-foreground">{item.exercises.slice(0, 3).map(displayName).join(", ")}{item.exercises.length > 3 ? "..." : ""}</p>{last && <p className="text-xs text-muted-foreground">Τελευταία φορά: {dateFormat.format(new Date(last.completed_at))} · {Math.round(last.duration_seconds / 60)} λεπτά</p>}<Button className="w-full" onClick={() => void startWorkout(index)}><Play className="mr-2 h-4 w-4" />Έναρξη Προπόνησης</Button></CardContent></Card>
      })}</div></>}
    </div>}

    {phase === "workout" && day && <MobileWorkoutFlow day={day} dayIndex={dayIndex} elapsedSeconds={elapsedSeconds} settings={settings} sets={sets} previousSets={previousSets} personalBests={personalBests} recordChecksReady={personalBestsReady} extraSets={extraSets} focusSet={focusSet} clockStatus={manualClockStatus} isResting={restLeft > 0} onExit={() => setExitOpen(true)} onOpenClock={() => setManualClockOpen(true)} onOpenSettings={() => setSettingsOpen(true)} onToggleSound={() => setSettings((current) => ({ ...current, soundEnabled: !current.soundEnabled }))} onInfo={setInfoExercise} onToggleSet={(exercise, setNumber, completed) => void toggleSet(exercise, setNumber, completed)} onWeight={(exercise, setNumber, weight) => setSets((current) => ({ ...current, [setKey(exercise, setNumber)]: { ...(current[setKey(exercise, setNumber)] || { reps: plannedReps(exercise), completed: false }), weight } }))} onReps={(exercise, setNumber, reps) => setSets((current) => ({ ...current, [setKey(exercise, setNumber)]: { ...(current[setKey(exercise, setNumber)] || { weight: 0, completed: false }), reps } }))} onAddSet={addSet} onComplete={() => setPhase("complete")} onStartRest={startRest} />}
    {phase === "workout" && day && <><>{restLeft > 0 && <RestTimer seconds={restLeft} totalSeconds={restTotal} exerciseName={restExerciseName || undefined} onChange={setRestLeft} onComplete={() => { setRestLeft(0); setRestExerciseName(null); playSound("bell", settings.soundEnabled) }} />}</><ManualWorkoutClock open={manualClockOpen} onOpenChange={setManualClockOpen} defaultSeconds={settings.defaultRest} onStatusChange={setManualClockStatus} /></>}
    {false && <div className="fixed inset-0 z-50 overflow-y-auto bg-background">
      <div className="sticky top-0 z-20 bg-background/95 shadow-sm backdrop-blur">
      <header className="border-b px-4 py-2 sm:py-3"><div className="mx-auto flex max-w-4xl items-center justify-between gap-3"><Button size="icon" variant="ghost" onClick={() => setExitOpen(true)} aria-label="Έξοδος"><X className="h-5 w-5" /></Button><div className="min-w-0 text-center"><ManualClockTitle status={manualClockStatus} /><div className="hidden sm:block"><p className="truncate font-medium">Ημέρα {dayIndex + 1} - {day.title || day.name}</p><p className="text-xs text-muted-foreground">Άσκηση {activeExerciseNumber} από {day.exercises.length}</p></div></div><div className="flex items-center gap-1"><span className="hidden items-center gap-1 text-sm tabular-nums text-muted-foreground sm:flex"><Clock3 className="h-4 w-4" />{workoutTime(elapsedSeconds)}</span><Button size="icon" variant="ghost" onClick={() => setManualClockOpen(true)} aria-label="Χειροκίνητος χρονομετρητής"><Clock3 className="h-5 w-5" /></Button><Button size="icon" variant="ghost" onClick={() => setSettingsOpen(true)} aria-label="Ρυθμίσεις προπόνησης"><Settings2 className="h-5 w-5" /></Button><Button size="icon" variant="ghost" onClick={() => setSettings((current) => ({ ...current, soundEnabled: !current.soundEnabled }))} aria-label="Ρύθμιση ήχου">{settings.soundEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}</Button></div></div></header>
      <div className="border-b px-4 py-1 lg:py-2"><div className="mx-auto max-w-4xl"><div className="mb-1 hidden justify-between text-xs text-muted-foreground lg:flex"><span>Άσκηση {activeExerciseNumber} από {day.exercises.length}</span><span>{Math.round(exerciseProgress)}%</span></div><Progress value={exerciseProgress} className="h-1" /></div></div>
      <div className="border-b bg-background/95 px-4 py-1.5 lg:py-2"><div className="mx-auto grid max-w-4xl grid-cols-3 divide-x text-center"><div><p className="text-[10px] text-muted-foreground lg:text-xs">Διάρκεια</p><p className="text-sm font-medium tabular-nums lg:text-base">{workoutTime(elapsedSeconds)}</p></div><div><p className="text-[10px] text-muted-foreground lg:text-xs">Κιλά</p><p className="text-sm font-medium lg:text-base">{displayWeight(totalVolume, settings.weightUnit).toLocaleString("el-GR")} {settings.weightUnit}</p></div><div><p className="text-[10px] text-muted-foreground lg:text-xs">Ασκήσεις</p><p className="text-sm font-medium lg:text-base">{completedExercises}/{day.exercises.length}</p></div></div></div>
      </div>
      <main className="mx-auto max-w-4xl space-y-0 p-4 pb-28 sm:p-8 sm:pb-32">{day.exercises.map((exercise, exerciseIndex) => <div key={exercise.id}><Card className="rounded-xl border-border bg-card shadow-sm"><CardContent className="space-y-4 p-4"><div className="flex items-center gap-3">{exercise.image_url ? <button type="button" onClick={() => setInfoExercise(exercise)} className="shrink-0 cursor-pointer rounded-full ring-2 ring-transparent transition hover:ring-primary hover:ring-offset-2"><img src={resolveMediaUrl(exercise.image_url)} alt="" className="h-10 w-10 rounded-full object-cover" /></button> : <button type="button" onClick={() => setInfoExercise(exercise)} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-muted ring-2 ring-transparent transition hover:ring-primary hover:ring-offset-2"><ImageOff className="h-4 w-4 text-muted-foreground" /></button>}<div className="min-w-0 flex-1"><h2 className="truncate text-base font-semibold">{displayName(exercise)}</h2><p className="text-xs text-muted-foreground">{exercise.muscle_group || "-"}</p><div className="mt-2 flex items-center gap-2"><span className="flex items-center gap-1 text-xs text-muted-foreground"><Clock3 className="h-3.5 w-3.5" />{restSeconds(exercise) || settings.defaultRest}&quot;</span><Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => startRest(exercise)}><Play className="mr-1 h-3.5 w-3.5" />Έναρξη</Button></div></div></div><ExerciseHistory exerciseName={displayName(exercise)} /><div><table className="w-full text-sm"><thead className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground"><tr><th className="w-10 p-2 text-center">Σετ</th><th className="p-2 text-right">Προηγ.</th><th className="p-2 text-center">{settings.weightUnit}</th><th className="p-2 text-center">Επαν.</th><th className="p-2 text-right">✓</th></tr></thead><tbody>{Array.from({ length: visibleSetCount(exercise) }, (_, index) => {
        const setNumber = index + 1; const key = setKey(exercise, setNumber); const state = sets[key] || { weight: 0, reps: plannedReps(exercise), completed: false }; const priorWeightInExercise = Math.max(personalBests[displayName(exercise)] || 0, ...Array.from({ length: setNumber - 1 }, (_, priorIndex) => sets[setKey(exercise, priorIndex + 1)]?.completed ? sets[setKey(exercise, priorIndex + 1)].weight : 0)); const isPersonalRecord = state.completed && priorWeightInExercise > 0 && state.weight > priorWeightInExercise
        return <SetRow key={key} setNumber={setNumber} previous={previousSets[key]} weightKg={state.weight} repsCompleted={state.reps} isCompleted={state.completed} autoFocusKg={focusSet === key} weightUnit={settings.weightUnit} onWeightChange={(weight) => setSets((current) => ({ ...current, [key]: { ...state, weight } }))} onRepsChange={(reps) => setSets((current) => ({ ...current, [key]: { ...state, reps } }))} onComplete={(completed) => void toggleSet(exercise, setNumber, completed)} />
      })}</tbody></table><Button variant="ghost" className="mt-3 h-11 w-full border-2 border-dashed border-muted-foreground/30 text-muted-foreground transition-colors hover:border-primary hover:text-primary" onClick={() => addSet(exercise)}><Plus className="mr-1 h-4 w-4" />Προσθήκη Σετ</Button></div>{exercise.notes && <p className="rounded-md bg-muted/30 p-2 text-xs italic text-muted-foreground">{exercise.notes}</p>}</CardContent></Card>{exerciseIndex < day.exercises.length - 1 && <Separator className="my-6" />}</div>)}</main>
      <footer className="sticky bottom-0 border-t bg-background/95 p-4 backdrop-blur"><div className="mx-auto max-w-4xl"><Button className="w-full" size="lg" disabled={completedSets === 0} onClick={() => setPhase("complete")}><Dumbbell className="mr-2 h-5 w-5" />Ολοκλήρωση Προπόνησης</Button></div></footer>
      {restLeft > 0 && <RestTimer seconds={restLeft} totalSeconds={restTotal} exerciseName={restExerciseName || undefined} onChange={setRestLeft} onComplete={() => { setRestLeft(0); setRestExerciseName(null); playSound("bell", settings.soundEnabled) }} />}
      <ManualWorkoutClock open={manualClockOpen} onOpenChange={setManualClockOpen} defaultSeconds={settings.defaultRest} onStatusChange={setManualClockStatus} />
    </div>}

    <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}><SheetContent side="right"><SheetHeader><SheetTitle>Ρυθμίσεις προπόνησης</SheetTitle><SheetDescription>Οι επιλογές αποθηκεύονται σε αυτή τη συσκευή.</SheetDescription></SheetHeader><div className="space-y-6 p-4"><div><p className="mb-2 text-sm font-medium">Μονάδα βάρους</p><div className="grid grid-cols-2 gap-2"><Button variant={settings.weightUnit === "kg" ? "default" : "outline"} onClick={() => setSettings((current) => ({ ...current, weightUnit: "kg" }))}>kg</Button><Button variant={settings.weightUnit === "lbs" ? "default" : "outline"} onClick={() => setSettings((current) => ({ ...current, weightUnit: "lbs" }))}>lbs</Button></div></div><div><p className="mb-2 text-sm font-medium">Προεπιλεγμένος χρόνος ξεκούρασης</p><Select value={String(settings.defaultRest)} onValueChange={(value) => setSettings((current) => ({ ...current, defaultRest: Number(value) }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{[30, 60, 90, 120, 180].map((seconds) => <SelectItem key={seconds} value={String(seconds)}>{seconds}s</SelectItem>)}</SelectContent></Select></div><SettingSwitch label="Αυτόματη εκκίνηση χρονομέτρου" checked={settings.autoRest} onCheckedChange={(autoRest) => setSettings((current) => ({ ...current, autoRest }))} /><SettingSwitch label="Ήχος" checked={settings.soundEnabled} onCheckedChange={(soundEnabled) => setSettings((current) => ({ ...current, soundEnabled }))} /><SettingSwitch label="Η οθόνη μένει ενεργή" checked={settings.keepAwake} onCheckedChange={(keepAwake) => setSettings((current) => ({ ...current, keepAwake }))} /><div><p className="mb-2 text-sm font-medium">Προβολή ασκήσεων</p><div className="grid grid-cols-2 gap-2"><Button variant={settings.exerciseView === "single" ? "default" : "outline"} onClick={() => setSettings((current) => ({ ...current, exerciseView: "single" }))}>Μία-μία</Button><Button variant={settings.exerciseView === "all" ? "default" : "outline"} onClick={() => setSettings((current) => ({ ...current, exerciseView: "all" }))}>Όλες ανοιχτές</Button></div></div></div></SheetContent></Sheet>
    <ExerciseInfoSheet exercise={infoExercise} elapsedSeconds={elapsedSeconds} previous={infoExercise ? previousSets[setKey(infoExercise, 1)] : null} bestWeight={infoExercise ? effectiveBest(infoExercise) : 0} onOpenChange={(open) => !open && setInfoExercise(null)} />
    {phase === "complete" && <WorkoutSummary durationSeconds={elapsedSeconds} completedSets={completedSets} totalSets={allSets.length} volumeKg={totalVolume} exerciseCount={day?.exercises.length || 0} notes={summaryNotes} feeling={workoutFeeling} onNotesChange={setSummaryNotes} onFeelingChange={setWorkoutFeeling} onSave={() => void saveWorkout()} saving={saving} />}
    {exitOpen && <AlertDialog open onOpenChange={setExitOpen}><AlertDialogContent className="rounded-[22px] border-[#E6E6E2] bg-[#F4F4F2] p-5 sm:p-6"><AlertDialogHeader><AlertDialogTitle className="text-[20px] font-extrabold text-[#0B0B0B] sm:text-[22px]">Να βγεις από την προπόνηση;</AlertDialogTitle><AlertDialogDescription className="text-[13px] leading-[1.45] text-[#6A6A6A]">Τα ολοκληρωμένα set σου έχουν αποθηκευτεί. Μπορείς να συνεχίσεις αργότερα ή να ακυρώσεις οριστικά την προπόνηση.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter className="mt-3 !flex !flex-col gap-2"><AlertDialogCancel className="m-0 h-11 w-full shrink-0 rounded-full border-[#0B0B0B] bg-transparent px-4 text-[13px] font-extrabold text-[#0B0B0B]">Συνέχισε προπόνηση</AlertDialogCancel><Button type="button" variant="outline" onClick={saveAndExitWorkout} className="h-11 w-full shrink-0 rounded-full border-[#0B0B0B] bg-white px-4 text-[13px] font-extrabold text-[#0B0B0B]">Αποθήκευση για αργότερα</Button><AlertDialogAction onClick={() => void cancelWorkout()} className="h-11 w-full shrink-0 rounded-full bg-[#0B0B0B] px-4 text-[13px] font-extrabold text-white hover:bg-[#1F1F1F]">Ακύρωση προπόνησης</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>}
  </ClientShell>
}

function DayOverview({ day, dayIndex, totalDays, onBack, onStart }: { day: TrainingDay; dayIndex: number; totalDays: number; onBack: () => void; onStart: () => void }) {
  const coverExercise = day.exercises[0]
  const totalSets = day.exercises.reduce((sum, exercise) => sum + baseSetCount(exercise), 0)
  const estimatedMinutes = Math.max(1, Math.round(day.exercises.reduce((total, exercise) => total + baseSetCount(exercise) * (1 + (restSeconds(exercise) || 90) / 60), 0)))
  const coachNote = day.coach_notes || day.notes

  return <div className="-mx-4 -mt-4 min-h-[calc(100dvh-4rem)] bg-[#F4F4F2] pb-36 text-[#0B0B0B] sm:-mx-6 sm:rounded-[20px] lg:mx-auto lg:mt-0 lg:max-w-4xl">
    <section className="relative h-[290px] overflow-hidden bg-[#0B0B0B] text-white sm:rounded-t-[20px]">
      {coverExercise?.image_url ? <img src={resolveMediaUrl(coverExercise.image_url)} alt="" className="absolute inset-0 h-full w-full object-cover opacity-75" /> : <div className="absolute inset-0 grid place-items-center bg-[#171717]"><Dumbbell className="h-16 w-16 text-white/25" /></div>}
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(11,11,11,.75)_0%,rgba(11,11,11,.1)_35%,rgba(11,11,11,.9)_100%)]" />
      <span aria-hidden="true" className="absolute right-[14px] -top-5 h-[340px] w-[14px] -skew-x-[16deg] bg-[#B0F90C]" />
      <div className="absolute inset-x-0 top-0 flex h-[60px] items-center justify-between px-3"><button type="button" onClick={onBack} className="inline-flex h-[38px] items-center gap-1 rounded-full bg-black/60 py-0 pl-2 pr-3 text-[13px] font-bold text-white"><ChevronLeft className="h-[18px] w-[18px] stroke-[2.4]" />Πρόγραμμα</button><span className="grid h-[38px] w-[38px] place-items-center rounded-full bg-black/60 text-[18px] font-extrabold leading-none text-white">⋮</span></div>
      <div className="absolute inset-x-[18px] bottom-[18px] flex flex-col gap-2"><div className="flex gap-[6px]"><span className="rounded-full bg-[#B0F90C] px-[10px] py-1 text-[11px] font-extrabold text-[#0B0B0B]">ΗΜΕΡΑ {dayIndex + 1} / {totalDays}</span><span className="rounded-full bg-white/15 px-[10px] py-1 text-[11px] font-bold text-white">ΠΡΟΠΟΝΗΣΗ</span></div><h1 className="max-w-[290px] text-[24px] font-extrabold leading-[1.15] tracking-[-.4px] text-white">{getDayTitle(day, dayIndex)}</h1></div>
    </section>
    <main className="flex flex-col gap-[14px] px-[14px] pb-[170px] pt-4 sm:px-6 sm:pt-6">
      <div className="grid grid-cols-3 gap-2"><div className="flex flex-col items-center gap-0.5 rounded-[14px] border border-[#E6E6E2] bg-white px-2 py-3"><span className="text-[20px] font-extrabold text-[#0B0B0B]">{day.exercises.length}</span><span className="text-[11px] text-[#6A6A6A]">ασκήσεις</span></div><div className="flex flex-col items-center gap-0.5 rounded-[14px] border border-[#E6E6E2] bg-white px-2 py-3"><span className="text-[20px] font-extrabold text-[#0B0B0B]">{totalSets}</span><span className="text-[11px] text-[#6A6A6A]">sets</span></div><div className="flex flex-col items-center gap-0.5 rounded-[14px] border border-[#E6E6E2] bg-white px-2 py-3"><span className="text-[20px] font-extrabold text-[#0B0B0B]">~{estimatedMinutes}′</span><span className="text-[11px] text-[#6A6A6A]">διάρκεια</span></div></div>
      {coachNote && <div className="flex items-center gap-[10px] rounded-[14px] border border-[#E6E6E2] bg-white px-[14px] py-3 text-[12px] text-[#555555]"><span className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full bg-[#0B0B0B] text-[10px] font-extrabold text-[#B0F90C]">CO</span><span><strong className="text-[#0B0B0B]">Ο coach σου:</strong> {coachNote}</span></div>}
      <div className="flex items-baseline justify-between px-0.5 pt-1"><span className="text-[16px] font-extrabold text-[#0B0B0B]">Ασκήσεις</span><span className="text-[12px] text-[#8A8A8A]">{day.exercises.length} συνολικά</span></div>
      {day.exercises.map((exercise, index) => <div key={exercise.id} className="flex items-center gap-3 rounded-[16px] border border-[#E6E6E2] bg-white px-3 py-2.5"><span className="w-[18px] shrink-0 text-center text-[13px] font-extrabold text-[#8A8A8A]">{index + 1}</span>{exercise.image_url ? <img src={resolveMediaUrl(exercise.image_url)} alt="" className="h-12 w-12 shrink-0 rounded-[12px] object-cover" /> : <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[12px] bg-[#ECECE8]"><Dumbbell className="h-5 w-5 text-[#6A6A6A]" /></span>}<div className="min-w-0 flex-1"><p className="truncate text-[14px] font-extrabold text-[#0B0B0B]">{displayName(exercise)}</p><p className="mt-0.5 truncate text-[12px] text-[#6A6A6A]">{baseSetCount(exercise)} × {exercise.reps || "—"} {exercise.muscle_group ? `· ${exercise.muscle_group}` : ""}</p></div><div className="shrink-0 text-right"><p className="text-[13px] font-extrabold text-[#0B0B0B]">—</p><p className="text-[10px] text-[#8A8A8A]">τελευταία</p></div></div>)}
    </main>
    <div className="fixed inset-x-0 bottom-[72px] z-30 bg-[linear-gradient(180deg,rgba(244,244,242,0)_0%,#F4F4F2_34%)] px-4 pb-3 pt-8 sm:absolute sm:bottom-5 sm:left-1/2 sm:w-full sm:max-w-4xl sm:-translate-x-1/2 sm:px-6 lg:fixed lg:bottom-5 lg:left-[calc(248px+50%)] lg:w-[min(100%-248px,1024px)]"><Button onClick={onStart} className="h-[54px] w-full rounded-full bg-[#B0F90C] text-[15px] font-extrabold text-[#0B0B0B] shadow-none hover:bg-[#9ee100]"><Play className="mr-2 h-4 w-4 fill-current" />Ξεκίνα προπόνηση</Button></div>
  </div>
}

function ProgramList({ plan, days, history, nextDayIndex, lastVolumeByDay, totalVolumeKg, error, onOpenDay, onStartDay }: { plan: TrainingPlan; days: TrainingDay[]; history: WorkoutLog[]; nextDayIndex: number; lastVolumeByDay: Record<number, number | null>; totalVolumeKg: number | null; error: string; onOpenDay: (index: number) => void; onStartDay: (index: number) => void }) {
  if (!plan || !days.length) return <div className="mx-auto grid max-w-[1280px] place-items-center py-24 text-center"><Dumbbell className="mb-4 h-12 w-12 text-[#8A8A8A]" /><div><p className="text-[18px] font-extrabold">Δεν έχει οριστεί πρόγραμμα</p><p className="mt-1 text-sm text-[#6A6A6A]">Ο coach σου θα σου στείλει το πρόγραμμά σου σύντομα.</p></div></div>
  const now = new Date()
  const startOfWeek = new Date(now); startOfWeek.setHours(0, 0, 0, 0); startOfWeek.setDate(now.getDate() - ((now.getDay() + 6) % 7))
  const nextWeekStart = new Date(startOfWeek); nextWeekStart.setDate(startOfWeek.getDate() + 7)
  const nextWeekLabel = `Δευ ${nextWeekStart.getDate()}/${nextWeekStart.getMonth() + 1}`
  const thisWeek = history.filter((log) => new Date(log.completed_at) >= startOfWeek && log.training_plan_id === plan.id)
  const completedThisWeek = new Set(thisWeek.map((log) => log.day_number))
  const monthHistory = history.filter((log) => { const date = new Date(log.completed_at); return log.training_plan_id === plan.id && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear() })
  const averageMinutes = monthHistory.length ? Math.round(monthHistory.reduce((sum, log) => sum + log.duration_seconds, 0) / monthHistory.length / 60) : 0
  const planStartedAt = plan.created_at ? new Date(plan.created_at).getTime() : now.getTime()
  const weekNumber = Math.max(1, Math.floor((now.getTime() - planStartedAt) / (7 * 24 * 60 * 60 * 1000)) + 1)
  const recordsThisMonth = (() => {
    const bestByExercise = new Map<string, number>(); let records = 0
    history.slice().sort((a, b) => new Date(a.completed_at).getTime() - new Date(b.completed_at).getTime()).forEach((log) => {
      (log.setLogs || []).forEach((set) => {
        const name = set.exercise_name || ""; const weight = Number(set.weight_kg || 0); const best = bestByExercise.get(name) || 0
        if (name && weight > best) { if (new Date(log.completed_at).getMonth() === now.getMonth() && new Date(log.completed_at).getFullYear() === now.getFullYear() && best > 0) records += 1; bestByExercise.set(name, weight) }
      })
    })
    return records
  })()
  const dayMeta = (item: TrainingDay) => {
    const sets = item.exercises.reduce((sum, exercise) => sum + baseSetCount(exercise), 0)
    const minutes = Math.max(1, Math.round(item.exercises.reduce((sum, exercise) => sum + baseSetCount(exercise) * (1 + (restSeconds(exercise) || 90) / 60), 0)))
    return { sets, minutes, cover: item.exercises[0] }
  }
  return <div className="mx-auto max-w-[1280px] space-y-5 font-[family-name:var(--font-commissioner)] text-[#0B0B0B]">
    {error && <Alert variant="destructive"><AlertTitle>Σφάλμα</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
    <header className="flex flex-col gap-3 px-1 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="text-[26px] font-extrabold tracking-[-.5px] sm:text-[28px]">Το πρόγραμμά μου</h1><p className="mt-1 text-[13px] text-[#6A6A6A]">Από τον coach σου · {days.length} ημέρες / εβδομάδα{totalVolumeKg ? ` · ${totalVolumeKg.toLocaleString("el-GR")} kg συνολικά` : ""}</p></div><span className="flex h-[34px] w-fit items-center gap-2 rounded-full bg-[#0B0B0B] px-[14px] text-[13px] font-bold text-white"><i className="h-2 w-2 rounded-full bg-[#B0F90C]" />Εβδομάδα {weekNumber}</span></header>
    <div className="grid gap-5 lg:grid-cols-3"><section className="space-y-[14px] lg:col-span-2"><div className="flex flex-col gap-3 rounded-[18px] border border-[#E6E6E2] bg-white p-4 sm:flex-row sm:items-center sm:gap-6 sm:rounded-[20px] sm:px-[22px] sm:py-[18px]"><div className="shrink-0"><p className="text-[12px] font-bold uppercase tracking-[1px] text-[#6A6A6A]">Αυτή την εβδομάδα</p><p className="mt-[2px] text-[15px] font-extrabold">{completedThisWeek.size} από {days.length} προπονήσεις</p></div><div className="flex flex-1 gap-[6px]">{days.map((_, index) => <i key={index} className={`h-2 flex-1 rounded-[4px] ${completedThisWeek.has(index + 1) ? "bg-[#B0F90C]" : index === nextDayIndex ? "bg-[#0B0B0B]" : "bg-[#ECECEA]"}`} />)}</div><span className="shrink-0 text-[12px] text-[#6A6A6A]">Νέα εβδομάδα: {nextWeekLabel}</span></div>
      {days.map((item, index) => { const meta = dayMeta(item); const isNext = index === nextDayIndex; const last = history.find((log) => log.training_plan_id === plan.id && log.day_number === index + 1); return <article key={item.id} className={`relative overflow-hidden rounded-[18px] border p-4 sm:p-[18px] ${isNext ? "border-[#0B0B0B] bg-[#0B0B0B] text-white" : "border-[#E6E6E2] bg-white"}`}><span className={isNext ? "absolute right-[22px] top-[-20px] h-[62px] w-3 -skew-x-[18deg] bg-[#B0F90C] opacity-90 sm:right-[220px] sm:h-[180px]" : "hidden"} /><div className="relative flex flex-wrap items-center gap-3 sm:flex-nowrap sm:gap-[18px]"><div className="flex w-9 shrink-0 flex-col items-center sm:w-[54px]"><span className={`text-[9px] font-extrabold tracking-[1px] ${isNext ? "text-[#9A9A9A]" : "text-[#8A8A8A]"}`}>ΗΜΕΡΑ</span><span className={`text-[26px] font-extrabold italic leading-none sm:text-[30px] ${isNext ? "text-[#B0F90C]" : "text-[#0B0B0B]"}`}>{index + 1}</span></div>{meta.cover?.image_url ? <img src={resolveMediaUrl(meta.cover.image_url)} alt="" className="h-14 w-14 shrink-0 rounded-[12px] object-cover sm:h-[88px] sm:w-[88px] sm:rounded-[14px]" /> : <span className={`grid h-14 w-14 shrink-0 place-items-center rounded-[12px] sm:h-[88px] sm:w-[88px] ${isNext ? "bg-[#1F1F1F]" : "bg-[#F2F2F0]"}`}><Dumbbell className={isNext ? "h-5 w-5 text-[#B0F90C]" : "h-5 w-5 text-[#8A8A8A]"} /></span>}<div className="min-w-0 flex-1"><span className={`mb-1 inline-flex rounded-full px-2 py-[3px] text-[10px] font-extrabold tracking-[1px] ${isNext ? "bg-[#B0F90C] text-[#0B0B0B]" : "hidden"}`}>ΕΠΟΜΕΝΗ</span><h2 className={`truncate text-[15px] font-extrabold leading-[1.2] sm:text-[18px] ${isNext ? "text-white" : "text-[#0B0B0B]"}`}>{getDayTitle(item, index)}</h2><div className={`mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] ${isNext ? "text-white" : "text-[#6A6A6A]"}`}><span>{item.exercises.length} ασκήσεις</span><span>{meta.sets} sets</span><span>~{meta.minutes}′</span></div>{!isNext && <p className="mt-2 text-[11px] font-semibold text-[#8A8A8A]">{last ? `Τελευταία: ${dateFormat.format(new Date(last.completed_at))}` : index ? `Μετά την Ημέρα ${index}` : "Ξεκίνησε εδώ"}</p>}</div>{isNext ? <Button onClick={() => onOpenDay(index)} className="relative h-12 w-full basis-full rounded-full bg-[#B0F90C] text-[15px] font-extrabold text-[#0B0B0B] hover:bg-[#B0F90C]/85 sm:h-[46px] sm:w-auto sm:basis-auto sm:px-[22px]"><Play className="mr-2 h-[13px] w-[13px] fill-current" />Δες προπόνηση</Button> : <button type="button" onClick={() => onOpenDay(index)} aria-label={`Άνοιγμα ${getDayTitle(item, index)}`} className="ml-auto shrink-0 text-[#9A9A9A]"><ChevronRight className="h-[18px] w-[18px]" /></button>}</div></article> })}</section>
      <aside className="space-y-5"><section className="rounded-[18px] bg-[#B0F90C] p-[18px] sm:p-[22px]"><p className="text-[11px] font-bold uppercase tracking-[1px]">{now.toLocaleDateString("el-GR", { month: "long" })}</p><div className="mt-3 grid grid-cols-3 gap-2"><Stat value={String(monthHistory.length)} label="προπονήσεις" /><Stat value={averageMinutes ? `${averageMinutes}′` : "—"} label="μέση διάρκεια" /><Stat value={String(recordsThisMonth)} label="νέα ρεκόρ" /></div></section><section className="rounded-[18px] border border-[#E6E6E2] bg-white px-4 pb-2 pt-4 sm:px-[22px] sm:pt-5"><div className="flex items-center justify-between"><h2 className="text-[16px] font-extrabold">Ιστορικό</h2><a href="/client-progress" className="text-[12px] font-bold">Όλο →</a></div>{history.length ? <div className="mt-2">{history.slice(0, 5).map((log) => <div key={log.id} className="flex items-center gap-3 border-b border-[#F0F0EE] py-3 last:border-0"><span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[10px] bg-[#0B0B0B] text-[11px] font-extrabold text-[#B0F90C]">Η{log.day_number}</span><span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-bold">{log.day_name || "Προπόνηση"}</span><span className="mt-0.5 block text-[11px] text-[#8A8A8A]">{dateFormat.format(new Date(log.completed_at))} · {Math.max(1, Math.round(log.duration_seconds / 60))}′{log.total_volume_kg ? ` · ${log.total_volume_kg} kg` : ""}</span></span></div>)}</div> : <p className="py-8 text-center text-[12px] text-[#8A8A8A]">Η πρώτη σου προπόνηση θα εμφανιστεί εδώ.</p>}</section></aside></div>
  </div>
}

function Stat({ value, label }: { value: string; label: string }) { return <div className="min-w-0"><p className="text-[26px] font-extrabold italic leading-none">{value}</p><p className="mt-1 text-[10px] font-semibold leading-[1.15]">{label}</p></div> }

function ExerciseInfoSheet({ exercise, elapsedSeconds, previous, bestWeight, onOpenChange }: { exercise: Exercise | null; elapsedSeconds: number; previous?: { weight: number; reps: number } | null; bestWeight?: number; onOpenChange: (open: boolean) => void }) {
  const [playing, setPlaying] = useState(false)
  const open = Boolean(exercise)

  useEffect(() => { if (!open) setPlaying(false) }, [open])
  if (!exercise) return null

  // Οι οδηγίες έρχονται αυτούσιες από τη Βιβλιοθήκη Ασκήσεων. Υποστηρίζουμε
  // και πραγματικά line breaks και παλιές εγγραφές που έχουν αποθηκευμένο "\\n".
  const instructions = (exercise.instructions || "Δεν έχουν προστεθεί οδηγίες εκτέλεσης για αυτή την άσκηση.").split(/(?:\\n|\n)+/).map((instruction) => instruction.trim()).filter(Boolean)
  const labels = [exercise.muscle_group, exercise.equipment].filter(Boolean) as string[]
  const best = bestWeight ? `${bestWeight} kg` : "—"
  const last = previous ? `${previous.weight} kg × ${previous.reps}` : "—"
  const duration = `${String(Math.floor(elapsedSeconds / 60)).padStart(2, "0")}:${String(elapsedSeconds % 60).padStart(2, "0")}`

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent showCloseButton={false} className="!inset-x-0 !top-auto !bottom-0 !z-[70] !grid !h-[88dvh] !w-full !max-w-none !translate-x-0 !translate-y-0 gap-[14px] overflow-y-auto rounded-t-[26px] rounded-b-none border-0 bg-[#F4F4F2] p-[10px_16px_24px] text-[#0B0B0B] shadow-[0_-20px_50px_rgba(0,0,0,.25)] sm:!h-auto sm:!max-w-[620px] sm:!rounded-[26px]">
      <div className="flex flex-col items-center gap-[10px]"><span className="h-[5px] w-11 rounded-full bg-[#DCDCD8]" /><span className="flex h-[26px] items-center gap-1.5 rounded-full bg-[#0B0B0B] px-2.5 text-[11px] font-bold text-white"><span className="h-[7px] w-[7px] rounded-full bg-[#B0F90C]" />Προπόνηση σε εξέλιξη · {duration}</span></div>
      <div className="relative aspect-video min-h-[200px] overflow-hidden rounded-[18px] bg-[#1F1F1F]">
        {playing && exercise.video_url ? <video src={exercise.video_url} controls autoPlay playsInline className="h-full w-full object-cover" /> : <><img src={exercise.image_url ? resolveMediaUrl(exercise.image_url) : "/placeholder.svg"} alt="" className="h-full w-full object-cover opacity-80" /><span className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/70" />{exercise.video_url && <button type="button" onClick={() => setPlaying(true)} aria-label="Αναπαραγωγή βίντεο" className="absolute left-1/2 top-1/2 grid h-16 w-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-[#B0F90C] text-[#0B0B0B] shadow-[0_8px_24px_rgba(0,0,0,.35)]"><Play className="ml-1 h-6 w-6 fill-current" /></button>}<div className="absolute inset-x-[14px] bottom-3 flex items-center gap-2.5 text-[11px] font-bold text-white"><span>0:00</span><span className="h-1 flex-1 overflow-hidden rounded-full bg-white/30"><span className="block h-full w-0 bg-[#B0F90C]" /></span><span>—</span></div></>}
      </div>
      <div className="flex flex-col gap-2"><DialogTitle className="text-[22px] font-extrabold leading-[1.15] tracking-[-.3px] text-[#0B0B0B]">{displayName(exercise)}</DialogTitle><div className="flex flex-wrap gap-1.5">{labels.map((label, index) => <span key={`${label}-${index}`} className={`rounded-full px-2.5 py-[5px] text-[12px] font-bold ${index === 0 ? "bg-[#B0F90C] text-[#0B0B0B]" : "bg-[#F2F2F0] text-[#333333]"}`}>{label}</span>)}</div></div>
      <section className="flex flex-col gap-2.5"><p className="text-[12px] font-extrabold uppercase tracking-[1px] text-[#6A6A6A]">Εκτέλεση</p>{instructions.map((instruction, index) => <div key={`${instruction}-${index}`} className="flex items-start gap-3"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#0B0B0B] text-[12px] font-extrabold text-[#B0F90C]">{index + 1}</span><p className="pt-0.5 text-[13px] leading-[1.45] text-[#333333]">{instruction}</p></div>)}</section>
      {exercise.notes && <div className="flex gap-2.5 rounded-[14px] bg-[#F1FBD6] p-3 text-[12px] leading-[1.45] text-[#333333]"><span className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full bg-[#0B0B0B] text-[10px] font-extrabold text-[#B0F90C]">ΠΣ</span><p><strong>Σημείωση coach:</strong> {exercise.notes}</p></div>}
      <div className="grid grid-cols-2 gap-2"><div className="flex flex-col rounded-[14px] border border-[#E6E6E2] bg-white p-3"><span className="text-[11px] text-[#6A6A6A]">Καλύτερο σετ</span><strong className="text-[17px] font-extrabold">{best}</strong><span className="text-[11px] text-[#8A8A8A]">ιστορικό άσκησης</span></div><div className="flex flex-col rounded-[14px] border border-[#E6E6E2] bg-white p-3"><span className="text-[11px] text-[#6A6A6A]">Τελευταία φορά</span><strong className="text-[17px] font-extrabold">{last}</strong><span className="text-[11px] text-[#8A8A8A]">προηγούμενη προπόνηση</span></div></div>
      <Button type="button" onClick={() => onOpenChange(false)} className="mt-auto h-[52px] rounded-full bg-[#0B0B0B] text-[15px] font-extrabold text-white hover:bg-[#1F1F1F]">Πίσω στην προπόνηση</Button>
    </DialogContent>
  </Dialog>
}

function SettingSwitch({ label, checked, onCheckedChange }: { label: string; checked: boolean; onCheckedChange: (value: boolean) => void }) {
  return <div className="flex items-center justify-between gap-4"><span className="text-sm font-medium">{label}</span><Switch checked={checked} onCheckedChange={onCheckedChange} /></div>
}

function ManualClockTitle({ status }: { status: ManualClockStatus }) {
  const [stopwatchDisplay, setStopwatchDisplay] = useState(status.display)

  useEffect(() => {
    setStopwatchDisplay(status.display)
    if (!status.running || status.mode !== "stopwatch") return
    const startedAt = status.startedAt || Date.now()
    const baseCentiseconds = Number(status.display.split(":").reduce((total, value, index) => total + Number(value || 0) * (index === 0 ? 6000 : index === 1 ? 100 : 1), 0))
    const update = () => {
      const centiseconds = baseCentiseconds + Math.floor((Date.now() - startedAt) / 10)
      const totalSeconds = Math.floor(centiseconds / 100)
      setStopwatchDisplay(`${String(Math.floor(totalSeconds / 60)).padStart(2, "0")}:${String(totalSeconds % 60).padStart(2, "0")}:${String(centiseconds % 100).padStart(2, "0")}`)
    }
    update()
    const interval = window.setInterval(update, 10)
    return () => window.clearInterval(interval)
  }, [status.display, status.mode, status.running, status.startedAt])

  return <p className="font-medium sm:hidden">{status.running ? `${status.mode === "timer" ? "Timer" : "Stopwatch"} ${status.mode === "stopwatch" ? stopwatchDisplay : status.display}` : "Προπόνηση"}</p>
}

export default function ClientProgramPage() {
  return <ProtectedRoute allow="client-active"><ClientProgramContent /></ProtectedRoute>
}
