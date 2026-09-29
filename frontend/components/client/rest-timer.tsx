"use client"

import { useEffect, useRef, useState } from "react"
import { Pause, Play, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

const formatSeconds = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`
const formatStopwatch = (centiseconds: number) => {
  const totalSeconds = Math.floor(centiseconds / 100)
  return `${String(Math.floor(totalSeconds / 60)).padStart(2, "0")}:${String(totalSeconds % 60).padStart(2, "0")}:${String(centiseconds % 100).padStart(2, "0")}`
}

export type ManualClockStatus = {
  mode: "timer" | "stopwatch" | null
  display: string
  running: boolean
  startedAt?: number
}

export function RestTimer({ seconds, totalSeconds, exerciseName, nextSet, onChange, onComplete }: {
  seconds: number
  totalSeconds: number
  exerciseName?: string
  nextSet?: string
  onChange: (seconds: number) => void
  onComplete: () => void
}) {
  const [paused, setPaused] = useState(false)
  const [finished, setFinished] = useState(false)
  const completionScheduled = useRef(false)

  useEffect(() => {
    if (seconds <= 0 || paused) return
    const timer = window.setInterval(() => onChange(Math.max(0, seconds - 1)), 1000)
    return () => window.clearInterval(timer)
  }, [seconds, paused, onChange])

  useEffect(() => {
    if (totalSeconds <= 0 || seconds !== 0 || completionScheduled.current) return
    completionScheduled.current = true
    setFinished(true)
    const timeout = window.setTimeout(onComplete, 900)
    return () => window.clearTimeout(timeout)
  }, [seconds, totalSeconds, onComplete])

  const radius = 80
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference * (1 - (totalSeconds ? seconds / totalSeconds : 0))
  const urgent = seconds < 10

  return <>
    <div className="fixed inset-x-2 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-[60] lg:hidden">
      <div className="overflow-hidden rounded-xl border border-border bg-background/95 shadow-xl backdrop-blur">
        <div className="h-0.5 bg-muted"><div className="h-full bg-primary transition-[width]" style={{ width: `${totalSeconds ? (seconds / totalSeconds) * 100 : 0}%` }} /></div>
        {finished ? <p className="py-4 text-center text-lg font-semibold">Πάμε!</p> : <div className="grid grid-cols-[4.5rem_minmax(0,1fr)_4.5rem_4.5rem] items-center gap-1 p-2">
          <Button size="sm" variant="secondary" className="h-11 rounded-lg font-semibold" onClick={() => onChange(Math.max(0, seconds - 15))}>-15</Button>
          <div className="min-w-0 text-center"><p className="truncate text-[11px] font-medium text-muted-foreground">{exerciseName || "Ξεκούραση"}</p><p className={`font-mono text-3xl font-semibold tabular-nums ${urgent ? "animate-pulse text-destructive" : "text-foreground"}`}>{formatSeconds(seconds)}</p></div>
          <Button size="sm" variant="secondary" className="h-11 rounded-lg font-semibold" onClick={() => onChange(seconds + 15)}>+15</Button>
          <Button size="sm" className="h-11 rounded-lg px-2 font-semibold" onClick={onComplete}>Skip</Button>
        </div>}
      </div>
    </div>

    <Card className="fixed bottom-4 right-4 z-[60] hidden w-[min(calc(100vw-2rem),22rem)] shadow-xl lg:block">
      <CardContent className="space-y-5 p-5">
        <div className="flex items-center justify-between"><div><p className="text-sm font-medium">{exerciseName || "Ξεκούραση"}</p><p className="text-xs text-muted-foreground">Χρόνος ξεκούρασης</p></div><Button size="icon" variant="ghost" onClick={onComplete} aria-label="Κλείσιμο"><X className="h-4 w-4" /></Button></div>
        {finished ? <p className="py-12 text-center text-xl font-semibold">Πάμε!</p> : <div className="relative mx-auto h-48 w-48"><svg viewBox="0 0 200 200" className="h-full w-full"><circle cx="100" cy="100" r={radius} fill="none" stroke="currentColor" strokeWidth="8" className="text-muted" /><circle cx="100" cy="100" r={radius} fill="none" stroke="currentColor" strokeWidth="8" strokeDasharray={circumference} strokeDashoffset={dashOffset} strokeLinecap="round" className={urgent ? "animate-pulse text-destructive" : "text-primary"} transform="rotate(-90 100 100)" /></svg><p className={`absolute inset-0 grid place-items-center font-mono text-4xl font-semibold tabular-nums ${urgent ? "text-destructive" : ""}`}>{formatSeconds(seconds)}</p></div>}
        {nextSet && <div className="rounded-md bg-muted/50 p-3 text-center"><p className="text-xs text-muted-foreground">Επόμενο σετ</p><p className="mt-1 text-sm font-medium">{nextSet}</p></div>}
        <div className="grid grid-cols-2 gap-2"><Button variant="outline" onClick={() => onChange(Math.max(0, seconds - 15))}>-15s</Button><Button variant="outline" onClick={() => onChange(seconds + 15)}>+15s</Button><Button className="col-span-2" onClick={() => setPaused((value) => !value)}>{paused ? <Play className="mr-2 h-4 w-4" /> : <Pause className="mr-2 h-4 w-4" />}{paused ? "Συνέχεια" : "Παύση"}</Button><Button className="col-span-2" variant="outline" onClick={onComplete}>Παράλειψη χρονομέτρου</Button></div>
      </CardContent>
    </Card>
  </>
}

export function ManualWorkoutClock({ open, onOpenChange, defaultSeconds = 90, onStatusChange }: { open: boolean; onOpenChange: (open: boolean) => void; defaultSeconds?: number; onStatusChange?: (status: ManualClockStatus) => void }) {
  const [timerLeft, setTimerLeft] = useState(defaultSeconds)
  const [timerRunning, setTimerRunning] = useState(false)
  const [stopwatchCentiseconds, setStopwatchCentiseconds] = useState(0)
  const [stopwatchRunning, setStopwatchRunning] = useState(false)

  useEffect(() => {
    if (!open) return
    if (!timerRunning && timerLeft === 0) setTimerLeft(defaultSeconds)
  }, [defaultSeconds, open, timerLeft, timerRunning])

  useEffect(() => {
    if (!timerRunning || timerLeft <= 0) return
    const interval = window.setInterval(() => setTimerLeft((value) => Math.max(0, value - 1)), 1000)
    return () => window.clearInterval(interval)
  }, [timerLeft, timerRunning])

  useEffect(() => {
    if (timerLeft === 0 && timerRunning) setTimerRunning(false)
  }, [timerLeft, timerRunning])

  useEffect(() => {
    if (!stopwatchRunning) return
    const interval = window.setInterval(() => setStopwatchCentiseconds((value) => value + 1), 10)
    return () => window.clearInterval(interval)
  }, [stopwatchRunning])

  useEffect(() => {
    if (timerRunning) {
      onStatusChange?.({ mode: "timer", display: formatSeconds(timerLeft), running: true })
      return
    }
    if (stopwatchRunning) {
      onStatusChange?.({ mode: "stopwatch", display: formatStopwatch(stopwatchCentiseconds), running: true, startedAt: Date.now() })
      return
    }
    onStatusChange?.({ mode: null, display: "", running: false })
  }, [onStatusChange, stopwatchRunning, timerLeft, timerRunning, Math.floor(stopwatchCentiseconds / 100)])

  const timerRadius = 88
  const timerCircumference = 2 * Math.PI * timerRadius
  const timerProgress = Math.min(1, timerLeft / Math.max(1, defaultSeconds))

  return <Sheet open={open} onOpenChange={onOpenChange}>
    <SheetContent side="bottom" className="max-h-[82dvh] rounded-t-2xl p-0 sm:mx-auto sm:max-w-md">
      <SheetHeader className="border-b px-4 pb-3 pt-4 text-left"><SheetTitle>Clock</SheetTitle><SheetDescription className="sr-only">Χειροκίνητος χρονομετρητής για την προπόνηση.</SheetDescription></SheetHeader>
      <Tabs defaultValue="timer" className="p-4">
        <TabsList className="grid h-10 w-full grid-cols-2"><TabsTrigger value="timer">Timer</TabsTrigger><TabsTrigger value="stopwatch">Stopwatch</TabsTrigger></TabsList>
        <TabsContent value="timer" className="space-y-3 pt-4">
          <div className="relative mx-auto h-44 w-44"><svg viewBox="0 0 200 200" className="h-full w-full"><circle cx="100" cy="100" r={timerRadius} fill="none" stroke="currentColor" strokeWidth="7" className="text-muted" /><circle cx="100" cy="100" r={timerRadius} fill="none" stroke="currentColor" strokeWidth="7" strokeDasharray={timerCircumference} strokeDashoffset={timerCircumference * (1 - timerProgress)} strokeLinecap="round" className="text-primary transition-[stroke-dashoffset] duration-300" transform="rotate(-90 100 100)" /></svg><div className="absolute inset-0 grid place-items-center"><span className="font-mono text-3xl font-semibold tabular-nums">{formatSeconds(timerLeft)}</span></div></div>
          <div className="grid grid-cols-2 gap-2"><Button variant="ghost" className="h-9 text-sm font-semibold" onClick={() => setTimerLeft((value) => Math.max(0, value - 15))}>-15s</Button><Button variant="ghost" className="h-9 text-sm font-semibold" onClick={() => setTimerLeft((value) => value + 15)}>+15s</Button></div>
          <Button className="h-10 w-full" variant={timerRunning ? "secondary" : "default"} onClick={() => { if (timerRunning) { setTimerRunning(false); onOpenChange(false); return } setStopwatchRunning(false); setTimerRunning(true) }}>{timerRunning ? "Ακύρωση" : "ΕΚΚΙΝΗΣΗ"}</Button>
        </TabsContent>
        <TabsContent value="stopwatch" className="space-y-6 pt-6"><p className="py-6 text-center font-mono text-5xl font-semibold tabular-nums">{formatStopwatch(stopwatchCentiseconds)}</p><div className="grid grid-cols-2 gap-3"><Button className="h-12" onClick={() => { setTimerRunning(false); setStopwatchRunning((value) => !value) }}>{stopwatchRunning ? <Pause className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}{stopwatchRunning ? "Παύση" : "Έναρξη"}</Button><Button className="h-12" variant="outline" onClick={() => { setStopwatchCentiseconds(0); setStopwatchRunning(false) }}>Μηδενισμός</Button></div></TabsContent>
      </Tabs>
    </SheetContent>
  </Sheet>
}
