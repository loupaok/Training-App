"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Pause, Play, RotateCcw, X } from "lucide-react"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"

const clockStorageKey = "sp-workout-manual-clock"
const timerText = (seconds: number) => String(Math.floor(seconds / 60)).padStart(2, "0") + ":" + String(seconds % 60).padStart(2, "0")
const stopwatchText = (centiseconds: number) => { const seconds = Math.floor(centiseconds / 100); return String(Math.floor(seconds / 60)).padStart(2, "0") + ":" + String(seconds % 60).padStart(2, "0") + ":" + String(centiseconds % 100).padStart(2, "0") }
export type ManualClockStatus = { mode: "timer" | "stopwatch" | null; display: string; running: boolean; startedAt?: number }
type Clock = { mode: "timer" | "stopwatch"; running: boolean; duration: number; startedAt: number; elapsedBeforeStart: number }

function useNow(enabled: boolean, every = 250) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!enabled) return
    const update = () => setNow(Date.now())
    update()
    const id = window.setInterval(update, every)
    document.addEventListener("visibilitychange", update)
    return () => { window.clearInterval(id); document.removeEventListener("visibilitychange", update) }
  }, [enabled, every])
  return now
}

function StopwatchDial({ centiseconds, lapCount }: { centiseconds: number; lapCount: number }) {
  const currentSecond = Math.ceil((centiseconds % 6000) / 100)
  const value = stopwatchText(centiseconds)
  return <div className="relative mx-auto h-[210px] w-[210px]">
    {Array.from({ length: 60 }, (_, index) => <span key={index} className={"absolute left-1/2 top-0 h-[10px] w-[2px] -ml-px origin-[1px_105px] " + (index < currentSecond ? "bg-[#B0F90C]" : "bg-[#333333]")} style={{ transform: "rotate(" + String(index * 6) + "deg)" }} />)}
    <div className="absolute inset-[22px] flex flex-col items-center justify-center rounded-full text-center"><p className="whitespace-nowrap text-[52px] font-extrabold italic leading-none tracking-[-2px]">{value.slice(0, 5)}<span className="text-[26px] text-[#B0F90C]">.{value.slice(-2)}</span></p><p className="mt-[6px] text-[12px] text-[#9A9A9A]">Γύρος {lapCount + 1}</p></div>
  </div>
}

export function RestTimer({ seconds, totalSeconds, exerciseName, onChange, onComplete }: { seconds: number; totalSeconds: number; exerciseName?: string; onChange: (seconds: number) => void; onComplete: () => void }) {
  const started = useRef<number | null>(null); const base = useRef(seconds); const done = useRef(false); const now = useNow(seconds > 0); const [finished, setFinished] = useState(false)
  useEffect(() => { if (started.current === null) { started.current = Date.now(); base.current = seconds } }, [seconds])
  useEffect(() => { if (!started.current || seconds <= 0) return; const next = Math.max(0, base.current - Math.floor((now - started.current) / 1000)); if (next !== seconds) onChange(next) }, [now, onChange, seconds])
  useEffect(() => { if (seconds !== 0 || done.current) return; done.current = true; setFinished(true); navigator.vibrate?.([80, 50, 80]); const id = window.setTimeout(onComplete, 900); return () => window.clearTimeout(id) }, [onComplete, seconds])
  const progress = totalSeconds ? ((totalSeconds - seconds) / totalSeconds) * 100 : 0
  return <div className="fixed inset-x-3 bottom-[calc(98px+env(safe-area-inset-bottom))] z-[70] lg:inset-x-auto lg:bottom-5 lg:right-5 lg:w-[31rem]"><div className="relative overflow-hidden rounded-[22px] bg-[#0B0B0B] px-[14px] py-[14px] pl-[18px] text-white shadow-[0_12px_30px_rgba(11,11,11,.3)]"><span className="absolute left-0 top-0 h-1 bg-[#B0F90C] transition-[width]" style={{ width: String(Math.max(0, progress)) + "%" }} />{finished ? <p className="py-2 text-center text-[22px] font-extrabold italic text-[#B0F90C]">Πάμε!</p> : <div className="flex items-center gap-[10px]"><div className="min-w-0 flex-1"><p className="truncate text-[11px] font-bold text-[#9A9A9A]">Διάλειμμα · {exerciseName || "Ξεκούραση"}</p><p className="font-mono text-[34px] font-extrabold italic leading-none tracking-[-1px] text-[#B0F90C]">{timerText(seconds)}</p></div><button type="button" onClick={() => onChange(Math.max(0, seconds - 15))} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#1F1F1F] text-[13px] font-extrabold">−15</button><button type="button" onClick={() => onChange(seconds + 15)} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#1F1F1F] text-[13px] font-extrabold">+15</button><button type="button" onClick={onComplete} className="flex h-11 shrink-0 items-center rounded-full bg-[#B0F90C] px-[14px] text-[13px] font-extrabold text-[#0B0B0B]">Παράλειψη</button></div>}</div></div>
}

export function ManualWorkoutClock({ open, onOpenChange, defaultSeconds = 90, onStatusChange }: { open: boolean; onOpenChange: (open: boolean) => void; defaultSeconds?: number; onStatusChange?: (status: ManualClockStatus) => void }) {
  const [tab, setTab] = useState<"timer" | "stopwatch">("timer")
  const [clock, setClock] = useState<Clock>({ mode: "timer", running: false, duration: defaultSeconds, startedAt: 0, elapsedBeforeStart: 0 })
  const [laps, setLaps] = useState<number[]>([])
  const now = useNow(clock.running, 30)
  const elapsed = clock.running ? clock.elapsedBeforeStart + Math.max(0, now - clock.startedAt) : clock.elapsedBeforeStart
  const timerLeft = Math.max(0, clock.duration - Math.floor(elapsed / 1000))
  const centiseconds = Math.floor(elapsed / 10)
  const display = clock.mode === "timer" ? timerText(timerLeft) : stopwatchText(centiseconds)
  const ring = tab === "timer" ? timerLeft / Math.max(1, clock.duration) : (centiseconds % 6000) / 6000
  const lapRows = useMemo(() => [...laps].reverse(), [laps])

  useEffect(() => { try { const saved = window.localStorage.getItem(clockStorageKey); if (saved) setClock(JSON.parse(saved) as Clock) } catch { /* safe fallback */ } }, [])
  useEffect(() => { window.localStorage.setItem(clockStorageKey, JSON.stringify(clock)) }, [clock])
  useEffect(() => { if (clock.mode === "timer" && clock.running && timerLeft === 0) setClock((value) => ({ ...value, running: false, elapsedBeforeStart: value.duration * 1000 })) }, [clock.mode, clock.running, timerLeft])
  useEffect(() => { onStatusChange?.(clock.running ? { mode: clock.mode, display, running: true, startedAt: clock.startedAt } : { mode: null, display: "", running: false }) }, [clock.mode, clock.running, clock.startedAt, display, onStatusChange])

  const switchTab = (mode: "timer" | "stopwatch") => { setTab(mode); setClock({ mode, running: false, duration: mode === "timer" ? defaultSeconds : 0, startedAt: 0, elapsedBeforeStart: 0 }); setLaps([]) }
  const setTimer = (seconds: number) => setClock({ mode: "timer", running: false, duration: seconds, startedAt: 0, elapsedBeforeStart: 0 })
  const toggle = () => setClock((value) => value.running ? { ...value, running: false, elapsedBeforeStart: value.elapsedBeforeStart + Date.now() - value.startedAt } : { ...value, running: true, startedAt: Date.now() })
  const reset = () => { setClock({ mode: tab, running: false, duration: tab === "timer" ? defaultSeconds : 0, startedAt: 0, elapsedBeforeStart: 0 }); setLaps([]) }
  const adjustTimer = (delta: number) => setTimer(Math.max(0, timerLeft + delta))
  const addLap = () => setLaps((current) => [...current, Math.max(0, centiseconds - current.reduce((total, lap) => total + lap, 0))])
  const timerWasStarted = timerLeft !== clock.duration && !clock.running
  const ringStyle = { background: "conic-gradient(#B0F90C 0deg " + String(ring * 360) + "deg, #333333 " + String(ring * 360) + "deg 360deg)" }

  return <Sheet open={open} onOpenChange={onOpenChange}>
    <SheetContent side="bottom" showCloseButton={false} className="max-h-[92dvh] overflow-y-auto rounded-t-[26px] border-0 bg-[#0B0B0B] p-[10px_18px_calc(30px+env(safe-area-inset-bottom))] text-white shadow-[0_-20px_50px_rgba(0,0,0,.3)] sm:mx-auto sm:max-w-md">
      <SheetHeader className="gap-4 p-0"><span className="mx-auto block h-[5px] w-11 rounded-[3px] bg-[#333333]" /><div className="flex items-center justify-between"><SheetTitle className="text-[18px] font-extrabold text-white">Ρολόι</SheetTitle><button type="button" onClick={() => onOpenChange(false)} aria-label="Κλείσιμο" className="grid h-9 w-9 place-items-center rounded-full bg-[#1F1F1F]"><X className="h-4 w-4" /></button></div><SheetDescription className="sr-only">Χρονόμετρο προπόνησης</SheetDescription></SheetHeader>
      <div className="mt-4 grid h-12 grid-cols-2 rounded-[14px] bg-[#1A1A1A] p-1"><button type="button" onClick={() => switchTab("timer")} className={"h-10 rounded-[10px] text-[14px] font-extrabold " + (tab === "timer" ? "bg-[#B0F90C] text-[#0B0B0B]" : "text-[#9A9A9A]")}>Αντίστροφη</button><button type="button" onClick={() => switchTab("stopwatch")} className={"h-10 rounded-[10px] text-[14px] font-bold " + (tab === "stopwatch" ? "bg-[#B0F90C] text-[#0B0B0B]" : "text-[#9A9A9A]")}>Χρονόμετρο</button></div>
      {tab === "timer" ? <div className="mt-4">
        <div className="flex items-center justify-center gap-3 py-2"><button type="button" onClick={() => adjustTimer(-15)} className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-[#1F1F1F] text-[15px] font-extrabold">−15</button><div className="grid h-[210px] w-[210px] shrink-0 place-items-center rounded-full" style={ringStyle}><div className="flex h-[190px] w-[190px] flex-col items-center justify-center rounded-full bg-[#0B0B0B]"><p className="whitespace-nowrap text-[58px] font-extrabold italic leading-none tracking-[-2px]">{timerText(timerLeft)}</p><p className="mt-[6px] text-[12px] text-[#9A9A9A]">λεπτά</p></div></div><button type="button" onClick={() => adjustTimer(15)} className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-[#1F1F1F] text-[15px] font-extrabold">+15</button></div>
        <div className="mt-2 grid grid-cols-6 gap-1.5">{[30, 60, 90, 120, 180, 300].map((value) => <button key={value} type="button" onClick={() => setTimer(value)} className={"h-[38px] rounded-full text-[13px] font-extrabold " + (clock.duration === value && timerLeft === value && !clock.running ? "bg-white text-[#0B0B0B]" : "bg-[#1F1F1F] text-white")}>{value < 60 ? String(value) + "″" : String(value / 60) + "′"}</button>)}</div>
        {(timerWasStarted || clock.running) ? <div className="mt-5 grid grid-cols-2 gap-2"><button type="button" onClick={reset} className="h-14 rounded-full bg-[#1F1F1F] text-[15px] font-extrabold">Μηδενισμός</button><button type="button" onClick={toggle} className="h-14 rounded-full bg-[#B0F90C] text-[16px] font-extrabold text-[#0B0B0B]">{clock.running ? "Παύση" : "Συνέχεια"}</button></div> : <button type="button" onClick={toggle} className="mt-5 flex h-14 w-full items-center justify-center gap-2.5 rounded-full bg-[#B0F90C] text-[16px] font-extrabold text-[#0B0B0B]"><Play className="h-3.5 w-3.5 fill-current" />Έναρξη</button>}
      </div> : <div className="mt-4">
        <div className="flex justify-center py-2"><StopwatchDial centiseconds={centiseconds} lapCount={laps.length} /></div>
        <div className="mt-2 max-h-[120px] overflow-y-auto">{lapRows.map((lap, index) => { const fastest = laps.length > 1 && lap === Math.min(...laps); return <div key={String(lap) + "-" + String(index)} className="flex items-center justify-between border-b border-[#1F1F1F] px-0.5 py-2.5 text-[14px]"><span className="font-semibold text-[#9A9A9A]">Γύρος {laps.length - index}</span><span className="flex items-center gap-2 font-extrabold">{fastest && <span className="rounded-full bg-[#B0F90C] px-2 py-0.5 text-[10px] font-extrabold text-[#0B0B0B]">ΤΑΧΥΤΕΡΟΣ</span>}{stopwatchText(lap)}</span></div> })}</div>
        <div className="mt-4 grid grid-cols-2 gap-[10px]"><button type="button" onClick={addLap} disabled={!clock.running} className="h-14 rounded-full bg-[#1F1F1F] text-[15px] font-extrabold disabled:opacity-40">Γύρος</button><button type="button" onClick={toggle} className="flex h-14 items-center justify-center gap-2 rounded-full bg-[#B0F90C] text-[15px] font-extrabold text-[#0B0B0B]">{clock.running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 fill-current" />}{clock.running ? "Παύση" : "Έναρξη"}</button></div>{!clock.running && centiseconds > 0 && <button type="button" onClick={reset} className="mt-2 flex h-10 w-full items-center justify-center gap-2 text-[13px] font-bold text-[#9A9A9A]"><RotateCcw className="h-4 w-4" />Μηδενισμός</button>}
      </div>}
    </SheetContent>
  </Sheet>
}
