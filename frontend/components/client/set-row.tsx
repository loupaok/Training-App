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
  const field = "h-10 w-full rounded-[10px] border border-[#E6E6E2] bg-white px-1 text-center text-[14px] font-extrabold tabular-nums text-[#0B0B0B] shadow-none focus-visible:border-[#0B0B0B] focus-visible:ring-0 dark:border-[#2A2A2A] dark:bg-[#161616] dark:text-white dark:focus-visible:border-white [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"

  return <div className={`grid grid-cols-[34px_1fr_64px_64px_36px] items-center gap-2 rounded-[10px] px-2 py-1.5 transition-colors ${isCompleted ? "bg-[#F1FBD6] dark:bg-[#1A2E05]" : "bg-transparent"}`}>
    <span className={`grid h-[30px] w-[30px] place-items-center rounded-[9px] text-[12px] font-extrabold ${isCompleted ? "bg-[#0B0B0B] text-[#B0F90C]" : "bg-[#F2F2F0] text-[#0B0B0B] dark:bg-[#1F1F1F] dark:text-white"}`}>{setNumber}</span>
    <div className="min-w-0">
      <button type="button" onClick={copyPrevious} disabled={!previous} className={`block max-w-full truncate text-left font-semibold tabular-nums text-[#6A6A6A] underline-offset-2 enabled:hover:text-[#0B0B0B] enabled:hover:underline disabled:no-underline dark:text-[#9A9A9A] dark:enabled:hover:text-white ${isPersonalRecord ? "text-[11px]" : "text-[12px]"}`}>{previous ? `${shownWeight(previous.weight, weightUnit)} × ${previous.reps}` : "—"}</button>
      {isPersonalRecord && <span className="mt-[3px] flex h-5 w-fit max-w-full items-center gap-1 whitespace-nowrap rounded-full bg-[#0B0B0B] px-1.5 text-[10px] font-extrabold leading-none text-[#B0F90C]"><Trophy className="h-[11px] w-[11px] shrink-0" />ΝΕΟ ΡΕΚΟΡ</span>}
    </div>
    <Input type="number" inputMode="decimal" min="0" step="0.5" value={shownWeight(weightKg, weightUnit) || ""} autoFocus={autoFocusKg} onChange={(event) => onWeightChange((Number(event.target.value) || 0) / (weightUnit === "lbs" ? 2.20462 : 1))} className={field} aria-label={`Κιλά set ${setNumber}`} />
    <Input type="number" inputMode="numeric" min="0" step="1" value={repsCompleted || ""} onChange={(event) => onRepsChange(Number(event.target.value) || 0)} className={field} aria-label={`Επαναλήψεις set ${setNumber}`} />
    <button type="button" onClick={() => onComplete(!isCompleted)} aria-label={`Ολοκλήρωση set ${setNumber}`} className={`grid h-[34px] w-[34px] place-items-center rounded-[10px] border transition-colors ${isCompleted ? "border-[#0B0B0B] bg-[#0B0B0B] text-[#B0F90C]" : "border-[#D6D6D2] bg-white text-[#B0B0AC] hover:border-[#0B0B0B] dark:border-[#3A3A3A] dark:bg-[#161616] dark:text-[#6A6A6A] dark:hover:border-white"}`}><Check className="h-4 w-4" /></button>
  </div>
}
