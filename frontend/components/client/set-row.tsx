"use client"

import { Check, Trophy } from "lucide-react"
import { Input } from "@/components/ui/input"

const shownWeight = (value: number, unit: "kg" | "lbs") => unit === "lbs" ? Math.round(value * 2.20462 * 10) / 10 : value

export function SetRow({ setNumber, previous, weightKg, repsCompleted, isCompleted, autoFocusKg, weightUnit, isPersonalRecord = false, onWeightChange, onRepsChange, onComplete }: {
  setNumber: number
  previous?: { weight: number; reps: number } | null
  weightKg: number
  repsCompleted: number
  isCompleted: boolean
  autoFocusKg?: boolean
  weightUnit: "kg" | "lbs"
  onWeightChange: (weightKg: number) => void
  onRepsChange: (reps: number) => void
  onComplete: (completed: boolean) => void
  isPersonalRecord?: boolean
}) {
  const copyPrevious = () => { if (!previous) return; onWeightChange(previous.weight); onRepsChange(previous.reps) }
  const field = "h-10 w-full rounded-[10px] border border-input bg-card px-1 text-center text-[14px] font-extrabold tabular-nums text-foreground shadow-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-[var(--sp-lime-glow)] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"

  return <div className={`grid grid-cols-[34px_1fr_64px_64px_36px] items-center gap-2 rounded-[10px] px-2 py-1.5 transition-colors ${isCompleted ? "bg-[var(--sp-lime-soft)]" : "bg-transparent"}`}>
    <span className={`grid h-[30px] w-[30px] place-items-center rounded-[9px] text-[12px] font-extrabold ${isCompleted ? "bg-accent text-accent-foreground" : "bg-muted text-foreground"}`}>{setNumber}</span>
    <div className="min-w-0">
      <button type="button" onClick={copyPrevious} disabled={!previous} className={`block max-w-full truncate text-left font-semibold tabular-nums text-muted-foreground underline-offset-2 enabled:hover:text-foreground enabled:hover:underline disabled:no-underline ${isPersonalRecord ? "text-[11px]" : "text-[12px]"}`}>{previous ? `${shownWeight(previous.weight, weightUnit)} × ${previous.reps}` : "—"}</button>
      {isPersonalRecord && <span className="mt-[3px] flex h-5 w-fit max-w-full items-center gap-1 whitespace-nowrap rounded-full bg-[var(--sp-emphasis)] px-1.5 text-[10px] font-extrabold leading-none text-accent"><Trophy className="h-[11px] w-[11px] shrink-0" />ΝΕΟ ΡΕΚΟΡ</span>}
    </div>
    <Input type="number" inputMode="decimal" min="0" step="0.5" value={shownWeight(weightKg, weightUnit) || ""} autoFocus={autoFocusKg} onChange={(event) => onWeightChange((Number(event.target.value) || 0) / (weightUnit === "lbs" ? 2.20462 : 1))} className={field} aria-label={`Κιλά set ${setNumber}`} />
    <Input type="number" inputMode="numeric" min="0" step="1" value={repsCompleted || ""} onChange={(event) => onRepsChange(Number(event.target.value) || 0)} className={field} aria-label={`Επαναλήψεις set ${setNumber}`} />
    <button type="button" onClick={() => onComplete(!isCompleted)} aria-label={`Ολοκλήρωση set ${setNumber}`} className={`grid h-[34px] w-[34px] place-items-center rounded-[10px] border transition-colors ${isCompleted ? "border-accent bg-accent text-accent-foreground" : "border-input bg-card text-muted-foreground hover:border-foreground"}`}><Check className="h-4 w-4" /></button>
  </div>
}
