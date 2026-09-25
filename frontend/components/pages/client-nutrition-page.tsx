"use client"

import { useEffect, useMemo, useState } from "react"
import { ArrowRightLeft, ChartNoAxesColumnIncreasing, Download, Lightbulb, MoreVertical, ShoppingCart, Utensils, X } from "lucide-react"
import { ProtectedRoute } from "@/components/auth/protected-route"
import { ClientShell } from "@/components/shell/client-shell"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { api } from "@/lib/api/client"
import { useAuth } from "@/lib/auth/auth-context"
import { toast } from "sonner"

type NutritionFood = { id?: number; name: string; food_image?: string | null; food_image_url?: string | null; image_url?: string | null; imageUrl?: string | null; amount?: string | null; quantity?: string | null; calories?: number | string | null; protein_g?: number | string | null; carbs_g?: number | string | null; fat_g?: number | string | null }
type NutritionMeal = { id?: number; name: string; title?: string | null; notes?: string | null; time?: string | null; day_of_week?: number | null; foods: NutritionFood[] }
type NutritionPlan = { id: number; title: string; notes?: string | null; daily_calories?: number | string | null; protein_g?: number | string | null; carbs_g?: number | string | null; fat_g?: number | string | null; meals: NutritionMeal[] } | null
type Dashboard = { client?: { subscriptionStatus?: string | null }; unreadNotifications?: number }
type MacroTotals = { calories: number; protein: number; carbs: number; fats: number }
type ShoppingItem = { key: string; name: string; quantity: number | null; unit: string; imageUrl?: string | null }
type FoodEquivalent = { id: number; name: string; imageUrl?: string | null; quantityG: number; calories: number; proteinG: number; carbsG: number; fatsG: number }

const numberValue = (value: number | string | null | undefined) => Number(value) || 0
const mealTitle = (meal: NutritionMeal, index: number) => meal.title?.trim() || meal.name || `Γεύμα ${index + 1}`
const mealTotals = (foods: NutritionFood[]): MacroTotals => foods.reduce((totals, food) => ({ calories: totals.calories + numberValue(food.calories), protein: totals.protein + numberValue(food.protein_g), carbs: totals.carbs + numberValue(food.carbs_g), fats: totals.fats + numberValue(food.fat_g) }), { calories: 0, protein: 0, carbs: 0, fats: 0 })
const shoppingCategories: Record<string, string[]> = {
  "Πρωτεΐνη": ["κοτόπουλο", "σολομός", "τόνος", "αυγό", "whey", "protein", "isolate", "γαλοπούλα", "μοσχάρι", "χοιρινό", "γαρίδες", "τυρί cottage"],
  "Φρούτα & Λαχανικά": ["μπανάνα", "μήλο", "φράουλα", "μπρόκολο", "σαλάτα", "σπανάκι", "πατάτα", "γλυκοπατάτα", "αγγούρι", "ντομάτα", "φρούτα", "λαχανικά"],
  "Γαλακτοκομικά": ["γιαούρτι", "τυρί", "γάλα", "cottage", "ανθότυρο"],
  "Δημητριακά": ["βρώμη", "ρύζι", "ψωμί", "ζυμαρικά", "quinoa", "κριθάρι"],
  "Λίπη & Άλλα": ["ελαιόλαδο", "αμύγδαλα", "φυστικοβούτυρο", "αβοκάντο", "ξηροί", "καρποί"],
}

function parseQuantity(value: string | null | undefined) {
  const match = String(value || "").trim().match(/^(\d+(?:[.,]\d+)?)\s*(.*)$/)
  return match ? { quantity: Number(match[1].replace(",", ".")), unit: match[2].trim() || "g" } : { quantity: null, unit: String(value || "").trim() }
}

function formatQuantity(item: ShoppingItem) {
  if (item.quantity === null) return item.unit || "-"
  const amount = Number.isInteger(item.quantity) ? String(item.quantity) : item.quantity.toLocaleString("el-GR", { maximumFractionDigits: 1 })
  return `${amount}${item.unit === "g" ? "g" : item.unit ? ` ${item.unit}` : ""}`
}

function formatGrams(value: number | string | null | undefined) {
  return `${numberValue(value).toLocaleString("el-GR", { maximumFractionDigits: 1 })}g`
}

function shoppingCategory(name: string) {
  const normalized = name.toLocaleLowerCase("el-GR")
  return Object.entries(shoppingCategories).find(([, keywords]) => keywords.some((keyword) => normalized.includes(keyword)))?.[0] || "Άλλα"
}

function CalorieRing({ calories }: { calories: number }) {
  const radius = 42
  const circumference = 2 * Math.PI * radius
  const progress = calories > 0 ? 1 : 0

  return <svg viewBox="0 0 100 100" className="h-32 w-32 shrink-0 text-emerald-500" aria-label={`${Math.round(calories)} kcal`}>
    <circle cx="50" cy="50" r={radius} fill="none" stroke="currentColor" strokeWidth="8" className="text-muted" />
    <circle cx="50" cy="50" r={radius} fill="none" stroke="currentColor" strokeWidth="8" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - progress)} strokeLinecap="round" className="transition-all duration-300" transform="rotate(-90 50 50)" />
    <text x="50" y="48" textAnchor="middle" fill="currentColor" fontSize="16" fontWeight="700">{Math.round(calories).toLocaleString("el-GR")}</text>
    <text x="50" y="62" textAnchor="middle" fill="currentColor" fontSize="8">kcal</text>
  </svg>
}

function MacroProgress({ label, value, calories, totalCalories, progressClass }: { label: string; value: number; calories: number; totalCalories: number; progressClass: string }) {
  const percentage = totalCalories > 0 ? Math.round((calories / totalCalories) * 100) : 0
  return <div className="space-y-2"><p className="text-base font-semibold">{label}</p><p className="text-2xl font-bold">{Math.round(value)} <span className="text-base font-medium text-muted-foreground">g</span></p><div className="flex items-center gap-3"><Progress value={percentage} className={`h-2 flex-1 ${progressClass}`} /><span className="text-sm text-muted-foreground">{percentage}%</span></div></div>
}

function ClientNutritionView({ plan }: { plan: NonNullable<NutritionPlan> }) {
  const totals = useMemo(() => plan.meals.reduce((sum, meal) => {
    const mealTotal = mealTotals(meal.foods)
    return {
      calories: sum.calories + mealTotal.calories,
      protein: sum.protein + mealTotal.protein,
      carbs: sum.carbs + mealTotal.carbs,
      fats: sum.fats + mealTotal.fats,
    }
  }, { calories: 0, protein: 0, carbs: 0, fats: 0 }), [plan.meals])

  const shoppingItems = useMemo(() => {
    const items = new Map<string, ShoppingItem>()

    plan.meals.flatMap((meal) => meal.foods).forEach((food) => {
      const parsed = parseQuantity(food.quantity ?? food.amount)
      const key = `${food.name.trim().toLocaleLowerCase("el-GR")}::${parsed.unit.toLocaleLowerCase("el-GR")}`
      const current = items.get(key)

      items.set(key, {
        key,
        name: food.name,
        unit: parsed.unit,
        quantity: parsed.quantity === null || current?.quantity === null ? null : (current?.quantity || 0) + parsed.quantity,
        imageUrl: current?.imageUrl || food.food_image || food.food_image_url || food.imageUrl || food.image_url,
      })
    })

    return [...items.values()]
  }, [plan.meals])

  const availableCategories = useMemo(() => {
    const categories = new Map<string, number>()
    shoppingItems.forEach((item) => {
      const category = shoppingCategory(item.name)
      categories.set(category, (categories.get(category) || 0) + 1)
    })
    return [...categories.entries()]
  }, [shoppingItems])

  const weeklyDays = useMemo(() => [...new Set(
    plan.meals.map((meal) => meal.day_of_week).filter((day): day is number => typeof day === "number")
  )].sort((first, second) => first - second), [plan.meals])
  const isWeeklyPlan = weeklyDays.length > 1
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [activeCategory, setActiveCategory] = useState("Όλα")
  const [shoppingOpen, setShoppingOpen] = useState(false)
  const storageKey = `shopping_checked_${plan.id}`
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [checkedPlanId, setCheckedPlanId] = useState<number | null>(null)
  const [equivalentFood, setEquivalentFood] = useState<NutritionFood | null>(null)
  const [equivalents, setEquivalents] = useState<FoodEquivalent[]>([])
  const [equivalentsLoading, setEquivalentsLoading] = useState(false)

  useEffect(() => {
    try {
      setChecked(JSON.parse(window.localStorage.getItem(storageKey) || "{}"))
    } catch {
      setChecked({})
    }
    setCheckedPlanId(plan.id)
  }, [plan.id, storageKey])

  useEffect(() => {
    if (checkedPlanId === plan.id) window.localStorage.setItem(storageKey, JSON.stringify(checked))
  }, [checked, checkedPlanId, plan.id, storageKey])

  useEffect(() => {
    if (isWeeklyPlan && selectedDay === null) setSelectedDay(weeklyDays[0])
  }, [isWeeklyPlan, selectedDay, weeklyDays])

  const visibleMeals = isWeeklyPlan && selectedDay !== null
    ? plan.meals.filter((meal) => meal.day_of_week === selectedDay)
    : plan.meals
  const filteredShoppingItems = activeCategory === "Όλα"
    ? shoppingItems
    : shoppingItems.filter((item) => shoppingCategory(item.name) === activeCategory)
  const proteinCalories = totals.protein * 4
  const carbsCalories = totals.carbs * 4
  const fatCalories = totals.fats * 9
  const macroCalories = proteinCalories + carbsCalories + fatCalories

  const resetShoppingList = () => {
    setChecked({})
    window.localStorage.removeItem(storageKey)
    toast.success("Οι επιλογές καθαρίστηκαν.")
  }

  const showEquivalents = async (food: NutritionFood) => {
    setEquivalentFood(food)
    setEquivalents([])
    setEquivalentsLoading(true)
    const params = new URLSearchParams({
      foodName: food.name,
      calories: String(numberValue(food.calories)),
      protein: String(numberValue(food.protein_g)),
      carbs: String(numberValue(food.carbs_g)),
      fats: String(numberValue(food.fat_g)),
    })
    try {
      const result = await api.get<{ equivalents: FoodEquivalent[] }>(`/client/nutrition-equivalents?${params.toString()}`)
      setEquivalents(Array.isArray(result.equivalents) ? result.equivalents : [])
    } catch {
      toast.error("Δεν ήταν δυνατή η φόρτωση ισοδύναμων τροφίμων.")
    } finally {
      setEquivalentsLoading(false)
    }
  }

  const copyShoppingList = async () => {
    const text = ["Λίστα Αγορών", "", ...shoppingItems.map((item) => `${checked[item.key] ? "☑" : "☐"} ${item.name} ${formatQuantity(item)}`)].join("\n")
    try {
      await navigator.clipboard.writeText(text)
      toast.success("Αντιγράφηκε!")
    } catch {
      toast.error("Δεν ήταν δυνατή η αντιγραφή.")
    }
  }

  const exportShoppingList = () => {
    const printWindow = window.open("", "_blank")
    if (!printWindow) {
      toast.error("Δεν ήταν δυνατό το άνοιγμα της προεπισκόπησης εκτύπωσης.")
      return
    }

    const printDocument = printWindow.document
    printDocument.open()
    printDocument.write("<!doctype html><html><head><meta charset=\"utf-8\"><title>Λίστα Αγορών</title><style>body{font-family:Arial,sans-serif;color:#1f2937;margin:40px;max-width:720px}h1{font-size:22px;margin:0 0 24px}ul{list-style:none;padding:0;margin:0}li{display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid #e5e7eb}.food-image,.food-placeholder{width:36px;height:36px;border-radius:8px;flex:0 0 36px;object-fit:cover}.food-placeholder{display:grid;place-items:center;background:#f3f4f6;color:#6b7280;font-weight:600}.food-name{flex:1}.food-quantity{color:#6b7280;white-space:nowrap}</style></head><body></body></html>")
    printDocument.close()

    const title = printDocument.createElement("h1")
    title.textContent = "Λίστα για Ψώνια"
    printDocument.body.appendChild(title)

    const list = printDocument.createElement("ul")
    shoppingItems.forEach((item) => {
      const row = printDocument.createElement("li")
      const name = printDocument.createElement("span")
      const quantity = printDocument.createElement("span")
      name.className = "food-name"
      name.textContent = item.name
      if (item.imageUrl) {
        const image = printDocument.createElement("img")
        image.className = "food-image"
        image.alt = ""
        try { image.src = new URL(item.imageUrl, window.location.origin).href } catch { image.src = item.imageUrl }
        row.appendChild(image)
      } else {
        const placeholder = printDocument.createElement("span")
        placeholder.className = "food-placeholder"
        placeholder.textContent = item.name.trim().charAt(0).toLocaleUpperCase("el-GR")
        row.appendChild(placeholder)
      }
      quantity.className = "food-quantity"
      quantity.textContent = formatQuantity(item)
      row.append(name, quantity)
      list.appendChild(row)
    })
    printDocument.body.appendChild(list)

    const images = Array.from(printDocument.images)
    Promise.all(images.map((image) => new Promise<void>((resolve) => {
      if (image.complete) resolve()
      else {
        image.onload = () => resolve()
        image.onerror = () => resolve()
      }
    }))).finally(() => {
      printWindow.focus()
      window.setTimeout(() => printWindow.print(), 50)
    })
  }

  return (
    <div className="space-y-6">
      <Dialog open={Boolean(equivalentFood)} onOpenChange={(open) => !open && setEquivalentFood(null)}>
        <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Ισοδύναμα τρόφιμα</DialogTitle>
            <DialogDescription>
              {equivalentFood ? `Επιλογές με παρόμοια πρωτεΐνη, υδατάνθρακες και λίπη με το ${equivalentFood.name}.` : ""}
            </DialogDescription>
          </DialogHeader>

          {equivalentsLoading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Αναζήτηση ισοδύναμων τροφίμων...</p>
          ) : equivalents.length ? (
            <div className="divide-y divide-border rounded-lg border">
              {equivalents.map((food) => (
                <div key={food.id} className="flex items-center gap-3 p-3">
                  {food.imageUrl ? <img src={food.imageUrl} alt="" className="h-10 w-10 rounded-md object-cover" /> : <span className="grid h-10 w-10 place-items-center rounded-md bg-muted"><Utensils className="h-4 w-4 text-muted-foreground" /></span>}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{food.name}</p>
                    <p className="text-xs text-muted-foreground">{food.quantityG}g · {food.calories} kcal</p>
                  </div>
                  <p className="shrink-0 text-right text-xs text-muted-foreground">Π {formatGrams(food.proteinG)}<br />Υ {formatGrams(food.carbsG)} · Λ {formatGrams(food.fatsG)}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">Δεν βρέθηκαν ισοδύναμες επιλογές.</p>
          )}
        </DialogContent>
      </Dialog>

      <Card className="border-border bg-card shadow-sm">
        <CardContent className="p-6">
          <h2 className="mb-5 text-2xl font-bold">Ημέρα - Σύνολο</h2>
          <div className="grid gap-6 lg:grid-cols-[12rem_minmax(0,1fr)_17rem] lg:items-center">
            <div className="flex justify-center">
              <CalorieRing calories={totals.calories} />
            </div>

            <div className="grid gap-6 sm:grid-cols-3 sm:divide-x sm:divide-border">
              <div className="sm:pr-6"><MacroProgress label="Πρωτεΐνη" value={totals.protein} calories={proteinCalories} totalCalories={macroCalories} progressClass="[&_[data-slot=progress-track]]:bg-blue-100 [&_[data-slot=progress-indicator]]:bg-blue-500" /></div>
              <div className="sm:px-6"><MacroProgress label="Υδατάνθρακες" value={totals.carbs} calories={carbsCalories} totalCalories={macroCalories} progressClass="[&_[data-slot=progress-track]]:bg-amber-100 [&_[data-slot=progress-indicator]]:bg-amber-500" /></div>
              <div className="sm:pl-6"><MacroProgress label="Λίπος" value={totals.fats} calories={fatCalories} totalCalories={macroCalories} progressClass="[&_[data-slot=progress-track]]:bg-pink-100 [&_[data-slot=progress-indicator]]:bg-pink-500" /></div>
            </div>

            <div className="rounded-xl bg-emerald-50 p-5 dark:bg-emerald-950/20">
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50">
                  <ChartNoAxesColumnIncreasing className="h-6 w-6" />
                </span>
                <div>
                  <p className="text-sm text-muted-foreground">Ημερήσιο σύνολο</p>
                  <p className="text-2xl font-bold">{Math.round(totals.calories).toLocaleString("el-GR")} kcal</p>
                  <p className="mt-1 text-xs text-emerald-600">Συνέχισε έτσι!</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <section className="min-w-0">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-xl font-bold">Πλάνο Διατροφής</h2>
          <Button size="sm" variant="outline" onClick={() => setShoppingOpen(true)}>
            <ShoppingCart className="mr-2 h-4 w-4" />
            Λίστα για Ψώνια
          </Button>
        </div>

        {isWeeklyPlan && (
          <div className="mb-4 flex items-center gap-1 overflow-x-auto pb-1">
            {weeklyDays.map((day) => (
              <Button
                key={day}
                size="sm"
                variant={selectedDay === day ? "default" : "ghost"}
                className="shrink-0"
                onClick={() => setSelectedDay(day)}
              >
                {["Κυρ", "Δευ", "Τρι", "Τετ", "Πεμ", "Παρ", "Σαβ"][day] || `Ημέρα ${day}`}
              </Button>
            ))}
          </div>
        )}

        <Accordion className="space-y-3" defaultValue={visibleMeals.map((_, index) => `meal-${index}`)}>
          {visibleMeals.map((meal, mealIndex) => {
            const totals = mealTotals(meal.foods)
            const mealIndexInPlan = plan.meals.indexOf(meal)
            const mealName = mealTitle(meal, mealIndexInPlan)

            return (
              <AccordionItem key={meal.id ?? `${meal.name}-${mealIndex}`} value={`meal-${mealIndex}`} className="overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md">
                <AccordionTrigger className="px-4 py-4 hover:bg-muted/40 hover:no-underline">
                  <div className="flex min-w-0 flex-1 items-center gap-3 pr-2">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-base font-semibold">{mealName}</span>
                    </span>
                    <span className="shrink-0 text-sm text-foreground">Ποσότητα</span>
                    <span className="shrink-0 text-sm font-semibold">{Math.round(totals.calories)} kcal</span>
                    <span className="hidden shrink-0 text-sm text-foreground sm:inline">{Math.round(totals.protein)}Π</span>
                    <span className="hidden shrink-0 text-sm text-foreground sm:inline">{Math.round(totals.carbs)}Υ</span>
                    <span className="hidden shrink-0 text-sm text-foreground sm:inline">{Math.round(totals.fats)}Λ</span>
                  </div>
                </AccordionTrigger>

                <AccordionContent className="border-t border-border/60 px-4 pb-4 pt-3">
                  {meal.notes && <p className="mb-3 text-sm italic text-muted-foreground">{meal.notes}</p>}
                  <Table className="min-w-[560px]">
                    <TableBody className="[&_tr]:border-border/40">
                      {meal.foods.map((food, foodIndex) => {
                        const quantity = parseQuantity(food.quantity ?? food.amount)
                        const imageUrl = food.food_image ?? food.food_image_url ?? food.imageUrl ?? food.image_url

                        return (
                          <TableRow key={food.id ?? `${food.name}-${foodIndex}`} className="hover:bg-transparent">
                            <TableCell className="px-1 py-2">
                              <div className="flex min-w-[12rem] items-center gap-2">
                                {imageUrl ? (
                                  <img src={imageUrl} alt="" className="h-9 w-9 shrink-0 rounded-md object-cover" />
                                ) : (
                                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-muted">
                                    <Utensils className="h-4 w-4 text-muted-foreground" />
                                  </span>
                                )}
                                <span className="truncate text-base font-medium">{food.name}</span>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
                                  onClick={() => void showEquivalents(food)}
                                  aria-label={`Ισοδύναμα τρόφιμα για ${food.name}`}
                                  title="Ισοδύναμα τρόφιμα"
                                >
                                  <ArrowRightLeft className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                            <TableCell className="w-14 px-1 py-2 text-right text-base text-foreground">
                              {quantity.quantity === null ? "-" : formatQuantity({ key: "", name: "", quantity: quantity.quantity, unit: quantity.unit })}
                            </TableCell>
                            <TableCell className="w-16 px-1 py-2 text-right text-base text-muted-foreground">{Math.round(numberValue(food.calories))}</TableCell>
                            <TableCell className="w-12 px-1 py-2 text-right text-sm text-foreground">{formatGrams(food.protein_g)}</TableCell>
                            <TableCell className="w-12 px-1 py-2 text-right text-sm text-foreground">{formatGrams(food.carbs_g)}</TableCell>
                            <TableCell className="w-12 px-1 py-2 text-right text-sm text-foreground">{formatGrams(food.fat_g)}</TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </AccordionContent>
              </AccordionItem>
            )
          })}
        </Accordion>

        {plan.notes && (
          <Card className="mt-6 border-border bg-[#F2F9F7] shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Lightbulb className="h-4 w-4 text-foreground" />
                Σημείωση από τον coach
              </div>
              <p className="mt-2 text-sm italic text-muted-foreground">{plan.notes}</p>
            </CardContent>
          </Card>
        )}
      </section>

      {shoppingOpen && (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Κλείσιμο λίστας για ψώνια"
            className="absolute inset-0 bg-black/20"
            onClick={() => setShoppingOpen(false)}
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-labelledby="shopping-list-title"
            className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l bg-background shadow-xl will-change-transform animate-in slide-in-from-right duration-200"
          >
            <div className="flex items-start justify-between gap-4 border-b p-5">
              <div>
                <h2 id="shopping-list-title" className="flex items-center gap-2 text-lg font-semibold">
                  <ShoppingCart className="h-5 w-5 text-foreground" />
                  Λίστα για Ψώνια
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">Βάσει του πλάνου διατροφής</p>
              </div>
              <Button size="icon-sm" variant="ghost" aria-label="Κλείσιμο" onClick={() => setShoppingOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-4 p-5">
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" className="flex-1" onClick={exportShoppingList}>
                <Download className="mr-2 h-4 w-4" />
                Εξαγωγή
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger render={<Button size="icon-sm" variant="ghost" aria-label="Ενέργειες λίστας αγορών" />}>
                  <MoreVertical className="h-4 w-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => void copyShoppingList()}>Αντιγραφή</DropdownMenuItem>
                  <DropdownMenuItem onClick={resetShoppingList}>Καθαρισμός</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <Select value={activeCategory} onValueChange={(value) => setActiveCategory(value || "Όλα")}>
              <SelectTrigger size="sm" className="w-full">
                <SelectValue placeholder="Επίλεξε κατηγορία" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Όλα">Όλα ({shoppingItems.length})</SelectItem>
                {availableCategories.map(([category, count]) => (
                  <SelectItem key={category} value={category}>{category} ({count})</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Separator />
            <div className="min-h-0 flex-1 overflow-y-auto pr-3">
              <div className="space-y-1.5">
                {filteredShoppingItems.map((item) => (
                  <label key={item.key} className={`flex cursor-pointer items-center gap-3 rounded-lg border border-transparent px-2 py-2.5 text-sm transition-colors hover:border-border hover:bg-muted/30 ${checked[item.key] ? "text-muted-foreground" : ""}`}>
                    <Checkbox
                      checked={Boolean(checked[item.key])}
                      onCheckedChange={(value) => setChecked((current) => ({ ...current, [item.key]: value === true }))}
                    />
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
                    ) : (
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                        {item.name.trim().charAt(0).toLocaleUpperCase("el-GR")}
                      </span>
                    )}
                    <span className={`min-w-0 flex-1 truncate font-medium ${checked[item.key] ? "line-through" : ""}`}>{item.name}</span>
                    <span className="shrink-0 text-muted-foreground">{formatQuantity(item)}</span>
                  </label>
                ))}
              </div>
            </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  )
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
