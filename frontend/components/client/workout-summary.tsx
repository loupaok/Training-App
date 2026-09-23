"use client"

import { Check, Clock3, Dumbbell, Layers3, Save } from "lucide-react"
import type { ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"

function duration(seconds: number) { return `${Math.floor(seconds / 60)} λεπτά` }

export function WorkoutSummary({ durationSeconds, completedSets, totalSets, volumeKg, exerciseCount, notes, onNotesChange, onSave, saving }: {
  durationSeconds: number
  completedSets: number
  totalSets: number
  volumeKg: number
  exerciseCount: number
  notes: string
  onNotesChange: (value: string) => void
  onSave: () => void
  saving: boolean
}) {
  return <div className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-background p-4"><Card className="w-full max-w-2xl"><CardHeader className="text-center"><div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-green-500/10"><Dumbbell className="h-8 w-8 text-green-600" /></div><CardTitle className="mt-4 text-3xl">Προπόνηση ολοκληρώθηκε!</CardTitle></CardHeader><CardContent className="space-y-6"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Stat icon={<Clock3 />} label="Διάρκεια" value={duration(durationSeconds)} /><Stat icon={<Layers3 />} label="Σετ" value={`${completedSets}/${totalSets}`} /><Stat icon={<Dumbbell />} label="Όγκος" value={`${volumeKg.toLocaleString("el-GR")} kg`} /><Stat icon={<Check />} label="Ασκήσεις" value={`${exerciseCount}/${exerciseCount}`} /></div><Textarea value={notes} onChange={(event) => onNotesChange(event.target.value)} placeholder="Προσθήκη σημειώσεων..." /><Button className="w-full" size="lg" onClick={onSave} disabled={saving}><Save className="mr-2 h-4 w-4" />{saving ? "Αποθήκευση..." : "Αποθήκευση & Έξοδος"}</Button></CardContent></Card></div>
}

function Stat({ icon, label, value }: { icon: ReactNode; label: string; value: string }) { return <div className="rounded-md border p-3"><div className="flex items-center gap-2 text-muted-foreground">{icon}<span className="text-xs">{label}</span></div><p className="mt-2 font-semibold">{value}</p></div> }
