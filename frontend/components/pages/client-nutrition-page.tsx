"use client"

import { useEffect, useMemo, useState } from "react"
import { ChevronDown, Clipboard, ImageOff, Printer, RotateCcw, Salad, ShoppingCart } from "lucide-react"
import { ProtectedRoute } from "@/components/auth/protected-route"
import { ClientShell } from "@/components/shell/client-shell"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { api } from "@/lib/api/client"
import { useAuth } from "@/lib/auth/auth-context"
import { toast } from "sonner"

type NutritionFood = { id?: number; name: string; amount?: string | null; quantity?: string | null; calories?: number | string | null; protein_g?: number | string | null; carbs_g?: number | string | null; fat_g?: number | string | null }
type NutritionMeal = { id?: number; name: string; title?: string | null; notes?: string | null; foods: NutritionFood[] }
type NutritionPlan = { id: number; title: string; daily_calories?: number | string | null; protein_g?: number | string | null; carbs_g?: number | string | null; fat_g?: number | string | null; meals: NutritionMeal[] } | null
type Dashboard = { client?: { subscriptionStatus?: string | null }; unreadNotifications?: number }
type MacroTotals = { calories: number; protein: number; carbs: number; fats: number }
type ShoppingItem = { key: string; name: string; quantity: number | null; unit: string }

const mealEmojis = ["🌅", "🌞", "🌆", "🌙"]
const numberValue = (value: number | string | null | undefined) => Number(value) || 0
const mealTitle = (meal: NutritionMeal, index: number) => meal.title?.trim() || meal.name || `Γεύμα ${index + 1}`
const mealTotals = (foods: NutritionFood[]): MacroTotals => foods.reduce((totals, food) => ({ calories: totals.calories + numberValue(food.calories), protein: totals.protein + numberValue(food.protein_g), carbs: totals.carbs + numberValue(food.carbs_g), fats: totals.fats + numberValue(food.fat_g) }), { calories: 0, protein: 0, carbs: 0, fats: 0 })

function parseQuantity(value: string | null | undefined) {
  const match = String(value || "").trim().match(/^(\d+(?:[.,]\d+)?)\s*(.*)$/)
  return match ? { quantity: Number(match[1].replace(",", ".")), unit: match[2].trim() } : { quantity: null, unit: String(value || "").trim() }
}

function formatQuantity(item: ShoppingItem) {
  if (item.quantity === null) return item.unit || "-"
  const amount = Number.isInteger(item.quantity) ? String(item.quantity) : item.quantity.toLocaleString("el-GR", { maximumFractionDigits: 1 })
  return `${amount}${item.unit ? ` ${item.unit}` : ""}`
}

function MacroProgress({ label, value, target, className }: { label: string; value: number; target: number; className: string }) {
  if (!target) return null
  return <div className="space-y-1.5"><div className="flex items-center justify-between text-xs"><span className="font-medium">{label}</span><span className="text-muted-foreground">{Math.round(value)}g / {Math.round(target)}g</span></div><Progress value={Math.min(100, (value / target) * 100)} className={`h-2 ${className}`} /></div>
}

function ClientNutritionView({ plan }: { plan: NonNullable<NutritionPlan> }) {
  const totals = useMemo(() => plan.meals.reduce((sum, meal) => { const mealTotal = mealTotals(meal.foods); return { calories: sum.calories + mealTotal.calories, protein: sum.protein + mealTotal.protein, carbs: sum.carbs + mealTotal.carbs, fats: sum.fats + mealTotal.fats } }, { calories: 0, protein: 0, carbs: 0, fats: 0 }), [plan.meals])
  const shoppingItems = useMemo(() => {
    const items = new Map<string, ShoppingItem>()
    plan.meals.flatMap((meal) => meal.foods).forEach((food) => {
      const parsed = parseQuantity(food.quantity ?? food.amount)
      const key = `${food.name.trim().toLocaleLowerCase("el-GR")}::${parsed.unit.toLocaleLowerCase("el-GR")}`
      const current = items.get(key)
      items.set(key, { key, name: food.name, unit: parsed.unit, quantity: parsed.quantity === null || current?.quantity === null ? null : (current?.quantity || 0) + parsed.quantity })
    })
    return [...items.values()]
  }, [plan.meals])
  const storageKey = `shopping_checked_${plan.id}`
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [checkedPlanId, setCheckedPlanId] = useState<number | null>(null)

  useEffect(() => { try { setChecked(JSON.parse(window.localStorage.getItem(storageKey) || "{}")) } catch { setChecked({}) }; setCheckedPlanId(plan.id) }, [plan.id, storageKey])
  useEffect(() => { if (checkedPlanId === plan.id) window.localStorage.setItem(storageKey, JSON.stringify(checked)) }, [checked, checkedPlanId, plan.id, storageKey])

  const copyShoppingList = async () => {
    const text = ["🛒 Λίστα Αγορών", "", "Άλλα:", ...shoppingItems.map((item) => `${checked[item.key] ? "☑" : "☐"} ${item.name} ${formatQuantity(item)}`)].join("\n")
    try { await navigator.clipboard.writeText(text); toast.success("Αντιγράφηκε!") } catch { toast.error("Δεν ήταν δυνατή η αντιγραφή.") }
  }

  return <div className="grid gap-6 lg:grid-cols-[minmax(0,1.85fr)_minmax(18rem,1fr)]"><div className="space-y-5"><Card><CardHeader className="pb-4"><CardTitle className="text-lg">Ημερήσιος Στόχος</CardTitle><CardDescription>{plan.title}</CardDescription></CardHeader><CardContent className="space-y-4"><p className="text-3xl font-bold">{Math.round(totals.calories).toLocaleString("el-GR")} <span className="text-base font-normal text-muted-foreground">/ {numberValue(plan.daily_calories) || "-"} kcal</span></p><MacroProgress label="Πρωτεΐνη" value={totals.protein} target={numberValue(plan.protein_g)} className="[&>div]:bg-blue-500" /><MacroProgress label="Υδατάνθρακες" value={totals.carbs} target={numberValue(plan.carbs_g)} className="[&>div]:bg-amber-500" /><MacroProgress label="Λίπη" value={totals.fats} target={numberValue(plan.fat_g)} className="[&>div]:bg-red-500" /></CardContent></Card>{plan.meals.map((meal, mealIndex) => { const totals = mealTotals(meal.foods); return <Collapsible key={meal.id ?? `${meal.name}-${mealIndex}`} defaultOpen><Card><CollapsibleTrigger className="flex w-full items-center gap-3 p-5 text-left"><ChevronDown className="h-4 w-4 shrink-0 transition-transform [[data-state=closed]_&]:-rotate-90" /><span className="text-lg">{mealEmojis[mealIndex] || "🍽️"}</span><span className="min-w-0 flex-1"><span className="block font-semibold">{mealTitle(meal, mealIndex)}</span><span className="mt-1 block text-xs text-muted-foreground">Π: {Math.round(totals.protein)}g · Υ: {Math.round(totals.carbs)}g · Λ: {Math.round(totals.fats)}g</span></span><Badge variant="secondary" className="shrink-0">{Math.round(totals.calories)} kcal</Badge></CollapsibleTrigger><CollapsibleContent><CardContent className="space-y-3 pt-0">{meal.notes && <p className="rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">{meal.notes}</p>}<Separator />{meal.foods.map((food, foodIndex) => <div key={food.id ?? `${food.name}-${foodIndex}`} className="flex items-center gap-3 py-2"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-muted"><ImageOff className="h-4 w-4 text-muted-foreground" /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{food.name}</p><p className="mt-0.5 text-xs text-muted-foreground">Π: {Math.round(numberValue(food.protein_g))}g · Υ: {Math.round(numberValue(food.carbs_g))}g · Λ: {Math.round(numberValue(food.fat_g))}g</p></div><div className="text-right"><p className="text-sm text-muted-foreground">{food.quantity ?? food.amount ?? "-"}</p><p className="text-xs font-medium">{Math.round(numberValue(food.calories))} kcal</p></div></div>)}<Separator /><p className="text-sm font-medium">Σύνολο: {Math.round(totals.calories)} kcal · Π: {Math.round(totals.protein)}g · Υ: {Math.round(totals.carbs)}g · Λ: {Math.round(totals.fats)}g</p></CardContent></CollapsibleContent></Card></Collapsible> })}</div><Card className="h-fit lg:sticky lg:top-6"><CardHeader><CardTitle className="flex items-center gap-2 text-lg"><ShoppingCart className="h-5 w-5 text-primary" />Λίστα Αγορών</CardTitle><CardDescription>Βάσει του πλάνου διατροφής</CardDescription></CardHeader><CardContent className="space-y-4"><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => void copyShoppingList()}><Clipboard className="mr-2 h-4 w-4" />Αντιγραφή</Button><Button size="sm" variant="outline" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />PDF</Button><Button size="sm" variant="ghost" onClick={() => { setChecked({}); window.localStorage.removeItem(storageKey); toast.success("Οι επιλογές καθαρίστηκαν.") }}><RotateCcw className="mr-2 h-4 w-4" />Καθαρισμός</Button></div><Separator /><ScrollArea className="max-h-[60vh] pr-4"><div className="space-y-3"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Άλλα</p>{shoppingItems.map((item) => <label key={item.key} className={`flex cursor-pointer items-center gap-3 text-sm ${checked[item.key] ? "text-muted-foreground line-through" : ""}`}><Checkbox checked={Boolean(checked[item.key])} onCheckedChange={(value) => setChecked((current) => ({ ...current, [item.key]: value === true }))} /><span className="min-w-0 flex-1 truncate">{item.name}</span><span className="shrink-0 text-muted-foreground">{formatQuantity(item)}</span></label>)}</div></ScrollArea></CardContent></Card></div>
}

function ClientNutritionContent() {
  const { user, logout } = useAuth()
  const [plan, setPlan] = useState<NutritionPlan>(null)
  const [paymentApproved, setPaymentApproved] = useState(false)
  const [unreadNotifications, setUnreadNotifications] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    Promise.all([api.get<NutritionPlan>("/client/nutrition-plan"), api.get<Dashboard>("/client/dashboard")])
      .then(([nutrition, dashboard]) => { setPlan(nutrition); setPaymentApproved(dashboard.client?.subscriptionStatus === "active"); setUnreadNotifications(dashboard.unreadNotifications || 0) })
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Δεν φορτώθηκε το πλάνο διατροφής."))
      .finally(() => setLoading(false))
  }, [])

  return <ClientShell title="Διατροφή" user={user} logout={logout} paymentApproved={paymentApproved} unreadNotifications={unreadNotifications} active="nutrition"><main className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6"><div><h1 className="text-2xl font-bold">Πλάνο Διατροφής</h1><p className="mt-1 text-sm text-muted-foreground">Το καθημερινό σου διατροφικό πλάνο και η λίστα αγορών.</p></div>{error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}{loading ? <p className="text-muted-foreground">Φόρτωση...</p> : plan ? <ClientNutritionView plan={plan} /> : <Card><CardContent className="py-12 text-center text-muted-foreground">Δεν υπάρχει διαθέσιμο πλάνο διατροφής.</CardContent></Card>}</main></ClientShell>
}

export default function ClientNutritionPage() {
  return <ProtectedRoute allow="client-active"><ClientNutritionContent /></ProtectedRoute>
}
