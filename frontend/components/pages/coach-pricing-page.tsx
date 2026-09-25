"use client";

import { useEffect, useMemo, useState } from "react";
import { CoachShell } from "@/components/shell/coach-shell";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/lib/auth/auth-context";
import { api } from "@/lib/api/client";

interface PlanFeature {
  text: string;
  included: boolean;
}

interface PricingPlan {
  id?: number | string;
  name: string;
  badge?: string;
  description?: string;
  price: number | string;
  currency: string;
  period: string;
  themeColor: string;
  features: PlanFeature[];
  isActive: boolean;
  isPopular: boolean;
  sortOrder: number;
  pointsReward: number;
}

const emptyPlan: PricingPlan = {
  name: "Νέο Πλάνο",
  badge: "",
  description: "",
  price: 49,
  currency: "EUR",
  period: "Μηνιαίο",
  themeColor: "#EF4444",
  features: [
    { text: "Προπονητικό πλάνο", included: true },
    { text: "Διατροφικό πλάνο", included: true },
  ],
  isActive: true,
  isPopular: false,
  sortOrder: 0,
  pointsReward: 0,
};

function formatPlanPeriod(period?: string): string {
  if (!period) return "μήνα";
  const normalized = String(period).toLowerCase();
  if (normalized.includes("μηνια") || normalized.includes("monthly")) return "μήνα";
  return period;
}

function CoachPricingContent() {
  const { user, logout } = useAuth();
  const [plans, setPlans] = useState<PricingPlan[]>([]);
  const [selectedId, setSelectedId] = useState<number | string | null>(null);
  const [form, setForm] = useState<PricingPlan>(emptyPlan);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedPlan = useMemo(() => plans.find((plan) => plan.id === selectedId) || null, [plans, selectedId]);

  useEffect(() => {
    loadPlans();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedPlan) setForm(selectedPlan);
  }, [selectedPlan]);

  const loadPlans = async () => {
    try {
      const rows = await api.get<PricingPlan[]>("/pricing-plans/manage");
      setPlans(rows);
      if (rows.length) {
        setSelectedId(rows[0].id ?? null);
        setForm(rows[0]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Δεν φορτώθηκαν τα πλάνα.");
    }
  };

  const update = <K extends keyof PricingPlan>(key: K, value: PricingPlan[K]) => setForm((current) => ({ ...current, [key]: value }));

  const updateFeature = (index: number, key: keyof PlanFeature, value: string | boolean) => {
    update(
      "features",
      form.features.map((feature, featureIndex) => (featureIndex === index ? { ...feature, [key]: value } : feature)),
    );
  };

  const savePlan = async () => {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const payload = { ...form, price: Number(form.price || 0) };
      const saved = form.id ? await api.put<PricingPlan>(`/pricing-plans/${form.id}`, payload) : await api.post<PricingPlan>("/pricing-plans", payload);
      setMessage("Το πλάνο αποθηκεύτηκε.");
      await loadPlans();
      setSelectedId(saved.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Δεν αποθηκεύτηκε το πλάνο.");
    } finally {
      setSaving(false);
    }
  };

  const deletePlan = async () => {
    if (!form.id || !window.confirm("Να διαγραφεί αυτό το πλάνο;")) return;
    setSaving(true);
    try {
      await api.delete(`/pricing-plans/${form.id}`);
      setMessage("Το πλάνο διαγράφηκε.");
      setForm(emptyPlan);
      setSelectedId(null);
      await loadPlans();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Δεν διαγράφηκε το πλάνο.");
    } finally {
      setSaving(false);
    }
  };

  const newPlan = () => {
    setSelectedId(null);
    setForm({ ...emptyPlan, sortOrder: plans.length + 1 });
  };

  if (!["coach", "admin"].includes(user?.role || "")) {
    return <div className="grid min-h-screen place-items-center bg-slate-50 font-bold text-slate-500 dark:bg-slate-950 dark:text-slate-400">Δεν έχεις πρόσβαση σε αυτή τη σελίδα.</div>;
  }

  return (
    <CoachShell title="Πλάνα & Τιμές" user={user} logout={logout}>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Διαχείριση Πλάνων &amp; Τιμών</h2>
          <p className="mt-2 text-sm font-semibold text-slate-500 dark:text-slate-400">Δημιούργησε και διαχειρίσου τα πλάνα συνδρομής που βλέπουν οι πελάτες σου.</p>
        </div>
        <div className="flex gap-3">
          <Button onClick={newPlan} className="h-11 px-5 font-bold shadow-lg shadow-red-200 dark:shadow-none">
            + Νέο Πλάνο
          </Button>
          <Button
            variant="outline"
            className="h-11 px-5 font-bold text-slate-700 dark:text-slate-200"
            onClick={() => window.open("/pricing-plans", "_blank", "noopener,noreferrer")}
          >
            Δείτε τη σελίδα πελατών
          </Button>
        </div>
      </div>

      {message && <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200">{message}</div>}
      {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200">{error}</div>}

      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="grid gap-6 xl:grid-cols-[290px_1fr]">
          <aside className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
            <h3 className="font-bold">Πλάνα Συνδρομής</h3>
            <p className="mt-2 text-sm font-semibold text-slate-500 dark:text-slate-400">Σύρε για αλλαγή σειράς εμφάνισης</p>
            <div className="mt-5 space-y-3">
              {plans.map((plan) => (
                <Button
                  key={plan.id}
                  type="button"
                  variant="outline"
                  onClick={() => setSelectedId(plan.id ?? null)}
                  className={`h-12 w-full justify-between px-4 text-left font-bold ${
                    selectedId === plan.id
                      ? "border-red-500 bg-red-50 text-slate-950 dark:bg-red-500/10 dark:text-slate-50"
                      : "hover:border-red-200"
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: plan.themeColor }} />
                    {plan.name}
                  </span>
                  <span className="text-slate-400 dark:text-slate-500">⋮⋮</span>
                </Button>
              ))}
            </div>
          </aside>

          <div className="rounded-lg border border-slate-200 p-5 dark:border-slate-800">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-lg font-bold">Επεξεργασία Πλάνου</h3>
              <div className="flex items-center gap-3">
                <Label className="flex items-center gap-2 text-sm font-bold text-slate-600 dark:text-slate-400">
                  Ενεργό
                  <Checkbox checked={form.isActive} onCheckedChange={(checked) => update("isActive", checked === true)} className="h-5 w-5" />
                </Label>
                <Button
                  variant="outline"
                  onClick={deletePlan}
                  disabled={!form.id || saving}
                  className="h-10 px-4 text-sm font-bold text-slate-700 hover:border-red-200 hover:text-red-600 disabled:opacity-40 dark:text-slate-200"
                >
                  Διαγραφή
                </Button>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
              <div className="space-y-4">
                <Label className="flex flex-col items-start gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
                  Όνομα Πλάνου
                  <Input value={form.name} onChange={(event) => update("name", event.target.value)} />
                </Label>
                <Label className="flex flex-col items-start gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
                  Badge / Ετικέτα
                  <Input value={form.badge} onChange={(event) => update("badge", event.target.value)} placeholder="Πιο δημοφιλές" />
                </Label>
                <Label className="flex flex-col items-start gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
                  Περιγραφή
                  <Textarea value={form.description} onChange={(event) => update("description", event.target.value)} className="min-h-24" />
                </Label>
                <div className="grid grid-cols-3 gap-4">
                  <Label className="flex flex-col items-start gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
                    Τιμή
                    <Input type="number" value={form.price} onChange={(event) => update("price", event.target.value)} />
                  </Label>
                  <Label className="flex flex-col items-start gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
                    Νόμισμα
                    <Select value={form.currency} onValueChange={(value) => value && update("currency", value)}>
                      <SelectTrigger className="h-12 w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {["EUR", "USD", "GBP"].map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Label>
                  <Label className="flex flex-col items-start gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
                    Περίοδος
                    <Select value={form.period} onValueChange={(value) => value && update("period", value)}>
                      <SelectTrigger className="h-12 w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {["Μηνιαίο", "2 μήνες", "3 μήνες", "4 μήνες", "Ετήσιο"].map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Label>
                </div>
                <Label className="flex flex-col items-start gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
                  🎯 Πόντοι Reward
                  <Input type="number" min={0} value={form.pointsReward} onChange={(event) => update("pointsReward", Number(event.target.value) || 0)} placeholder="π.χ. 150" />
                  <span className="text-xs font-semibold text-slate-400">Οι πελάτες κερδίζουν αυτούς τους πόντους με κάθε πληρωμή.</span>
                </Label>
                <Label className="flex flex-col items-start gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
                  Χρώμα Θέματος
                  <div className="flex h-12 w-full items-center gap-3 rounded-md border border-slate-200 px-3 dark:border-slate-800">
                    {/* No shadcn equivalent for a native color swatch picker */}
                    <input type="color" value={form.themeColor} onChange={(event) => update("themeColor", event.target.value)} className="h-7 w-7 rounded border-0 p-0" />
                    <Input
                      value={form.themeColor}
                      onChange={(event) => update("themeColor", event.target.value)}
                      className="h-auto flex-1 border-none p-0 shadow-none focus-visible:ring-0"
                    />
                  </div>
                </Label>
                <Label className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
                  <Checkbox
                    checked={form.isPopular}
                    onCheckedChange={(checked) => update("isPopular", checked === true)}
                    className="h-5 w-5"
                  />
                  Δημοφιλές πλάνο (εμφανίζεται με ειδική ένδειξη στη σελίδα πελατών)
                </Label>
              </div>

              <div>
                <h4 className="mb-4 font-bold">Χαρακτηριστικά Πλάνου</h4>
                <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
                  {form.features.map((feature, index) => (
                    <div key={index} className="grid grid-cols-[28px_36px_1fr_34px] items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0 dark:border-slate-800">
                      <span className="text-slate-400 dark:text-slate-500">⋮⋮</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => updateFeature(index, "included", !feature.included)}
                        className={`h-9 w-9 text-lg font-bold ${feature.included ? "text-emerald-600 hover:text-emerald-600" : "text-red-600 hover:text-red-600"}`}
                      >
                        {feature.included ? "✓" : "×"}
                      </Button>
                      <Input
                        value={feature.text}
                        onChange={(event) => updateFeature(index, "text", event.target.value)}
                        className="h-10 border-transparent px-2 focus-visible:border-red-200"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => update("features", form.features.filter((_, i) => i !== index))}
                        className="h-9 w-9 text-slate-400 hover:text-red-600 dark:text-slate-500"
                      >
                        ×
                      </Button>
                    </div>
                  ))}
                </div>
                <Button
                  variant="outline"
                  onClick={() => update("features", [...form.features, { text: "Νέο χαρακτηριστικό", included: true }])}
                  className="mt-4 h-11 px-5 font-bold text-slate-700 hover:border-red-200 hover:text-red-600 dark:text-slate-200"
                >
                  + Προσθήκη χαρακτηριστικού
                </Button>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <Button onClick={savePlan} disabled={saving} className="h-11 px-6 font-bold disabled:bg-slate-400">
                {saving ? "Αποθήκευση..." : "Αποθήκευση Πλάνου"}
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[1fr_420px]">
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h3 className="font-bold">Προεπισκόπηση Κάρτας</h3>
          <div className="mt-5 rounded-lg border border-slate-200 p-4 dark:border-slate-800">
            <PlanPreview plan={form} />
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h3 className="font-bold">Συμβουλές</h3>
          <div className="mt-5 space-y-4 text-sm leading-6 text-slate-600 dark:text-slate-400">
            <p>• Σύρε τα πλάνα για να αλλάξεις τη σειρά εμφάνισης τους στη σελίδα εγγραφής.</p>
            <p>• Η ετικέτα &ldquo;Δημοφιλές πλάνο&rdquo; θα εμφανίζεται στο πλάνο που επιλέγεις.</p>
            <p>• Τα ανενεργά πλάνα δεν εμφανίζονται στη δημόσια σελίδα τιμών.</p>
          </div>
        </div>
      </section>
    </CoachShell>
  );
}

function PlanPreview({ plan }: { plan: PricingPlan }) {
  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <div className="relative rounded-lg border p-6 text-center" style={{ borderColor: plan.themeColor }}>
        {plan.badge && (
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-md px-3 py-1 text-xs font-bold text-white" style={{ backgroundColor: plan.themeColor }}>
            {plan.badge}
          </div>
        )}
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full text-2xl" style={{ backgroundColor: `${plan.themeColor}18`, color: plan.themeColor }}>
          🏆
        </div>
        <h4 className="mt-4 text-2xl font-bold" style={{ color: plan.themeColor }}>
          {plan.name || "Πλάνο"}
        </h4>
        <p className="mx-auto mt-3 max-w-56 text-sm leading-6 text-slate-600 dark:text-slate-400">{plan.description}</p>
        <div className="mt-5 text-3xl font-bold">
          €{plan.price}
          <span className="text-base font-bold text-slate-500 dark:text-slate-400"> /{formatPlanPeriod(plan.period)}</span>
        </div>
        <Button type="button" className="mt-5 h-11 w-full font-bold text-white hover:opacity-90" style={{ backgroundColor: plan.themeColor }}>
          Επιλέγω {plan.name}
        </Button>
      </div>
      <div className="space-y-4 py-3">
        {plan.features.map((feature, index) => (
          <div key={index} className="flex items-center gap-4 text-sm font-semibold text-slate-700 dark:text-slate-200">
            <span className={feature.included ? "text-emerald-600" : "text-red-600"}>{feature.included ? "✓" : "×"}</span>
            {feature.text}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CoachPricingPage() {
  return (
    <ProtectedRoute>
      <CoachPricingContent />
    </ProtectedRoute>
  );
}
