"use client"

import { Check } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"

export function SetRow({ setNumber, previous, weightKg, repsCompleted, isCompleted, autoFocusKg, onWeightChange, onRepsChange, onComplete }: {
  setNumber: number
  previous?: { weight: number; reps: number } | null
  weightKg: number
  repsCompleted: number
  isCompleted: boolean
  autoFocusKg?: boolean
  onWeightChange: (weight: number) => void
  onRepsChange: (reps: number) => void
  onComplete: (completed: boolean) => void
}) {
  const inputClass = "h-9 border-input bg-background text-center [appearance:textfield] focus-visible:border-primary [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"

  return (
    <tr className={`border-l-2 ${isCompleted ? "border-green-500 bg-green-500/10 text-green-700 dark:text-green-400" : "border-transparent"}`}>
      <td className="p-3 font-medium">{setNumber}</td>
      <td className="p-3 text-xs text-muted-foreground">{previous ? `${previous.weight}kg × ${previous.reps}` : "-"}</td>
      <td className="p-3"><Input type="number" inputMode="decimal" min="0" step="0.5" placeholder="0" value={weightKg || ""} autoFocus={autoFocusKg} onChange={(event) => onWeightChange(Number(event.target.value) || 0)} className={`${inputClass} w-20`} /></td>
      <td className="p-3"><Input type="number" inputMode="numeric" min="0" step="1" placeholder="0" value={repsCompleted || ""} onChange={(event) => onRepsChange(Number(event.target.value) || 0)} className={`${inputClass} w-16`} /></td>
      <td className="p-3 text-right"><Checkbox checked={isCompleted} onCheckedChange={(checked) => onComplete(Boolean(checked))} className="h-6 w-6 rounded border-2 border-muted data-[state=checked]:border-green-500 data-[state=checked]:bg-green-500 data-[state=checked]:text-white" aria-label={`Ολοκλήρωση σετ ${setNumber}`} />{isCompleted && <Check className="ml-1 inline h-4 w-4 text-green-600" />}</td>
    </tr>
  )
}
