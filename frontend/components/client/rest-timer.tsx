"use client"

import { useEffect, useRef, useState } from "react"
import { Clock3 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"

function formatSeconds(seconds: number) {
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`
}

export function RestTimer({ seconds, totalSeconds, exerciseName, onChange, onComplete }: {
  seconds: number
  totalSeconds: number
  exerciseName?: string
  onChange: (seconds: number) => void
  onComplete: () => void
}) {
  const [finished, setFinished] = useState(false)
  const completionScheduled = useRef(false)

  useEffect(() => {
    if (seconds <= 0) return
    const timer = window.setInterval(() => onChange(Math.max(0, seconds - 1)), 1000)
    return () => window.clearInterval(timer)
  }, [seconds, onChange])

  useEffect(() => {
    if (totalSeconds <= 0 || seconds !== 0 || completionScheduled.current) return
    completionScheduled.current = true
    setFinished(true)
    const timeout = window.setTimeout(onComplete, 900)
    return () => window.clearTimeout(timeout)
  }, [seconds, totalSeconds, onComplete])

  const progress = totalSeconds ? (seconds / totalSeconds) * 100 : 0
  const progressClass = progress > 60 ? "[&>div]:bg-green-500" : progress > 25 ? "[&>div]:bg-amber-500" : "[&>div]:bg-destructive"

  return (
    <Card className="fixed bottom-4 right-4 z-[60] w-[min(calc(100vw-2rem),16rem)] shadow-xl">
      <CardContent className="space-y-5 p-5">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground"><Clock3 className="h-4 w-4 text-primary" />{exerciseName || "Ξεκούραση"}</div>
        {finished ? <p className="py-2 text-center text-xl font-semibold">Πάμε! 💪</p> : <p className={`text-center font-mono text-4xl font-semibold tabular-nums ${seconds < 10 ? "animate-pulse text-destructive" : ""}`}>{formatSeconds(seconds)}</p>}
        <Progress value={progress} className={progressClass} />
        <div className="grid grid-cols-3 gap-2"><Button type="button" variant="outline" size="sm" onClick={() => onChange(Math.max(0, seconds - 30))}>-30s</Button><Button type="button" size="sm" onClick={onComplete}>Παράλειψη</Button><Button type="button" variant="outline" size="sm" onClick={() => onChange(seconds + 30)}>+30s</Button></div>
      </CardContent>
    </Card>
  )
}
