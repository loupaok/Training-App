"use client"

import { useEffect, useRef, useState } from "react"
import { Pause, Play, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

const formatSeconds = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`

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
    completionScheduled.current = true; setFinished(true)
    const timeout = window.setTimeout(onComplete, 900)
    return () => window.clearTimeout(timeout)
  }, [seconds, totalSeconds, onComplete])

  const radius = 80
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference * (1 - (totalSeconds ? seconds / totalSeconds : 0))
  return <Card className="fixed bottom-4 right-4 z-[60] w-[min(calc(100vw-2rem),22rem)] shadow-xl"><CardContent className="space-y-5 p-5">
    <div className="flex items-center justify-between"><div><p className="text-sm font-medium">{exerciseName || "Ξεκούραση"}</p><p className="text-xs text-muted-foreground">Χρόνος ξεκούρασης</p></div><Button size="icon" variant="ghost" onClick={onComplete} aria-label="Κλείσιμο"><X className="h-4 w-4" /></Button></div>
    {finished ? <p className="py-12 text-center text-xl font-semibold">Πάμε! 💪</p> : <div className="relative mx-auto h-48 w-48"><svg viewBox="0 0 200 200" className="h-full w-full"><circle cx="100" cy="100" r={radius} fill="none" stroke="currentColor" strokeWidth="8" className="text-muted" /><circle cx="100" cy="100" r={radius} fill="none" stroke="currentColor" strokeWidth="8" strokeDasharray={circumference} strokeDashoffset={dashOffset} strokeLinecap="round" className={seconds < 10 ? "animate-pulse text-destructive" : "text-primary"} transform="rotate(-90 100 100)" /></svg><p className={`absolute inset-0 grid place-items-center font-mono text-4xl font-semibold tabular-nums ${seconds < 10 ? "text-destructive" : ""}`}>{formatSeconds(seconds)}</p></div>}
    {nextSet && <div className="rounded-md bg-muted/50 p-3 text-center"><p className="text-xs text-muted-foreground">Επόμενο σετ</p><p className="mt-1 text-sm font-medium">{nextSet}</p></div>}
    <div className="grid grid-cols-2 gap-2"><Button variant="outline" onClick={() => onChange(Math.max(0, seconds - 15))}>-15s</Button><Button variant="outline" onClick={() => onChange(seconds + 15)}>+15s</Button><Button className="col-span-2" onClick={() => setPaused((value) => !value)}>{paused ? <Play className="mr-2 h-4 w-4" /> : <Pause className="mr-2 h-4 w-4" />}{paused ? "Συνέχεια" : "Παύση"}</Button><Button className="col-span-2" variant="outline" onClick={onComplete}>Παράλειψη χρονομέτρου</Button></div>
  </CardContent></Card>
}
