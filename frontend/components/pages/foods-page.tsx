"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, Plus, Pencil, Trash2, ImageOff, Import } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { CoachShell } from "@/components/shell/coach-shell";
import PaginationControls from "@/components/shared/pagination-controls";
import { useAuth } from "@/lib/auth/auth-context";
import { api } from "@/lib/api/client";
import { resolveMediaUrl } from "@/lib/media";
import { cn } from "@/lib/utils";

const PAGE_LIMIT = 24;
const CUSTOM_FILTER = "__custom__";

const CATEGORY_TABS: { value: string; emoji: string; label: string }[] = [
  { value: "", emoji: "", label: "Όλα" },
  { value: "meat", emoji: "🥩", label: "Κρέατα" },
  { value: "fish", emoji: "🐟", label: "Ψάρια" },
  { value: "eggs", emoji: "🥚", label: "Αυγά" },
  { value: "dairy", emoji: "🥛", label: "Γαλακτοκομικά" },
  { value: "grains", emoji: "🌾", label: "Δημητριακά" },
  { value: "vegetables", emoji: "🥦", label: "Λαχανικά" },
  { value: "fruits", emoji: "🍎", label: "Φρούτα" },
  { value: "legumes", emoji: "🫘", label: "Όσπρια" },
  { value: "nuts", emoji: "🥜", label: "Ξηροί Καρποί" },
  { value: "oils", emoji: "🫒", label: "Έλαια" },
  { value: CUSTOM_FILTER, emoji: "➕", label: "Custom" },
];

const CATEGORY_OPTIONS: { value: string; label: string }[] = [
  { value: "meat", label: "🥩 Κρέατα" },
  { value: "fish", label: "🐟 Ψάρια" },
  { value: "eggs", label: "🥚 Αυγά" },
  { value: "dairy", label: "🥛 Γαλακτοκομικά" },
  { value: "grains", label: "🌾 Δημητριακά" },
  { value: "vegetables", label: "🥦 Λαχανικά" },
  { value: "fruits", label: "🍎 Φρούτα" },
  { value: "legumes", label: "🫘 Όσπρια" },
  { value: "nuts", label: "🥜 Ξηροί Καρποί" },
  { value: "oils", label: "🫒 Έλαια" },
  { value: "other", label: "Άλλο" },
];

const CATEGORY_LABEL_MAP: Record<string, string> = Object.fromEntries(
  CATEGORY_OPTIONS.map((option) => [option.value, option.label]),
);

const SERVING_UNIT_OPTIONS: { value: string; label: string }[] = [
  { value: "g", label: "γραμμάρια (g)" },
  { value: "ml", label: "χιλιοστόλιτρα (ml)" },
  { value: "piece", label: "τεμάχιο" },
  { value: "tbsp", label: "κ.σ. (tbsp)" },
  { value: "cup", label: "φλιτζάνι (cup)" },
];

interface Food {
  id: number | string;
  nameGr: string;
  nameEn: string;
  category: string;
  caloriesPer100g: number | string | null;
  proteinPer100g: number | string | null;
  carbsPer100g: number | string | null;
  fatsPer100g: number | string | null;
  fiberPer100g: number | string | null;
  servingSize: number | string | null;
  servingUnit: string;
  imageUrl: string;
  source: string;
  isActive: boolean;
}

interface FoodsResponse {
  items: Food[];
  total: number;
  page: number;
  limit: number;
}

interface FoodForm {
  nameGr: string;
  nameEn: string;
  category: string;
  caloriesPer100g: string;
  proteinPer100g: string;
  carbsPer100g: string;
  fatsPer100g: string;
  fiberPer100g: string;
  servingSize: string;
  servingUnit: string;
  imageUrl: string;
}

const emptyForm: FoodForm = {
  nameGr: "",
  nameEn: "",
  category: "other",
  caloriesPer100g: "",
  proteinPer100g: "",
  carbsPer100g: "",
  fatsPer100g: "",
  fiberPer100g: "",
  servingSize: "100",
  servingUnit: "g",
  imageUrl: "",
};

function foodToForm(food: Food): FoodForm {
  return {
    nameGr: food.nameGr || "",
    nameEn: food.nameEn || "",
    category: food.category || "other",
    caloriesPer100g: food.caloriesPer100g != null ? String(food.caloriesPer100g) : "",
    proteinPer100g: food.proteinPer100g != null ? String(food.proteinPer100g) : "",
    carbsPer100g: food.carbsPer100g != null ? String(food.carbsPer100g) : "",
    fatsPer100g: food.fatsPer100g != null ? String(food.fatsPer100g) : "",
    fiberPer100g: food.fiberPer100g != null ? String(food.fiberPer100g) : "",
    servingSize: food.servingSize != null ? String(food.servingSize) : "100",
    servingUnit: food.servingUnit || "g",
    imageUrl: food.imageUrl || "",
  };
}

interface UnsplashResult {
  id: string;
  imageUrl: string;
  fullImageUrl: string;
  credit: string;
}

interface OpenFoodFactsResult {
  code: string;
  name: string;
  brand: string;
  imageUrl: string;
  caloriesPer100g: number | null;
  proteinPer100g: number | null;
  carbsPer100g: number | null;
  fatsPer100g: number | null;
  fiberPer100g: number | null;
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function FoodsContent() {
  const { user, logout } = useAuth();

  const [items, setItems] = useState<Food[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [page, setPage] = useState(1);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<number | string | null>(null);
  const [form, setForm] = useState<FoodForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formMessage, setFormMessage] = useState("");

  const [unsplashQuery, setUnsplashQuery] = useState("");
  const [unsplashResults, setUnsplashResults] = useState<UnsplashResult[]>([]);
  const [unsplashLoading, setUnsplashLoading] = useState(false);
  const [unsplashMessage, setUnsplashMessage] = useState("");

  const [offOpen, setOffOpen] = useState(false);
  const [offQuery, setOffQuery] = useState("");
  const [offResults, setOffResults] = useState<OpenFoodFactsResult[]>([]);
  const [offLoading, setOffLoading] = useState(false);
  const [offMessage, setOffMessage] = useState("");

  // Debounce search input by 300ms before it drives any fetch.
  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedSearch(search), 300);
    return () => window.clearTimeout(timeoutId);
  }, [search]);

  // Reset to page 1 whenever the filters actually change.
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, categoryFilter]);

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    setError("");

    const params = new URLSearchParams();
    if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
    if (categoryFilter && categoryFilter !== CUSTOM_FILTER) params.set("category", categoryFilter);
    if (categoryFilter === CUSTOM_FILTER) params.set("source", "custom");
    params.set("page", String(page));
    params.set("limit", String(PAGE_LIMIT));

    api
      .get<FoodsResponse>(`/foods?${params.toString()}`)
      .then((data) => {
        if (ignore) return;
        setItems(data.items);
        setTotal(data.total);
      })
      .catch((err) => {
        if (!ignore) setError(getErrorMessage(err, "Δεν φορτώθηκαν τα τρόφιμα."));
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [debouncedSearch, categoryFilter, page]);

  const openCreate = () => {
    setIsCreating(true);
    setEditingId(null);
    setForm(emptyForm);
    setFormMessage("");
    setUnsplashResults([]);
    setUnsplashMessage("");
    setUnsplashQuery("");
    setDialogOpen(true);
  };

  const openEdit = (food: Food) => {
    setIsCreating(false);
    setEditingId(food.id);
    setForm(foodToForm(food));
    setFormMessage("");
    setUnsplashResults([]);
    setUnsplashMessage("");
    setUnsplashQuery(food.nameEn || food.nameGr);
    setDialogOpen(true);
  };

  const updateForm = <K extends keyof FoodForm>(field: K, value: FoodForm[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const saveFood = async () => {
    if (!form.nameGr.trim()) {
      setFormMessage("Το όνομα (Ελληνικά) είναι υποχρεωτικό.");
      return;
    }

    setSaving(true);
    setFormMessage("");

    const payload = {
      nameGr: form.nameGr.trim(),
      nameEn: form.nameEn.trim() || null,
      category: form.category || "other",
      caloriesPer100g: form.caloriesPer100g === "" ? null : Number(form.caloriesPer100g),
      proteinPer100g: form.proteinPer100g === "" ? null : Number(form.proteinPer100g),
      carbsPer100g: form.carbsPer100g === "" ? null : Number(form.carbsPer100g),
      fatsPer100g: form.fatsPer100g === "" ? null : Number(form.fatsPer100g),
      fiberPer100g: form.fiberPer100g === "" ? null : Number(form.fiberPer100g),
      servingSize: form.servingSize === "" ? 100 : Number(form.servingSize),
      servingUnit: form.servingUnit || "g",
      imageUrl: form.imageUrl.trim() || null,
    };

    try {
      if (isCreating) {
        const created = await api.post<Food>("/foods", payload);
        setItems((current) => [created, ...current].slice(0, PAGE_LIMIT));
        setTotal((current) => current + 1);
      } else if (editingId != null) {
        const updated = await api.put<Food>(`/foods/${editingId}`, payload);
        setItems((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      }
      setDialogOpen(false);
    } catch (err) {
      setFormMessage(getErrorMessage(err, "Δεν αποθηκεύτηκαν οι αλλαγές."));
    } finally {
      setSaving(false);
    }
  };

  const deleteFood = async (food: Food) => {
    if (!window.confirm(`Να διαγραφεί το "${food.nameGr}";`)) return;
    try {
      await api.delete(`/foods/${food.id}`);
      const remainingOnPage = items.length - 1;
      if (remainingOnPage === 0 && page > 1) {
        setPage((current) => current - 1);
      } else {
        setItems((current) => current.filter((item) => item.id !== food.id));
        setTotal((current) => Math.max(0, current - 1));
      }
    } catch (err) {
      setError(getErrorMessage(err, "Δεν έγινε διαγραφή του τροφίμου."));
    }
  };

  const searchUnsplash = async () => {
    const query = (unsplashQuery || form.nameEn).trim();
    if (!query) return;
    setUnsplashLoading(true);
    setUnsplashMessage("");
    try {
      const data = await api.get<{ results: UnsplashResult[]; message?: string }>(
        `/foods/search/unsplash?q=${encodeURIComponent(query)}`,
      );
      setUnsplashResults(data.results || []);
      if (data.message) setUnsplashMessage(data.message);
      else if (!data.results?.length) setUnsplashMessage("Δεν βρέθηκαν φωτογραφίες.");
    } catch (err) {
      setUnsplashMessage(getErrorMessage(err, "Η αναζήτηση φωτογραφίας απέτυχε."));
    } finally {
      setUnsplashLoading(false);
    }
  };

  const searchOpenFoodFacts = async () => {
    if (!offQuery.trim()) return;
    setOffLoading(true);
    setOffMessage("");
    try {
      const data = await api.get<{ results: OpenFoodFactsResult[] }>(
        `/foods/search/openfoodfacts?q=${encodeURIComponent(offQuery.trim())}`,
      );
      setOffResults(data.results || []);
      if (!data.results?.length) setOffMessage("Δεν βρέθηκαν προϊόντα.");
    } catch (err) {
      setOffMessage(getErrorMessage(err, "Η αναζήτηση στο Open Food Facts απέτυχε. Δοκίμασε ξανά."));
    } finally {
      setOffLoading(false);
    }
  };

  const importFromOpenFoodFacts = (result: OpenFoodFactsResult) => {
    setOffOpen(false);
    setIsCreating(true);
    setEditingId(null);
    setForm({
      nameGr: result.name || "",
      nameEn: result.name || "",
      category: "other",
      caloriesPer100g: result.caloriesPer100g != null ? String(result.caloriesPer100g) : "",
      proteinPer100g: result.proteinPer100g != null ? String(result.proteinPer100g) : "",
      carbsPer100g: result.carbsPer100g != null ? String(result.carbsPer100g) : "",
      fatsPer100g: result.fatsPer100g != null ? String(result.fatsPer100g) : "",
      fiberPer100g: result.fiberPer100g != null ? String(result.fiberPer100g) : "",
      servingSize: "100",
      servingUnit: "g",
      imageUrl: result.imageUrl || "",
    });
    setFormMessage("Έλεγξε τα στοιχεία που εισήχθησαν από το Open Food Facts πριν αποθηκεύσεις.");
    setUnsplashResults([]);
    setUnsplashMessage("");
    setUnsplashQuery(result.name || "");
    setDialogOpen(true);
  };

  const activeCategoryLabel = useMemo(
    () => CATEGORY_TABS.find((tab) => tab.value === categoryFilter)?.label || "Όλα",
    [categoryFilter],
  );

  return (
    <CoachShell title="Βιβλιοθήκη Τροφίμων" user={user} logout={logout}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold dark:text-slate-50">Βιβλιοθήκη Τροφίμων</h1>
          <Badge variant="secondary" className="text-sm font-bold">
            {total}
          </Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" className="gap-2 font-bold" onClick={() => setOffOpen(true)}>
            <Import className="h-4 w-4" />
            Εισαγωγή από Open Food Facts
          </Button>
          <Button type="button" className="gap-2 font-bold" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Νέο Τρόφιμο
          </Button>
        </div>
      </div>

      <div className="flex h-12 items-center rounded-lg border border-slate-200 bg-white px-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <Search className="mr-3 h-4 w-4 shrink-0 text-slate-400" />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Αναζήτηση τροφίμου..."
          className="h-auto border-none bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
        />
      </div>

      <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
        {CATEGORY_TABS.map((tab) => (
          <button
            key={tab.value || "all"}
            type="button"
            onClick={() => setCategoryFilter(tab.value)}
            className={cn(
              "shrink-0 whitespace-nowrap rounded-full border px-3.5 py-2 text-sm font-bold transition-colors",
              categoryFilter === tab.value
                ? "border-red-500 bg-red-500 text-white"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300",
            )}
          >
            {tab.emoji ? `${tab.emoji} ${tab.label}` : tab.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="mt-5 rounded-lg border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200">
          {error}
        </div>
      )}

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {items.map((food) => (
          <Card key={food.id} className="group overflow-hidden p-0 transition-transform hover:scale-105">
            <FoodCardImage imageUrl={food.imageUrl} name={food.nameGr} />
            <div className="space-y-1 p-2">
              <div className="flex items-center justify-between gap-1">
                <span className="truncate text-sm font-semibold" title={food.nameGr}>
                  {food.nameGr}
                </span>
                {food.source === "custom" && (
                  <Badge variant="outline" className="shrink-0 px-1 py-0 text-[9px]">
                    Custom
                  </Badge>
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                {food.caloriesPer100g != null ? Number(food.caloriesPer100g) : "—"} kcal
              </div>
              <div className="flex items-center justify-between gap-1">
                <div className="flex items-center gap-1.5 text-xs font-medium">
                  <span className="text-blue-600 dark:text-blue-400">P:{food.proteinPer100g ?? "—"}</span>
                  <span className="text-yellow-600 dark:text-yellow-500">C:{food.carbsPer100g ?? "—"}</span>
                  <span className="text-red-600 dark:text-red-400">F:{food.fatsPer100g ?? "—"}</span>
                </div>
                <div className="flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                  <Button type="button" variant="ghost" size="icon-sm" onClick={() => openEdit(food)} aria-label="Edit">
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-500/10"
                    onClick={() => deleteFood(food)}
                    aria-label="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        ))}
        {!loading && !items.length && (
          <p className="col-span-full py-10 text-center text-sm font-semibold text-slate-500 dark:text-slate-400">
            Δεν βρέθηκαν τρόφιμα στην κατηγορία &quot;{activeCategoryLabel}&quot;.
          </p>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between gap-4 overflow-hidden rounded-lg border border-slate-200 bg-white px-6 py-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <span className="text-sm text-slate-600 dark:text-slate-400">
          {total === 0
            ? "Δεν υπάρχουν τρόφιμα"
            : `Εμφανίζονται ${(page - 1) * PAGE_LIMIT + 1} έως ${Math.min(page * PAGE_LIMIT, total)} από ${total} τρόφιμα`}
        </span>
        <PaginationControls
          totalItems={total}
          pageSize={PAGE_LIMIT}
          currentPage={page}
          onPageSizeChange={() => {}}
          onPageChange={setPage}
          itemLabel="τρόφιμα"
          variant="pages"
        />
      </div>

      {/* Add/Edit Food Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] w-full max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isCreating ? "Νέο Τρόφιμο" : "Επεξεργασία Τροφίμου"}</DialogTitle>
            <DialogDescription>Μακροθρεπτικά ανά 100g. Θα χρησιμοποιηθεί στο Πλάνο Διατροφής.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <LabeledInput label="Όνομα (Ελληνικά)" required value={form.nameGr} onChange={(value) => updateForm("nameGr", value)} />
              <LabeledInput label="Όνομα (Αγγλικά)" value={form.nameEn} onChange={(value) => updateForm("nameEn", value)} placeholder="π.χ. Chicken Breast" />
            </div>

            <label className="block">
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Κατηγορία</span>
              <Select value={form.category} onValueChange={(value) => value && updateForm("category", value)}>
                <SelectTrigger className="mt-2 h-11 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>

            <div>
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Ανά 100g</span>
              <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-5">
                <LabeledInput label="Θερμίδες (kcal)" type="number" value={form.caloriesPer100g} onChange={(value) => updateForm("caloriesPer100g", value)} compact />
                <LabeledInput label="Πρωτεΐνη (g)" type="number" value={form.proteinPer100g} onChange={(value) => updateForm("proteinPer100g", value)} compact />
                <LabeledInput label="Υδατάνθρακες (g)" type="number" value={form.carbsPer100g} onChange={(value) => updateForm("carbsPer100g", value)} compact />
                <LabeledInput label="Λίπη (g)" type="number" value={form.fatsPer100g} onChange={(value) => updateForm("fatsPer100g", value)} compact />
                <LabeledInput label="Φυτικές ίνες (g)" type="number" value={form.fiberPer100g} onChange={(value) => updateForm("fiberPer100g", value)} compact />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <LabeledInput label="Μέγεθος μερίδας" type="number" value={form.servingSize} onChange={(value) => updateForm("servingSize", value)} />
              <label className="block">
                <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Μονάδα</span>
                <Select value={form.servingUnit} onValueChange={(value) => value && updateForm("servingUnit", value)}>
                  <SelectTrigger className="mt-2 h-11 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SERVING_UNIT_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800">
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Φωτογραφία</span>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Input
                  value={unsplashQuery}
                  onChange={(event) => setUnsplashQuery(event.target.value)}
                  placeholder="Όρος αναζήτησης (π.χ. name_en)"
                  className="h-10 max-w-xs flex-1"
                />
                <Button type="button" variant="outline" onClick={searchUnsplash} disabled={unsplashLoading} className="h-10 gap-2 font-bold">
                  <Search className="h-4 w-4" />
                  {unsplashLoading ? "Αναζήτηση..." : "Αναζήτηση φωτογραφίας"}
                </Button>
              </div>
              {unsplashMessage && <p className="mt-2 text-xs font-semibold text-slate-500 dark:text-slate-400">{unsplashMessage}</p>}
              {unsplashResults.length > 0 && (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {unsplashResults.map((result) => (
                    <button
                      key={result.id}
                      type="button"
                      onClick={() => updateForm("imageUrl", result.fullImageUrl || result.imageUrl)}
                      className={cn(
                        "relative h-24 overflow-hidden rounded-md border-2",
                        form.imageUrl === (result.fullImageUrl || result.imageUrl) ? "border-red-500" : "border-transparent",
                      )}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={result.imageUrl} alt={result.credit} className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
              <LabeledInput
                label="Ή URL φωτογραφίας"
                value={form.imageUrl}
                onChange={(value) => updateForm("imageUrl", value)}
                placeholder="https://..."
                className="mt-3"
              />
              {form.imageUrl && (
                <div className="mt-3 h-24 w-24 overflow-hidden rounded-md bg-slate-200 dark:bg-slate-700">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={resolveMediaUrl(form.imageUrl)} alt="" className="h-full w-full object-cover" />
                </div>
              )}
            </div>

            {formMessage && (
              <div className="rounded-md bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800 dark:bg-amber-500/10 dark:text-amber-400">
                {formMessage}
              </div>
            )}

            <div className="flex justify-end border-t border-slate-200 pt-4 dark:border-slate-800">
              <Button onClick={saveFood} disabled={saving} className="h-11 px-6 font-bold">
                {saving ? "Αποθήκευση..." : isCreating ? "Προσθήκη Τροφίμου" : "Αποθήκευση"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Import from Open Food Facts Dialog */}
      <Dialog open={offOpen} onOpenChange={setOffOpen}>
        <DialogContent className="max-h-[85vh] w-full max-w-xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Εισαγωγή από Open Food Facts</DialogTitle>
            <DialogDescription>Βρες ένα προϊόν και εισήγαγε τα μακροθρεπτικά του στη φόρμα.</DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Input
              value={offQuery}
              onChange={(event) => setOffQuery(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && searchOpenFoodFacts()}
              placeholder="π.χ. chicken breast"
              className="h-11 flex-1"
            />
            <Button type="button" onClick={searchOpenFoodFacts} disabled={offLoading} className="h-11 gap-2 font-bold">
              <Search className="h-4 w-4" />
              {offLoading ? "Αναζήτηση..." : "Αναζήτηση"}
            </Button>
          </div>
          {offMessage && <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">{offMessage}</p>}
          <div className="space-y-2">
            {offResults.map((result) => (
              <div
                key={result.code}
                className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-800"
              >
                <span className="h-14 w-14 shrink-0 overflow-hidden rounded-md bg-slate-100 dark:bg-slate-800">
                  {result.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={result.imageUrl} alt="" className="h-full w-full object-cover" />
                  ) : null}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-bold">{result.name}</div>
                  <div className="truncate text-xs text-slate-500 dark:text-slate-400">
                    {result.brand ? `${result.brand} · ` : ""}
                    {result.caloriesPer100g ?? "—"} kcal · P:{result.proteinPer100g ?? "—"} C:{result.carbsPer100g ?? "—"} F:
                    {result.fatsPer100g ?? "—"}
                  </div>
                </div>
                <Button type="button" variant="outline" size="sm" className="shrink-0 font-bold" onClick={() => importFromOpenFoodFacts(result)}>
                  Εισαγωγή
                </Button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </CoachShell>
  );
}

function FoodCardImage({ imageUrl, name }: { imageUrl: string; name: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [imageUrl]);

  if (!imageUrl || failed) {
    return (
      <div className="flex h-28 items-center justify-center bg-slate-100 dark:bg-slate-800">
        <ImageOff className="h-8 w-8 text-slate-300 dark:text-slate-600" />
      </div>
    );
  }

  return (
    <div className="h-28 bg-slate-100 dark:bg-slate-800">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={resolveMediaUrl(imageUrl)}
        alt={name}
        className="h-full w-full object-cover"
        onError={() => setFailed(true)}
      />
    </div>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
  type = "text",
  required = false,
  placeholder,
  compact = false,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
  compact?: boolean;
  className?: string;
}) {
  return (
    <Label className={cn("block", className)}>
      <span className={cn("font-bold text-slate-700 dark:text-slate-200", compact ? "text-xs" : "text-sm")}>
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>
      <Input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={cn("mt-2", compact ? "h-9 text-sm" : "h-11")}
      />
    </Label>
  );
}

export default function FoodsPage() {
  return (
    <ProtectedRoute allow="coach">
      <FoodsContent />
    </ProtectedRoute>
  );
}
