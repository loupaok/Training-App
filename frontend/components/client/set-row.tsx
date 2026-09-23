"use client"

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
  const inputClass = "h-8 rounded-none border-0 border-b-2 border-muted bg-transparent px-0 text-center [appearance:textfield] focus-visible:border-primary focus-visible:ring-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"

  return (
    <tr className={`border-l-2 transition-colors hover:bg-muted/30 ${isCompleted ? "border-green-500 bg-green-500/[0.08] text-green-700 dark:text-green-400" : "border-transparent"}`}>
      <td className="w-8 p-2 text-center font-bold">{setNumber}</td>
      <td className="p-2 text-right text-xs text-muted-foreground">{previous ? `${previous.weight}×${previous.reps}` : "-"}</td>
      <td className="p-2 text-center"><Input type="number" inputMode="decimal" min="0" step="0.5" placeholder="0" value={weightKg || ""} autoFocus={autoFocusKg} onChange={(event) => onWeightChange(Number(event.target.value) || 0)} className={`${inputClass} w-14`} /></td>
      <td className="p-2 text-center"><Input type="number" inputMode="numeric" min="0" step="1" placeholder="0" value={repsCompleted || ""} onChange={(event) => onRepsChange(Number(event.target.value) || 0)} className={`${inputClass} w-12`} /></td>
      <td className="p-2 text-right"><Checkbox checked={isCompleted} onCheckedChange={(checked) => onComplete(Boolean(checked))} className="h-6 w-6 rounded border-2 border-muted data-[state=checked]:border-green-500 data-[state=checked]:bg-green-500 data-[state=checked]:text-white" aria-label={`Ολοκλήρωση σετ ${setNumber}`} /></td>
    </tr>
  )
}
