"use client";

import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { LineChart } from "@tremor/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { ClientShell } from "@/components/shell/client-shell";
import WorkoutProgramView, { type TrainingProgram } from "@/components/shared/workout-program-view";
import { useAuth } from "@/lib/auth/auth-context";
import { api } from "@/lib/api/client";

const mealLabels: Record<string, string> = {
  breakfast: "Πρωινό",
  lunch: "Μεσημεριανό",
  snack: "Σνακ",
  dinner: "Βραδινό",
  other: "Άλλο",
};

interface NutritionFood {
  id: number | string;
  food_name?: string;
  quantity?: string;
  calories?: number | string;
}

interface NutritionMeal {
  id: number | string;
  title?: string;
  meal_type?: string;
  notes?: string;
  foods: NutritionFood[];
}

interface NutritionPlan {
  title?: string;
  daily_calories?: number | string;
  protein_g?: number | string;
  carbs_g?: number | string;
  fat_g?: number | string;
  notes?: string;
  meals?: NutritionMeal[];
}

interface ProgressRow {
  weight_kg?: number | string;
  submitted_at?: string;
  [key: string]: unknown;
}

interface WeeklyUpdateInfo {
  available?: boolean;
  alreadySubmitted?: boolean;
  weekStart?: string;
  schedule?: unknown;
}

interface DashboardData {
  paymentApproved?: boolean;
  training?: TrainingProgram | null;
  nutrition?: NutritionPlan | null;
  progress?: ProgressRow[];
  weeklyUpdate?: WeeklyUpdateInfo;
  unreadNotifications?: number;
  [key: string]: unknown;
}

interface WeeklyForm {
  weightKg: string;
  trainingScore: string;
  nutritionScore: string;
  notes: string;
  photos: File[];
}

const initialWeeklyForm: WeeklyForm = {
  weightKg: "",
  trainingScore: "5",
  nutritionScore: "5",
  notes: "",
  photos: [],
};

function getErrorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

function Alert({ children, tone }: { children: ReactNode; tone: "red" | "green" }) {
  const className =
    tone === "red"
      ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
      : "border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950/40 dark:text-green-200";
  return <div className={`mb-5 rounded-lg border px-5 py-4 text-sm font-bold ${className}`}>{children}</div>;
}

function StatusCard({ title, value }: { title: string; value: string }) {
  return (
    <Card className="min-h-[128px] p-5 shadow-sm">
      <div className="text-sm font-bold text-slate-500 dark:text-slate-400">{title}</div>
      <div className="mt-4 text-xl font-black leading-7">{value}</div>
    </Card>
  );
}

function WeeklyUpdateCard({ data, onOpen }: { data?: WeeklyUpdateInfo; onOpen: () => void }) {
  const disabled = !data?.available;
  const statusLabel = data?.available ? "Ανοιχτό σήμερα" : data?.alreadySubmitted ? "Υποβλήθηκε" : "Κλειστό";
  return (
    <Card className="min-h-[128px] p-5 shadow-sm">
      <div className="text-sm font-bold text-slate-500 dark:text-slate-400">Εβδομαδιαίο Update</div>
      <div className="mt-3 text-xl font-black">{statusLabel}</div>
      <Button disabled={disabled} onClick={onOpen} className="mt-4 h-11 w-full font-black">
        Συμπλήρωση
      </Button>
    </Card>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center font-bold text-slate-500 dark:border-slate-700 dark:bg-slate-950">
      {text}
    </div>
  );
}

function Macro({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md bg-slate-50 p-3 text-center dark:bg-slate-950">
      <div className="text-xs font-bold text-slate-500">{label}</div>
      <div className="mt-1 font-black">{value}</div>
    </div>
  );
}

function NutritionView({ nutrition }: { nutrition?: NutritionPlan | null }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl font-black">Πρόγραμμα Διατροφής</CardTitle>
      </CardHeader>
      <CardContent>
        {nutrition ? (
          <div>
            <div className="grid grid-cols-4 gap-3">
              <Macro label="Θερμίδες" value={nutrition.daily_calories || "-"} />
              <Macro label="Πρωτεΐνη" value={`${nutrition.protein_g || "-"}g`} />
              <Macro label="Υδατ/κες" value={`${nutrition.carbs_g || "-"}g`} />
              <Macro label="Λίπη" value={`${nutrition.fat_g || "-"}g`} />
            </div>
            {nutrition.notes && (
              <div className="mt-4 rounded-md bg-slate-50 p-4 text-sm font-semibold text-slate-600 dark:bg-slate-950 dark:text-slate-300">
                {nutrition.notes}
              </div>
            )}
            <div className="mt-5 space-y-3">
              {(nutrition.meals || []).map((meal) => (
                <div key={meal.id} className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
                  <h3 className="font-black">{meal.title || mealLabels[meal.meal_type || "other"] || "Γεύμα"}</h3>
                  {meal.notes && <div className="mt-1 text-sm font-semibold text-slate-500">{meal.notes}</div>}
                  <div className="mt-3 space-y-2">
                    {meal.foods.map((food) => (
                      <div
                        key={food.id}
                        className="flex items-center justify-between rounded-md bg-slate-50 p-3 text-sm dark:bg-slate-950"
                      >
                        <span className="font-bold">
                          {food.food_name} · {food.quantity || "-"}
                        </span>
                        <span className="text-slate-500">{food.calories || "-"} kcal</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <EmptyState text="Ο coach δεν έχει δημιουργήσει ακόμα πρόγραμμα διατροφής." />
        )}
      </CardContent>
    </Card>
  );
}

function WeightChart({ rows }: { rows: ProgressRow[] }) {
  const data = rows.map((row) => ({
    date: row.submitted_at ? new Date(String(row.submitted_at)).toLocaleDateString("el-GR") : "",
    "Βάρος (kg)": Number(row.weight_kg) || 0,
  }));

  return (
    <LineChart
      className="h-72"
      data={data}
      index="date"
      categories={["Βάρος (kg)"]}
      colors={["blue"]}
      showLegend={false}
      showAnimation
    />
  );
}

function ScoreField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <Select value={value} onValueChange={(next) => onChange(String(next))}>
        <SelectTrigger className="mt-2 w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {[1, 2, 3, 4, 5].map((score) => (
            <SelectItem key={score} value={String(score)}>
              {score}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function ClientDashboardContent() {
  const { user, logout } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [weeklyOpen, setWeeklyOpen] = useState(false);
  const [weeklyForm, setWeeklyForm] = useState<WeeklyForm>(initialWeeklyForm);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadDashboard = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await api.get<DashboardData>("/client-dashboard");
      setData(result);
    } catch (err) {
      setError(getErrorMessage(err, "Δεν φορτώθηκε η σελίδα σου."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const weights = useMemo(() => {
    return (data?.progress || []).filter((item) => item.weight_kg).slice().reverse();
  }, [data]);

  const paymentApproved = Boolean(data?.paymentApproved);
  const lastWeight = weights.at(-1);

  const submitWeeklyUpdate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setMessage("");

    const formData = new FormData();
    formData.append("weightKg", weeklyForm.weightKg);
    formData.append("trainingScore", weeklyForm.trainingScore);
    formData.append("nutritionScore", weeklyForm.nutritionScore);
    formData.append("notes", weeklyForm.notes);
    weeklyForm.photos.slice(0, 3).forEach((file) => formData.append("photos", file));

    try {
      await api.upload("/client-dashboard/weekly-update", formData);
      setMessage("Το εβδομαδιαίο update υποβλήθηκε.");
      setWeeklyOpen(false);
      setWeeklyForm(initialWeeklyForm);
      loadDashboard();
    } catch (err) {
      setError(getErrorMessage(err, "Δεν υποβλήθηκε το update."));
    }
  };

  return (
    <ClientShell
      title="Η Προπόνησή μου"
      user={user}
      logout={logout}
      paymentApproved={paymentApproved}
      unreadNotifications={data?.unreadNotifications || 0}
      active="dashboard"
    >
      {error && <Alert tone="red">{error}</Alert>}
      {message && <Alert tone="green">{message}</Alert>}
      {loading && (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center font-bold text-slate-500 dark:border-slate-800 dark:bg-slate-900">
          Φόρτωση...
        </div>
      )}

      {!loading && data && (
        <div className="space-y-6">
          {!paymentApproved && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 shadow-sm dark:border-amber-900 dark:bg-amber-950/30">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-lg font-black text-amber-900 dark:text-amber-200">
                    Η πληρωμή σου είναι σε εκκρεμότητα
                  </h2>
                  <p className="mt-1 text-sm font-bold text-amber-800 dark:text-amber-300">
                    Μέχρι να εγκριθεί, τα προγράμματα και το progress παραμένουν κλειδωμένα.
                  </p>
                </div>
                <Button
                  nativeButton={false}
                  render={<Link href="/client-billing">Πληρωμές και Συνδρομή</Link>}
                  className="h-11 bg-red-600 px-5 font-black text-white hover:bg-red-700"
                />
              </div>
            </div>
          )}

          <div
            className={
              paymentApproved
                ? "space-y-6"
                : "pointer-events-none select-none space-y-6 opacity-40 blur-[2px]"
            }
          >
            <section className="grid gap-5 lg:grid-cols-4">
              <StatusCard title="Πρόγραμμα Προπόνησης" value={data.training?.title || "Δεν έχει ανατεθεί ακόμα"} />
              <StatusCard title="Πρόγραμμα Διατροφής" value={data.nutrition?.title || "Δεν έχει ανατεθεί ακόμα"} />
              <StatusCard title="Τελευταίο Βάρος" value={lastWeight?.weight_kg ? `${lastWeight.weight_kg} kg` : "-"} />
              <WeeklyUpdateCard data={data.weeklyUpdate} onOpen={() => setWeeklyOpen(true)} />
            </section>

            <WorkoutProgramView training={data.training} />

            <section className="grid gap-6 xl:grid-cols-2">
              <NutritionView nutrition={data.nutrition} />
              <Card>
                <CardHeader>
                  <CardTitle className="text-xl font-black">Πρόοδος</CardTitle>
                </CardHeader>
                <CardContent>
                  {weights.length ? (
                    <WeightChart rows={weights} />
                  ) : (
                    <EmptyState text="Δεν υπάρχουν ακόμα αρκετά δεδομένα προόδου." />
                  )}
                </CardContent>
              </Card>
            </section>
          </div>
        </div>
      )}

      <Dialog open={weeklyOpen} onOpenChange={setWeeklyOpen}>
        <DialogContent className="max-w-2xl">
          <form onSubmit={submitWeeklyUpdate}>
            <DialogHeader>
              <DialogTitle>Εβδομαδιαίο update</DialogTitle>
            </DialogHeader>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div>
                <Label>Τρέχον βάρος</Label>
                <Input
                  className="mt-2"
                  value={weeklyForm.weightKg}
                  onChange={(event) =>
                    setWeeklyForm((current) => ({ ...current, weightKg: event.target.value }))
                  }
                  required
                />
              </div>
              <ScoreField
                label="Πώς πήγαν οι προπονήσεις;"
                value={weeklyForm.trainingScore}
                onChange={(value) => setWeeklyForm((current) => ({ ...current, trainingScore: value }))}
              />
              <ScoreField
                label="Πώς ήταν η διατροφή;"
                value={weeklyForm.nutritionScore}
                onChange={(value) => setWeeklyForm((current) => ({ ...current, nutritionScore: value }))}
              />
              <div>
                <Label>Φωτογραφίες προόδου (max 3)</Label>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(event) =>
                    setWeeklyForm((current) => ({
                      ...current,
                      photos: Array.from(event.target.files || []).slice(0, 3),
                    }))
                  }
                  className="mt-2 block w-full rounded-md border border-slate-200 p-3 text-sm dark:border-slate-700 dark:bg-slate-950"
                />
              </div>
              <div className="md:col-span-2">
                <Label>Σημειώσεις / ερωτήσεις προς τον coach</Label>
                <Textarea
                  className="mt-2 min-h-32"
                  value={weeklyForm.notes}
                  onChange={(event) =>
                    setWeeklyForm((current) => ({ ...current, notes: event.target.value }))
                  }
                />
              </div>
            </div>
            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={() => setWeeklyOpen(false)}>
                Άκυρο
              </Button>
              <Button type="submit">Υποβολή</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </ClientShell>
  );
}

export default function ClientDashboardPage() {
  return (
    <ProtectedRoute allow="client-active">
      <ClientDashboardContent />
    </ProtectedRoute>
  );
}
