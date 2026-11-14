"use client"

import { useEffect, useMemo, useState } from "react"
import { ArrowRightLeft, ChartNoAxesColumnIncreasing, ChevronRight, Download, Lightbulb, MoreVertical, ShoppingCart, Utensils, X } from "lucide-react"
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
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { api } from "@/lib/api/client"
import { useAuth } from "@/lib/auth/auth-context"
import { resolveMediaUrl } from "@/lib/media"
import { cacheOfflineData, readOfflineData } from "@/lib/offline-client"
import { toast } from "sonner"
import { ClientCycleCard } from "@/components/client/client-cycle-card"
import { ClientSupplementsCard } from "@/components/client/client-supplements-card"

type NutritionFood = { id?: number; name: string; food_image?: string | null; food_image_url?: string | null; image_url?: string | null; imageUrl?: string | null; amount?: string | null; quantity?: string | null; calories?: number | string | null; protein_g?: number | string | null; carbs_g?: number | string | null; fat_g?: number | string | null }
type NutritionMeal = { id?: number; name: string; title?: string | null; notes?: string | null; time?: string | null; day_of_week?: number | null; foods: NutritionFood[] }
type NutritionPlan = { id: number; title: string; notes?: string | null; updated_at?: string | null; daily_calories?: number | string | null; protein_g?: number | string | null; carbs_g?: number | string | null; fat_g?: number | string | null; meals: NutritionMeal[] } | null
type Dashboard = { client?: { subscriptionStatus?: string | null }; unreadNotifications?: number }
type NutritionOfflineCache = { nutrition: NutritionPlan; dashboard: Dashboard }
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

function formatQuantityForDays(item: ShoppingItem, days: number) {
  if (item.quantity === null) return item.unit || "-"
  const total = item.quantity * days
  if (item.unit.toLocaleLowerCase("el-GR") === "g" && total >= 1000) return `${(total / 1000).toLocaleString("el-GR", { maximumFractionDigits: 1 })} kg`
  if (/^(τεμ\.?|piece|pieces)$/i.test(item.unit)) return `${Math.round(total).toLocaleString("el-GR")} τεμ.`
  return `${total.toLocaleString("el-GR", { maximumFractionDigits: 1 })}${item.unit === "g" ? " g" : item.unit ? ` ${item.unit}` : ""}`
}

function formatGrams(value: number | string | null | undefined) {
  return `${numberValue(value).toLocaleString("el-GR", { maximumFractionDigits: 1 })} g`
}

function formatPlanDate(value?: string | null) {
  if (!value) return "—"
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("el-GR", { day: "numeric", month: "short" })
}

function FoodPhoto({ src, name, size = "default" }: { src?: string | null; name: string; size?: "default" | "small" }) {
  const dimension = size === "small" ? "h-9 w-9 rounded-xl" : "h-[38px] w-[38px] rounded-xl"
  const [failed, setFailed] = useState(false)
  if (src && !failed) return <img src={resolveMediaUrl(src)} alt={name} loading="lazy" onError={() => setFailed(true)} className={`${dimension} shrink-0 object-cover`} />
  return <span aria-hidden="true" className={`grid ${dimension} shrink-0 place-items-center bg-muted text-xs font-extrabold text-muted-foreground`}>{name.trim().charAt(0).toLocaleUpperCase("el-GR")}</span>
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

function MacroBar({ totals, macroCalories, compact = false }: { totals: MacroTotals; macroCalories: number; compact?: boolean }) {
  const values = [
    { label: "Πρωτεΐνη", short: "Π", grams: totals.protein, calories: totals.protein * 4, color: "bg-accent" },
    { label: "Υδατάνθρακες", short: "Υδ/κες", grams: totals.carbs, calories: totals.carbs * 4, color: "bg-foreground" },
    { label: "Λίπος", short: "Λ", grams: totals.fats, calories: totals.fats * 9, color: "bg-[#c9c9c4] dark:bg-[#6a6a6a]" },
  ]
  return <><div className="flex h-3 gap-[3px] overflow-hidden rounded-full">{values.map((macro) => <span key={macro.label} className={`${macro.color} min-w-[3px]`} style={{ flex: Math.max(macro.calories, 1) }} />)}</div><div className={compact ? "grid grid-cols-3 gap-2" : "space-y-3"}>{values.map((macro) => { const percentage = macroCalories ? Math.round((macro.calories / macroCalories) * 100) : 0; return <div key={macro.label} className={compact ? "min-w-0" : "flex items-center justify-between gap-3"}><p className={`flex items-center gap-2 ${compact ? "text-[11px] font-bold text-muted-foreground" : "text-[13px] font-bold"}`}><span className={`h-2.5 w-2.5 shrink-0 rounded-[3px] ${macro.color}`} />{compact ? macro.short : macro.label}</p><p className={compact ? "mt-1 text-[17px] font-extrabold" : "text-[15px] font-extrabold"}>{numberValue(macro.grams).toLocaleString("el-GR", { maximumFractionDigits: 1 })} g <span className="text-[12px] font-semibold text-muted-foreground">· {percentage}%</span></p></div> })}</div></>
}

function NutritionTargetsSummary({ plan, totals }: { plan: NonNullable<NutritionPlan>; totals: MacroTotals }) {
  const goals = {
    calories: numberValue(plan.daily_calories) || totals.calories,
    protein: numberValue(plan.protein_g) || totals.protein,
    carbs: numberValue(plan.carbs_g) || totals.carbs,
    fats: numberValue(plan.fat_g) || totals.fats,
  }
  const items = [
    { label: "Θερμίδες", value: totals.calories, target: goals.calories, unit: "kcal", color: "bg-foreground", valueClass: "text-[26px]" },
    { label: "Πρωτεΐνη", value: totals.protein, target: goals.protein, unit: "g", color: "bg-accent", valueClass: "text-[22px]" },
    { label: "Υδατάνθρακες", value: totals.carbs, target: goals.carbs, unit: "g", color: "bg-foreground", valueClass: "text-[22px]" },
    { label: "Λίπος", value: totals.fats, target: goals.fats, unit: "g", color: "bg-[#c8c8c4]", valueClass: "text-[22px]" },
  ]

  return <Card className="overflow-hidden rounded-[20px] border-border bg-card shadow-none">
    <CardContent className="flex flex-col gap-3 px-1 pb-4 pt-[18px]">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-[18px]">
        <b className="text-[15px]">Ημέρα · σύνολο vs στόχος</b>
        <span className="ml-auto inline-flex items-center gap-1 text-[12px] font-extrabold text-foreground">Υπολογισμός στόχων από βάρος & στόχο <ChevronRight className="h-[13px] w-[13px] stroke-[2.4]" /></span>
      </div>
      <div className="grid grid-cols-1 divide-y divide-border sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4">
        {items.map((item) => {
          const target = Math.max(0, item.target)
          const percentage = target ? Math.min(100, Math.round((item.value / target) * 100)) : 0
          const remaining = Math.max(0, target - item.value)
          const format = (value: number) => Math.round(value).toLocaleString("el-GR")
          return <div key={item.label} className="min-w-0 space-y-2 px-[18px] py-3 first:pt-1 sm:first:py-0 sm:[&:nth-child(2)]:py-0 xl:py-0 xl:[&:nth-child(2)]:py-0">
            <div className="flex items-baseline justify-between gap-2"><b className="text-[12px] text-[#6a6a6a]">{item.label}</b><span className="inline-flex h-[26px] items-center gap-1 rounded-[8px] border border-border px-2 text-[12px] font-extrabold"><span className="font-semibold text-[#8a8a8a]">στόχος</span>{format(target)}</span></div>
            <p className={`${item.valueClass} font-extrabold leading-none tracking-[-.5px]`}>{format(item.value)} <span className="text-[13px] font-semibold tracking-normal text-[#8a8a8a]">/ {format(target)} {item.unit}</span></p>
            <div className="h-2 overflow-hidden rounded-full bg-muted"><span className={`block h-full rounded-full ${item.color}`} style={{ width: `${percentage}%` }} /></div>
            <small className="block text-[11px] text-[#8a8a8a]">{remaining > 0 ? `υπολείπονται ${format(remaining)} ${item.unit}` : "έφτασες τον στόχο"} · {percentage}%</small>
          </div>
        })}
      </div>
    </CardContent>
  </Card>
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
  const [shoppingDays, setShoppingDays] = useState<3 | 7 | 14>(7)
  const storageKey = `shopping_checked_${plan.id}`
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [checkedPlanId, setCheckedPlanId] = useState<number | null>(null)
  const [equivalentFood, setEquivalentFood] = useState<NutritionFood | null>(null)
  const [equivalents, setEquivalents] = useState<FoodEquivalent[]>([])
  const [equivalentsLoading, setEquivalentsLoading] = useState(false)
  const [openMeal, setOpenMeal] = useState<string[]>(["meal-0"])
  const [mobileSection, setMobileSection] = useState<"meals" | "supplements" | "cycle">("meals")
  const [hasCycle, setHasCycle] = useState(false)

  useEffect(() => {
    try {
      setChecked(JSON.parse(window.localStorage.getItem(storageKey) || "{}"))
    } catch {
      setChecked({})
    }
    setCheckedPlanId(plan.id)
  }, [plan.id, storageKey])

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(`nutrition_open_meals_${plan.id}`) || "[\"meal-0\"]")
      setOpenMeal(Array.isArray(saved) ? saved.filter((value): value is string => typeof value === "string") : ["meal-0"])
    } catch {
      setOpenMeal(["meal-0"])
    }
  }, [plan.id])

  useEffect(() => {
    window.localStorage.setItem(`nutrition_open_meals_${plan.id}`, JSON.stringify(openMeal))
  }, [openMeal, plan.id])

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
  const shoppingGroups = useMemo(() => {
    const groups = new Map<string, ShoppingItem[]>()
    shoppingItems.forEach((item) => {
      const category = shoppingCategory(item.name)
      groups.set(category, [...(groups.get(category) || []), item])
    })
    return [...groups.entries()]
  }, [shoppingItems])
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
        try { image.src = new URL(resolveMediaUrl(item.imageUrl), window.location.origin).href } catch { image.src = resolveMediaUrl(item.imageUrl) }
        row.appendChild(image)
      } else {
        const placeholder = printDocument.createElement("span")
        placeholder.className = "food-placeholder"
        placeholder.textContent = item.name.trim().charAt(0).toLocaleUpperCase("el-GR")
        row.appendChild(placeholder)
      }
      quantity.className = "food-quantity"
      quantity.textContent = formatQuantityForDays(item, shoppingDays)
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
                  <FoodPhoto src={food.imageUrl} name={food.name} />
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

      <div className="space-y-5">
        <div className="flex items-end justify-between gap-4 px-1 sm:px-0">
          <div><h1 className="text-[24px] font-extrabold tracking-[-.4px] sm:text-[28px]">Πλάνο διατροφής</h1><p className="mt-1 text-[13px] text-muted-foreground sm:text-sm"><span className="hidden sm:inline">Τι τρως κάθε μέρα · </span>Ενημερώθηκε από τον coach · {formatPlanDate(plan.updated_at)}</p></div>
          <Button onClick={() => setShoppingOpen(true)} className="hidden h-[46px] rounded-full bg-foreground px-5 text-sm font-extrabold text-background hover:bg-foreground/90 sm:inline-flex"><ShoppingCart className="mr-2 h-[17px] w-[17px]" />Λίστα για ψώνια</Button>
        </div>

        <NutritionTargetsSummary plan={plan} totals={totals} />

        <section className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-[22px]">
          <div className="min-w-0">
            <div className="flex rounded-[14px] border border-border bg-card p-1 lg:hidden">
              {(["meals", "supplements"] as const).map((section) => <button key={section} type="button" onClick={() => setMobileSection(section)} className={`h-[38px] flex-1 rounded-[11px] text-[12px] font-extrabold ${mobileSection === section ? "bg-foreground text-background" : "text-muted-foreground"}`}>{section === "meals" ? "Γεύματα" : "Συμπληρώματα"}</button>)}
              {hasCycle && <button type="button" onClick={() => setMobileSection("cycle")} className={`h-[38px] flex-1 rounded-[11px] text-[12px] font-extrabold ${mobileSection === "cycle" ? "bg-foreground text-background" : "text-muted-foreground"}`}>Cycle</button>}
            </div>

            <div className={`${mobileSection === "meals" ? "mt-4" : "hidden"} lg:mt-0 lg:block`}>
              <div className="mb-3 hidden items-baseline justify-between px-1 lg:flex"><p className="text-[13px] font-extrabold tracking-[1px] text-muted-foreground">ΓΕΥΜΑΤΑ ΤΗΣ ΗΜΕΡΑΣ</p><p className="text-xs text-muted-foreground">Ίδιο πλάνο κάθε μέρα</p></div>
              {isWeeklyPlan && <div className="mb-3 flex gap-1 overflow-x-auto pb-1">{weeklyDays.map((day) => <Button key={day} size="sm" variant={selectedDay === day ? "default" : "ghost"} className="shrink-0 rounded-full" onClick={() => setSelectedDay(day)}>{["Κυρ", "Δευ", "Τρι", "Τετ", "Πεμ", "Παρ", "Σαβ"][day] || `Ημέρα ${day}`}</Button>)}</div>}
              <Accordion value={openMeal} onValueChange={setOpenMeal} className="space-y-3">
                {visibleMeals.map((meal, mealIndex) => {
                  const totalsForMeal = mealTotals(meal.foods)
                  const planIndex = plan.meals.indexOf(meal)
                  const name = mealTitle(meal, planIndex)
                  const itemValue = `meal-${mealIndex}`
                  if (!meal.foods.length) return <div key={meal.id ?? itemValue} className="flex items-center gap-3 rounded-[18px] border-[1.5px] border-dashed border-border p-3.5 sm:rounded-[20px] sm:px-[22px] sm:py-4"><div className="min-w-0 flex-1"><p className="text-[15px] font-extrabold sm:text-[17px]">{name}</p><p className="mt-0.5 text-[11px] text-muted-foreground sm:text-xs">Δεν έχει οριστεί ακόμα από τον coach</p></div><span className="text-sm font-bold text-muted-foreground">—</span></div>
                  return <AccordionItem key={meal.id ?? itemValue} value={itemValue} className="overflow-hidden rounded-[18px] border border-border bg-card shadow-none sm:rounded-[20px]">
                    <AccordionTrigger className="px-3.5 py-3.5 hover:bg-muted/30 hover:no-underline sm:px-[22px] sm:py-[18px]"><div className="flex min-w-0 flex-1 items-center gap-3 pr-2"><div className="min-w-0 flex-1 text-left"><p className="truncate text-[16px] font-extrabold sm:text-[18px]">{name}</p><p className="mt-0.5 text-[11px] text-muted-foreground sm:hidden">{Math.round(totalsForMeal.calories)} kcal · Π {Math.round(totalsForMeal.protein)} · Υ {Math.round(totalsForMeal.carbs)} · Λ {Math.round(totalsForMeal.fats)}</p><p className="mt-0.5 hidden text-xs text-muted-foreground sm:block">{meal.foods.length} τρόφιμα</p></div><div className="hidden items-center gap-1.5 sm:flex"><p className="mr-1 text-[18px] font-extrabold">{Math.round(totalsForMeal.calories)} <span className="text-xs font-semibold text-muted-foreground">kcal</span></p>{[["Π", totalsForMeal.protein], ["Υ", totalsForMeal.carbs], ["Λ", totalsForMeal.fats]].map(([label, value]) => <span key={String(label)} className="rounded-full bg-muted px-2 py-1 text-xs font-bold"><b className="mr-1 text-muted-foreground">{label}</b>{Math.round(Number(value))} g</span>)}</div></div></AccordionTrigger>
                    <AccordionContent className="border-t border-border/70 pb-0">
                      {meal.notes && <p className="mx-3.5 mt-3 rounded-xl bg-muted px-3 py-2 text-xs italic text-muted-foreground sm:mx-[22px]">{meal.notes}</p>}
                      <div className="hidden grid-cols-[minmax(0,1fr)_90px_70px_64px_64px_64px_96px] gap-2 px-[22px] pb-1 pt-3 text-[10px] font-extrabold tracking-[.8px] text-muted-foreground sm:grid"><span>ΤΡΟΦΙΜΟ</span><span className="text-right">ΠΟΣΟΤΗΤΑ</span><span className="text-right">KCAL</span><span className="text-right">ΠΡΩΤ.</span><span className="text-right">ΥΔΑΤ.</span><span className="text-right">ΛΙΠΟΣ</span></div>
                      <div className="px-3.5 sm:px-[22px]">{meal.foods.map((food, foodIndex) => { const quantity = parseQuantity(food.quantity ?? food.amount); const image = food.food_image ?? food.food_image_url ?? food.imageUrl ?? food.image_url; return <div key={food.id ?? `${food.name}-${foodIndex}`} className="grid grid-cols-[36px_minmax(0,1fr)_auto_30px] items-center gap-3 border-t border-border/60 py-[11px] first:border-t-0 sm:grid-cols-[minmax(0,1fr)_90px_70px_64px_64px_64px_96px] sm:gap-2 sm:py-[10px]"><div className="contents sm:flex sm:min-w-0 sm:items-center sm:gap-3"><FoodPhoto src={image} name={food.name} size="small" /><div className="min-w-0"><p className="truncate text-[14px] font-bold sm:text-[15px]">{food.name}</p><p className="mt-0.5 text-[11px] text-muted-foreground sm:hidden">Π {numberValue(food.protein_g).toLocaleString("el-GR", { maximumFractionDigits: 1 })} · Υ {numberValue(food.carbs_g).toLocaleString("el-GR", { maximumFractionDigits: 1 })} · Λ {numberValue(food.fat_g).toLocaleString("el-GR", { maximumFractionDigits: 1 })}</p></div></div><span className="text-right text-[14px] font-extrabold">{quantity.quantity === null ? "-" : formatQuantity({ key: "", name: "", quantity: quantity.quantity, unit: quantity.unit })}<small className="block text-[11px] font-medium text-muted-foreground sm:hidden">{Math.round(numberValue(food.calories))} kcal</small></span><span className="hidden text-right text-[14px] sm:block">{Math.round(numberValue(food.calories))}</span><span className="hidden text-right text-sm sm:block">{formatGrams(food.protein_g)}</span><span className="hidden text-right text-sm sm:block">{formatGrams(food.carbs_g)}</span><span className="hidden text-right text-sm sm:block">{formatGrams(food.fat_g)}</span><Button type="button" variant="outline" size="sm" className="h-[30px] w-[30px] rounded-full p-0 sm:w-auto sm:px-2.5" onClick={() => void showEquivalents(food)} aria-label={`Αλλαγή ${food.name}`}><ArrowRightLeft className="h-3.5 w-3.5" /><span className="ml-1 hidden sm:inline">Αλλαγή</span></Button></div> })}</div>
                      <div className="mt-1 hidden items-center gap-2 border-t border-border/70 bg-muted/40 px-[22px] py-3 text-xs text-muted-foreground sm:flex"><ArrowRightLeft className="h-3.5 w-3.5" />Με το «Αλλαγή» διαλέγεις ισοδύναμο τρόφιμο με τις ίδιες θερμίδες.</div>
                    </AccordionContent>
                  </AccordionItem>
                })}
              </Accordion>
              {plan.notes && <div className="mt-4 flex gap-2.5 rounded-[14px] bg-muted p-3 text-[13px] leading-[1.4] text-muted-foreground"><div><strong className="mb-0.5 block text-xs text-foreground">Σημείωση από τον coach</strong>{plan.notes}</div></div>}
            </div>
          </div>

          <aside className="space-y-4 lg:sticky lg:top-5">
            <div className={`${mobileSection === "supplements" ? "block" : "hidden"} lg:block`}><ClientSupplementsCard /></div>
            <div className={`${mobileSection === "cycle" ? "block" : "hidden"} lg:block`}><ClientCycleCard onPresenceChange={setHasCycle} /></div>
          </aside>
        </section>
        <div className="fixed inset-x-[14px] bottom-[88px] z-20 lg:hidden"><Button onClick={() => setShoppingOpen(true)} className="h-[52px] w-full rounded-full bg-foreground text-[15px] font-extrabold text-background shadow-[0_10px_30px_rgba(0,0,0,.2)] hover:bg-foreground/90"><ShoppingCart className="mr-2 h-[17px] w-[17px]" />Λίστα για ψώνια</Button></div>
      </div>

      {false && <>
      <Accordion className="lg:hidden">
        <AccordionItem value="daily-summary" className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <AccordionTrigger className="px-4 py-3 hover:bg-muted/30 hover:no-underline">
            <span className="flex min-w-0 flex-1 items-center justify-between gap-3 pr-2"><span className="font-semibold">Ημέρα - Σύνολο</span><span className="shrink-0 text-sm font-semibold text-foreground">{Math.round(totals.calories).toLocaleString("el-GR")} kcal</span></span>
          </AccordionTrigger>
          <AccordionContent className="border-t border-border/60 px-4 pb-4 pt-4">
            <div className="space-y-5">
              <div className="flex justify-center"><CalorieRing calories={totals.calories} /></div>
              <div className="space-y-4">
                <MacroProgress label="Πρωτεΐνη" value={totals.protein} calories={proteinCalories} totalCalories={macroCalories} progressClass="[&_[data-slot=progress-track]]:bg-blue-100 [&_[data-slot=progress-indicator]]:bg-blue-500" />
                <MacroProgress label="Υδατάνθρακες" value={totals.carbs} calories={carbsCalories} totalCalories={macroCalories} progressClass="[&_[data-slot=progress-track]]:bg-amber-100 [&_[data-slot=progress-indicator]]:bg-amber-500" />
                <MacroProgress label="Λίπος" value={totals.fats} calories={fatCalories} totalCalories={macroCalories} progressClass="[&_[data-slot=progress-track]]:bg-pink-100 [&_[data-slot=progress-indicator]]:bg-pink-500" />
              </div>
              <div className="rounded-xl bg-accent/10 p-4"><p className="text-sm text-muted-foreground">Ημερήσιο σύνολο</p><p className="mt-1 text-xl font-bold">{Math.round(totals.calories).toLocaleString("el-GR")} kcal</p></div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <Card className="hidden border-border bg-card shadow-sm lg:block">
        <CardContent className="p-8">
          <h2 className="mb-5 text-2xl font-bold">Ημέρα - Σύνολο</h2>
          <div className="grid grid-cols-[10rem_minmax(0,1fr)_15rem] items-center gap-6 xl:grid-cols-[12rem_minmax(0,1fr)_17rem]">
            <div className="flex justify-center">
              <CalorieRing calories={totals.calories} />
            </div>

            <div className="grid grid-cols-3 divide-x divide-border">
              <div className="pr-5"><MacroProgress label="Πρωτεΐνη" value={totals.protein} calories={proteinCalories} totalCalories={macroCalories} progressClass="[&_[data-slot=progress-track]]:bg-blue-100 [&_[data-slot=progress-indicator]]:bg-blue-500" /></div>
              <div className="px-5"><MacroProgress label="Υδατάνθρακες" value={totals.carbs} calories={carbsCalories} totalCalories={macroCalories} progressClass="[&_[data-slot=progress-track]]:bg-amber-100 [&_[data-slot=progress-indicator]]:bg-amber-500" /></div>
              <div className="pl-5"><MacroProgress label="Λίπος" value={totals.fats} calories={fatCalories} totalCalories={macroCalories} progressClass="[&_[data-slot=progress-track]]:bg-pink-100 [&_[data-slot=progress-indicator]]:bg-pink-500" /></div>
            </div>

            <div className="rounded-xl bg-accent/10 p-5">
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-full bg-accent/20 text-emerald-600">
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

      {null}

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
                  <div className="overflow-x-auto"><Table className="min-w-[560px]">
                    <TableBody className="[&_tr]:border-border/40">
                      {meal.foods.map((food, foodIndex) => {
                        const quantity = parseQuantity(food.quantity ?? food.amount)
                        const imageUrl = food.food_image ?? food.food_image_url ?? food.imageUrl ?? food.image_url

                        return (
                          <TableRow key={food.id ?? `${food.name}-${foodIndex}`} className="hover:bg-transparent">
                            <TableCell className="px-1 py-2">
                              <div className="flex min-w-[12rem] items-center gap-2">
                                {imageUrl ? (
                                  <img src={resolveMediaUrl(imageUrl)} alt="" className="h-9 w-9 shrink-0 rounded-md object-cover" />
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
                  </Table></div>
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

      </>}

      <Sheet open={shoppingOpen} onOpenChange={setShoppingOpen}>
        <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-[460px]" showCloseButton={false}>
          <SheetHeader className="gap-3 border-b border-[#ececea] px-7 pb-4 pt-[22px]">
            <div className="flex items-start justify-between gap-4"><div><SheetTitle className="text-xl font-extrabold">Λίστα για ψώνια</SheetTitle><p className="mt-1 text-xs text-muted-foreground">Από το πλάνο διατροφής σου</p></div><Button variant="outline" size="icon" className="h-10 w-10 rounded-xl" onClick={() => setShoppingOpen(false)} aria-label="Κλείσιμο"><X className="h-[18px] w-[18px]" /></Button></div>
            <div className="flex items-center justify-between gap-3"><span className="text-[13px] font-semibold">Για πόσες ημέρες;</span><div className="flex rounded-xl bg-muted p-[3px]">{([3, 7, 14] as const).map((days) => <button key={days} type="button" onClick={() => setShoppingDays(days)} className={`h-8 rounded-[9px] px-3.5 text-[13px] font-bold ${shoppingDays === days ? "bg-black text-accent" : "text-muted-foreground"}`}>{days}{days === 7 ? " ημέρες" : ""}</button>)}</div></div>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-7 py-[18px]">
            {shoppingGroups.map(([category, categoryItems]) => <section key={category} className="mb-4"><p className="pb-1.5 text-[11px] font-extrabold uppercase tracking-[1px] text-muted-foreground">{category}</p>{categoryItems.map((item) => { const isChecked = Boolean(checked[item.key]); return <label key={item.key} className={`flex cursor-pointer items-center gap-3 border-b border-border/70 py-[9px] ${isChecked ? "text-muted-foreground" : ""}`}><Checkbox checked={isChecked} onCheckedChange={(value) => setChecked((current) => ({ ...current, [item.key]: value === true }))} className="h-[22px] w-[22px] rounded-[7px] border-border data-[state=checked]:border-accent data-[state=checked]:bg-accent data-[state=checked]:text-accent-foreground" /><FoodPhoto src={item.imageUrl} name={item.name} size="small" /><span className={`min-w-0 flex-1 text-sm font-semibold ${isChecked ? "line-through" : ""}`}>{item.name}</span><span className="whitespace-nowrap text-[11px] text-muted-foreground">{item.quantity === null ? "χωρίς ποσότητα" : `${formatQuantity(item)} × ${shoppingDays}`}</span><span className="w-16 shrink-0 text-right text-sm font-extrabold">{formatQuantityForDays(item, shoppingDays)}</span></label> })}</section>)}
          </div>
          <SheetFooter className="gap-2.5 border-t border-[#ececea] px-7 pb-5 pt-4"><p className="text-[11px] leading-4 text-[#8a8a8a]">Ποσότητα = ημερήσια ποσότητα του πλάνου × ημέρες. {Object.values(checked).filter(Boolean).length} από {shoppingItems.length} στο καλάθι.</p><Button variant="lime" className="h-[50px] w-full rounded-full" onClick={exportShoppingList}><Download className="mr-2 h-4 w-4" />Εξαγωγή PDF</Button></SheetFooter>
        </SheetContent>
      </Sheet>
      {false && shoppingOpen && (
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
                      <img src={resolveMediaUrl(item.imageUrl)} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
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
    if (!user?.id) { setLoading(false); return }
    Promise.all([api.get<NutritionPlan>("/client/nutrition-plan"), api.get<Dashboard>("/client/dashboard")])
      .then(([nutrition, dashboard]) => { setPlan(nutrition); setPaymentApproved(dashboard.client?.subscriptionStatus === "active"); setUnreadNotifications(dashboard.unreadNotifications || 0); cacheOfflineData<NutritionOfflineCache>(user.id, "nutrition", { nutrition, dashboard }) })
      .catch((loadError) => {
        const cached = readOfflineData<NutritionOfflineCache>(user.id, "nutrition")
        if (cached) {
          setPlan(cached.nutrition); setPaymentApproved(cached.dashboard.client?.subscriptionStatus === "active"); setUnreadNotifications(cached.dashboard.unreadNotifications || 0)
          setError("Είσαι εκτός σύνδεσης. Εμφανίζεται το τελευταίο αποθηκευμένο πλάνο διατροφής.")
        } else setError(loadError instanceof Error ? loadError.message : "Δεν φορτώθηκε το πλάνο διατροφής.")
      })
      .finally(() => setLoading(false))
  }, [user?.id])

  return <ClientShell title="Διατροφή" user={user} logout={logout} paymentApproved={paymentApproved} unreadNotifications={unreadNotifications} active="nutrition"><main className="mx-auto max-w-6xl space-y-5 p-4 pb-28 sm:p-6 lg:p-8">{error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}{loading ? <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]"><div className="h-96 animate-pulse rounded-[20px] bg-muted" /><div className="h-64 animate-pulse rounded-[20px] bg-muted" /></div> : plan ? <ClientNutritionView plan={plan} /> : <Card className="rounded-[20px] border-border"><CardContent className="py-12 text-center text-muted-foreground">Ο coach ετοιμάζει το πλάνο διατροφής σου.</CardContent></Card>}</main></ClientShell>
}

export default function ClientNutritionPage() {
  return <ProtectedRoute allow="client-active"><ClientNutritionContent /></ProtectedRoute>
}
