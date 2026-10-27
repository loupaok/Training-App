"use client"

import { Check, ChevronDown, Trophy } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"

export type SetType = "normal" | "warmup" | "drop" | "failure"

const types: Record<SetType, { label: string; mark: string }> = {
  normal: { label: "Κανονικό", mark: "" }, warmup: { label: "Warm-up", mark: "W" }, drop: { label: "Drop set", mark: "D" }, failure: { label: "Failure", mark: "F" },
}
const shownWeight = (value: number, unit: "kg" | "lbs") => unit === "lbs" ? Math.round(value * 2.20462 * 10) / 10 : value

export function SetRow({ setNumber, setType, previous, weightKg, repsCompleted, isCompleted, autoFocusKg, weightUnit, isPersonalRecord, onSetTypeChange, onWeightChange, onRepsChange, onComplete }: {
  setNumber: number; setType: SetType; previous?: { weight: number; reps: number } | null; weightKg: number; repsCompleted: number; isCompleted: boolean; autoFocusKg?: boolean; weightUnit: "kg" | "lbs"; isPersonalRecord?: boolean; onSetTypeChange: (setType: SetType) => void; onWeightChange: (weightKg: number) => void; onRepsChange: (reps: number) => void; onComplete: (completed: boolean) => void
}) {
  const copyPrevious = () => { if (!previous) return; onWeightChange(previous.weight); onRepsChange(previous.reps) }
  const field = "h-10 w-full rounded-[10px] border border-[#E6E6E2] bg-white px-1 text-center text-[14px] font-extrabold tabular-nums text-[#0B0B0B] shadow-none focus-visible:border-[#0B0B0B] focus-visible:ring-0 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
  return <div className={`grid grid-cols-[34px_1fr_64px_64px_36px] items-center gap-2 rounded-[10px] px-2 py-1.5 transition-colors ${isCompleted ? "bg-[#F1FBD6]" : "bg-transparent"}`}>
    <DropdownMenu><DropdownMenuTrigger className={`grid h-[30px] w-[30px] place-items-center rounded-[9px] text-[12px] font-extrabold ${isCompleted ? "bg-[#0B0B0B] text-[#B0F90C]" : "bg-[#F2F2F0] text-[#0B0B0B]"}`} aria-label="Τύπος set">{types[setType].mark || setNumber}<ChevronDown className="ml-0.5 h-3 w-3" /></DropdownMenuTrigger><DropdownMenuContent align="start">{(Object.keys(types) as SetType[]).map((type) => <DropdownMenuItem key={type} onSelect={() => onSetTypeChange(type)}>{types[type].mark ? `${types[type].mark} · ` : ""}{types[type].label}</DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu>
    <button type="button" onClick={copyPrevious} disabled={!previous} className="truncate text-left text-[12px] font-semibold tabular-nums text-[#6A6A6A] underline-offset-2 enabled:hover:text-[#0B0B0B] enabled:hover:underline disabled:no-underline">{previous ? `${shownWeight(previous.weight, weightUnit)} × ${previous.reps}` : "—"}</button>
    <Input type="number" inputMode="decimal" min="0" step="0.5" value={shownWeight(weightKg, weightUnit) || ""} autoFocus={autoFocusKg} onChange={(event) => onWeightChange((Number(event.target.value) || 0) / (weightUnit === "lbs" ? 2.20462 : 1))} className={field} aria-label={`Κιλά set ${setNumber}`} />
    <Input type="number" inputMode="numeric" min="0" step="1" value={repsCompleted || ""} onChange={(event) => onRepsChange(Number(event.target.value) || 0)} className={field} aria-label={`Επαναλήψεις set ${setNumber}`} />
    <button type="button" onClick={() => onComplete(!isCompleted)} aria-label={`Ολοκλήρωση set ${setNumber}`} className={`grid h-[34px] w-[34px] place-items-center rounded-[10px] border transition-colors ${isCompleted ? "border-[#0B0B0B] bg-[#0B0B0B] text-[#B0F90C]" : "border-[#D6D6D2] bg-white text-[#B0B0AC] hover:border-[#0B0B0B]"}`}>{isCompleted ? <Check className="h-4 w-4" /> : <Check className="h-4 w-4" />}{isPersonalRecord && <Trophy className="sr-only" />}</button>
  </div>
}
