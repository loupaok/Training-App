"use client"

import { ChevronDown, Trophy } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"

export type SetType = "normal" | "warmup" | "drop" | "failure"

const setTypeDetails: Record<SetType, { label: string; shortLabel: string; className: string }> = {
  normal: { label: "Κανονικό", shortLabel: "", className: "" },
  warmup: { label: "Warm-up", shortLabel: "W", className: "bg-amber-500/10 text-amber-700 dark:text-amber-400" },
  drop: { label: "Drop set", shortLabel: "D", className: "bg-purple-500/10 text-purple-700 dark:text-purple-400" },
  failure: { label: "Failure", shortLabel: "F", className: "bg-red-500/10 text-red-700 dark:text-red-400" },
}

function displayWeight(weightKg: number, weightUnit: "kg" | "lbs") {
  return weightUnit === "lbs" ? Math.round(weightKg * 2.20462 * 10) / 10 : weightKg
}

export function SetRow({ setNumber, setType, previous, weightKg, repsCompleted, isCompleted, autoFocusKg, weightUnit, isPersonalRecord, onSetTypeChange, onWeightChange, onRepsChange, onComplete }: {
  setNumber: number
  setType: SetType
  previous?: { weight: number; reps: number } | null
  weightKg: number
  repsCompleted: number
  isCompleted: boolean
  autoFocusKg?: boolean
  weightUnit: "kg" | "lbs"
  isPersonalRecord?: boolean
  onSetTypeChange: (setType: SetType) => void
  onWeightChange: (weightKg: number) => void
  onRepsChange: (reps: number) => void
  onComplete: (completed: boolean) => void
}) {
  const inputClass = "h-8 rounded-none border-0 border-b-2 border-muted bg-transparent px-0 text-center [appearance:textfield] focus-visible:border-primary focus-visible:ring-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
  const details = setTypeDetails[setType]
  const enteredWeight = displayWeight(weightKg, weightUnit)

  return (
    <tr className={`border-l-2 transition-colors hover:bg-muted/30 ${isCompleted ? "border-green-500 bg-green-500/[0.08] text-green-700 dark:text-green-400" : "border-transparent"}`}>
      <td className="w-10 p-2 text-center">
        <DropdownMenu>
          <DropdownMenuTrigger className={`inline-flex h-7 min-w-7 items-center justify-center gap-0.5 rounded px-1 font-bold outline-none hover:bg-muted ${details.className}`} aria-label="Τύπος σετ">
            {details.shortLabel || setNumber}<ChevronDown className="h-3 w-3" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {(Object.keys(setTypeDetails) as SetType[]).map((type) => <DropdownMenuItem key={type} onSelect={() => onSetTypeChange(type)} className={setTypeDetails[type].className}>{setTypeDetails[type].shortLabel ? `${setTypeDetails[type].shortLabel} - ` : ""}{setTypeDetails[type].label}</DropdownMenuItem>)}
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
      <td className="p-2 text-right text-xs text-muted-foreground">{previous ? `${displayWeight(previous.weight, weightUnit)}×${previous.reps}` : "-"}</td>
      <td className="p-2 text-center"><Input type="number" inputMode="decimal" min="0" step="0.5" placeholder="0" value={enteredWeight || ""} autoFocus={autoFocusKg} onChange={(event) => onWeightChange((Number(event.target.value) || 0) / (weightUnit === "lbs" ? 2.20462 : 1))} className={`${inputClass} w-14`} /></td>
      <td className="p-2 text-center"><Input type="number" inputMode="numeric" min="0" step="1" placeholder="0" value={repsCompleted || ""} onChange={(event) => onRepsChange(Number(event.target.value) || 0)} className={`${inputClass} w-12`} /></td>
      <td className="p-2 text-right"><div className="inline-flex items-center gap-1"><Checkbox checked={isCompleted} onCheckedChange={(checked) => onComplete(Boolean(checked))} className="h-6 w-6 rounded border-2 border-muted data-[state=checked]:border-green-500 data-[state=checked]:bg-green-500 data-[state=checked]:text-white" aria-label={`Ολοκλήρωση σετ ${setNumber}`} />{isPersonalRecord && <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-medium text-amber-600"><Trophy className="h-4 w-4" />Νέο Ρεκόρ!</span>}</div></td>
    </tr>
  )
}
