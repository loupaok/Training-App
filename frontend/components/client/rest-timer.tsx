"use client"

import { useEffect } from "react"
import { Clock3 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"

function formatSeconds(seconds: number) {
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`
}

export function RestTimer({ seconds, totalSeconds, onChange, onComplete }: {
  seconds: number
  totalSeconds: number
  onChange: (seconds: number) => void
  onComplete: () => void
}) {
  useEffect(() => {
    if (seconds <= 0) return
    const timer = window.setInterval(() => onChange(Math.max(0, seconds - 1)), 1000)
    return () => window.clearInterval(timer)
  }, [seconds, onChange])

  useEffect(() => {
    if (totalSeconds > 0 && seconds === 0) onComplete()
  }, [seconds, totalSeconds, onComplete])

  const progress = totalSeconds ? (seconds / totalSeconds) * 100 : 0
  const progressClass = progress > 60 ? "[&>div]:bg-green-500" : progress > 25 ? "[&>div]:bg-amber-500" : "[&>div]:bg-destructive"

  return (
    <Card className="fixed bottom-4 right-4 z-[60] w-[min(calc(100vw-2rem),22rem)] shadow-xl">
      <CardContent className="space-y-4 p-4">
        <div className="flex items-center justify-between"><span className="flex items-center gap-2 font-semibold"><Clock3 className="h-5 w-5 text-primary" />Ξεκούραση</span><span className="text-2xl font-bold tabular-nums">{formatSeconds(seconds)}</span></div>
        <Progress value={progress} className={progressClass} />
        <div className="flex gap-2"><Button type="button" variant="outline" size="sm" onClick={() => onChange(Math.max(0, seconds - 30))}>- 30&quot;</Button><Button type="button" variant="outline" size="sm" onClick={() => onChange(seconds + 30)}>+ 30&quot;</Button><Button type="button" className="ml-auto" size="sm" onClick={onComplete}>Παράλειψη</Button></div>
      </CardContent>
    </Card>
  )
}
