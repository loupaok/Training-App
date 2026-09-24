"use client"

import { Check, Clock3, Dumbbell, Layers3, Save } from "lucide-react"
import type { ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"

export type WorkoutFeeling = "easy" | "good" | "hard" | "pr" | null

const feelings: Array<{ value: Exclude<WorkoutFeeling, null>; emoji: string; label: string }> = [
  { value: "easy", emoji: "😊", label: "Εύκολο" },
  { value: "good", emoji: "😄", label: "Καλά" },
  { value: "hard", emoji: "😤", label: "Δύσκολο" },
  { value: "pr", emoji: "🏆", label: "PR" },
]

function duration(seconds: number) {
  return `${Math.floor(seconds / 60)} λεπτά`
}

export function WorkoutSummary({ durationSeconds, completedSets, totalSets, volumeKg, exerciseCount, notes, feeling, onNotesChange, onFeelingChange, onSave, saving }: {
  durationSeconds: number
  completedSets: number
  totalSets: number
  volumeKg: number
  exerciseCount: number
  notes: string
  feeling: WorkoutFeeling
  onNotesChange: (value: string) => void
  onFeelingChange: (value: WorkoutFeeling) => void
  onSave: () => void
  saving: boolean
}) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-background p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center"><div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-green-500/10"><Dumbbell className="h-8 w-8 text-green-600" /></div><CardTitle className="mt-4 text-3xl">Προπόνηση ολοκληρώθηκε!</CardTitle></CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Stat icon={<Clock3 />} label="Διάρκεια" value={duration(durationSeconds)} /><Stat icon={<Layers3 />} label="Σετ" value={`${completedSets}/${totalSets}`} /><Stat icon={<Dumbbell />} label="Κιλά" value={`${volumeKg.toLocaleString("el-GR")} kg`} /><Stat icon={<Check />} label="Ασκήσεις" value={`${exerciseCount}/${exerciseCount}`} /></div>
          <div><p className="mb-3 text-sm font-medium">Πώς ήταν η προπόνηση;</p><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{feelings.map((option) => <Button key={option.value} type="button" variant={feeling === option.value ? "default" : "outline"} className="h-auto flex-col gap-1 py-3" onClick={() => onFeelingChange(option.value)}><span className="text-xl">{option.emoji}</span><span className="text-xs">{option.label}</span></Button>)}</div></div>
          <Textarea value={notes} onChange={(event) => onNotesChange(event.target.value)} placeholder="Προσθήκη σημειώσεων..." />
          <Button className="w-full" size="lg" onClick={onSave} disabled={saving}><Save className="mr-2 h-4 w-4" />{saving ? "Αποθήκευση..." : "Αποθήκευση & Έξοδος"}</Button>
        </CardContent>
      </Card>
    </div>
  )
}

function Stat({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return <div className="rounded-md border p-3"><div className="flex items-center gap-2 text-muted-foreground">{icon}<span className="text-xs">{label}</span></div><p className="mt-2 font-semibold">{value}</p></div>
}
