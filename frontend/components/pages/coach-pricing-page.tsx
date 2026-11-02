"use client";

import { DragEvent, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Clock3,
  Copy,
  CreditCard,
  Eye,
  GripVertical,
  Landmark,
  Layers3,
  MoreHorizontal,
  Plus,
  Pencil,
  Star,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { CoachShell } from "@/components/shell/coach-shell";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/auth-context";

type Feature = { text: string; included: boolean };
type Plan = {
  id?: number;
  name: string;
  badge?: string;
  description?: string;
  price: number | string;
  currency: string;
  period: string;
  themeColor: string;
  features: Feature[];
  isActive: boolean;
  isPopular: boolean;
  sortOrder: number;
  pointsReward: number;
};
type BankAccount = {
  id?: number;
  bankName: string;
  accountHolder: string;
  iban: string;
  isDefault: boolean;
  isVisible: boolean;
  sortOrder: number;
};
type PaymentSettings = {
  bankTransferEnabled: boolean;
  cashEnabled: boolean;
  stripeEnabled: boolean;
  stripeConfigured: boolean;
  paypalEnabled: boolean;
  paypalConfigured: boolean;
  paypalMode: "sandbox" | "live";
  paymentReference: string;
  paymentNote: string;
  bankAccounts: BankAccount[];
};
type PackageDuration = { id: number; months: number; basePriceCents: number; label?: string | null; isActive: boolean; sortOrder: number };
type PackageOffer = { id?: number; months: number; priceCents: number; features: string[]; isActive: boolean };
type AdminPackage = { id: number; key: string; name: string; monthlyAddonCents: number; label?: string | null; sortOrder: number; isVisible: boolean; isUpgradable: boolean; features: { id?: number; text: string; sortOrder?: number }[]; offers?: PackageOffer[] };
type PackageCatalog = { packages: AdminPackage[]; durations: PackageDuration[]; commonFeatures: { id?: number; text: string; sortOrder?: number }[]; pointsPerEuro: number };
const blankPlan = (): Plan => ({
  name: "Νέο πλάνο",
  badge: "",
  description: "",
  price: 0,
  currency: "EUR",
  period: "Μηνιαίο",
  themeColor: "#0B0B0B",
  features: [],
  isActive: true,
  isPopular: false,
  sortOrder: 0,
  pointsReward: 0,
});
const blankAccount = (): BankAccount => ({
  bankName: "",
  accountHolder: "",
  iban: "",
  isDefault: false,
  isVisible: true,
  sortOrder: 0,
});
const colors = ["#EF4444", "#8B5CF6", "#0EA5E9", "#F59E0B", "#0B0B0B"];
const money = (value: number | string, currency = "EUR") =>
  new Intl.NumberFormat("el-GR", { style: "currency", currency }).format(
    Number(value || 0),
  );
const months = (period: string) =>
  Math.max(1, Number(period.match(/\d+/)?.[0] || 1));
const formatIban = (iban = "") =>
  iban
    .replace(/\s/g, "")
    .toUpperCase()
    .replace(/(.{4})/g, "$1 ")
    .trim();
const validIban = (raw: string) => {
  const iban = raw.replace(/\s/g, "").toUpperCase();
  if (
    !/^[A-Z]{2}[A-Z0-9]+$/.test(iban) ||
    (iban.startsWith("GR") && iban.length !== 27)
  )
    return false;
  const prepared = `${iban.slice(4)}${iban.slice(0, 4)}`.replace(
    /[A-Z]/g,
    (char) => String(char.charCodeAt(0) - 55),
  );
  let rem = 0;
  for (const digit of prepared) rem = (rem * 10 + Number(digit)) % 97;
  return rem === 1;
};

function CoachPricingContent() {
  const { user, logout } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [packageCatalog, setPackageCatalog] = useState<PackageCatalog | null>(null);
  const [settings, setSettings] = useState<PaymentSettings>({
    bankTransferEnabled: true,
    cashEnabled: true,
    stripeEnabled: false,
    stripeConfigured: false,
    paypalEnabled: false,
    paypalConfigured: false,
    paypalMode: "sandbox",
    paymentReference: "",
    paymentNote: "",
    bankAccounts: [],
  });
  const [tab, setTab] = useState("plans");
  const [editing, setEditing] = useState<Plan | null>(null);
  const [deleting, setDeleting] = useState<Plan | null>(null);
  const [saving, setSaving] = useState(false);
  const [dragged, setDragged] = useState<number | null>(null);
  const load = async () => {
    try {
      const [planRows, packageRows, paymentRows] = await Promise.all([
        api.get<Plan[]>("/pricing-plans/manage"),
        api.get<PackageCatalog>("/pricing-plans/packages/manage"),
        api.get<PaymentSettings>("/pricing-plans/payment-settings"),
      ]);
      setPlans(planRows);
      setPackageCatalog(packageRows);
      setSettings(paymentRows);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Δεν φορτώθηκαν οι ρυθμίσεις.",
      );
    }
  };
  useEffect(() => {
    const current = new URLSearchParams(window.location.search).get("tab");
    if (current === "payment") setTab("payment");
    void load();
  }, []);
  const setActiveTab = (value: string) => {
    setTab(value);
    const url = new URL(window.location.href);
    value === "payment"
      ? url.searchParams.set("tab", "payment")
      : url.searchParams.delete("tab");
    window.history.replaceState({}, "", url);
  };
  const savePlan = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const saved = editing.id
        ? await api.put<Plan>(`/pricing-plans/${editing.id}`, editing)
        : await api.post<Plan>("/pricing-plans", {
            ...editing,
            sortOrder: plans.length,
          });
      setEditing(null);
      await load();
      toast.success(`Το πλάνο «${saved.name}» αποθηκεύτηκε.`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Η αποθήκευση απέτυχε.",
      );
    } finally {
      setSaving(false);
    }
  };
  const deletePlan = async () => {
    if (!deleting?.id) return;
    try {
      const result = await api.delete<{ message: string }>(
        `/pricing-plans/${deleting.id}`,
      );
      setDeleting(null);
      await load();
      toast.success(result.message);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Η διαγραφή απέτυχε.",
      );
    }
  };
  const reorder = async (target: number) => {
    if (dragged === null || dragged === target) return;
    const next = [...plans];
    const [moved] = next.splice(dragged, 1);
    next.splice(target, 0, moved);
    const ordered = next.map((plan, index) => ({ ...plan, sortOrder: index }));
    setPlans(ordered);
    setDragged(null);
    try {
      await api.put("/pricing-plans/reorder", {
        ids: ordered.map((plan) => plan.id),
      });
      toast.success("Η σειρά αποθηκεύτηκε.");
    } catch {
      setPlans(plans);
      toast.error("Δεν αποθηκεύτηκε η σειρά.");
    }
  };
  const saveSettings = async () => {
    if (
      settings.bankTransferEnabled &&
      settings.bankAccounts.some(
        (account) => account.bankName || account.accountHolder || account.iban,
      ) &&
      settings.bankAccounts.some((account) => !validIban(account.iban))
    ) {
      toast.error("Υπάρχει άκυρο IBAN.");
      return;
    }
    setSaving(true);
    try {
      const saved = await api.put<PaymentSettings>(
        "/pricing-plans/payment-settings",
        settings,
      );
      setSettings(saved);
      toast.success("Τα στοιχεία πληρωμής αποθηκεύτηκαν.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Η αποθήκευση απέτυχε.",
      );
    } finally {
      setSaving(false);
    }
  };
  const moveAccount = (from: number, to: number) =>
    setSettings((current) => {
      const rows = [...current.bankAccounts];
      const [account] = rows.splice(from, 1);
      rows.splice(to, 0, account);
      return {
        ...current,
        bankAccounts: rows.map((row, index) => ({ ...row, sortOrder: index })),
      };
    });
  return (
    <CoachShell title="Πλάνα & Τιμές" user={user} logout={logout}>
      <main className="mx-auto max-w-[var(--container-7xl)] space-y-6 p-4 sm:p-6 lg:px-10 lg:py-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-[30px] font-extrabold italic tracking-[-.6px]">
              Πλάνα & Τιμές
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Τα πλάνα συνδρομής και πώς σε πληρώνουν οι πελάτες σου.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="h-11 rounded-full border-foreground px-5"
              onClick={() =>
                window.open("/client-billing", "_blank", "noopener,noreferrer")
              }
            >
              <Eye className="mr-2 h-4 w-4" />
              Σελίδα πελατών
            </Button>
            <Button
              className="h-11 rounded-full bg-accent px-5 font-extrabold text-accent-foreground hover:bg-accent/85"
              onClick={() => document.getElementById("package-builder")?.scrollIntoView({ behavior: "smooth", block: "start" })}
            >
              <Plus className="mr-1 h-4 w-4" />
              Νέο πλάνο
            </Button>
          </div>
        </header>
        <Tabs value={tab} onValueChange={setActiveTab}>
          <TabsList className="rounded-full bg-muted p-1">
            <TabsTrigger
              value="plans"
              className="rounded-full px-5 data-active:!bg-foreground data-active:!text-background"
            >
              Πλάνα{" "}
              <span className="rounded-full bg-background/15 px-1.5 text-[11px]">
                {packageCatalog?.packages.length || 0}
              </span>
            </TabsTrigger>
            <TabsTrigger
              value="payment"
              className="rounded-full px-5 data-active:!bg-foreground data-active:!text-background"
            >
              Στοιχεία πληρωμής
            </TabsTrigger>
          </TabsList>
          <TabsContent value="plans" className="mt-6 space-y-5">
            <PackageBuilder catalog={packageCatalog} onSaved={load} />
            <div className="hidden grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {plans.map((plan, index) => (
                <AdminPlanCard
                  key={plan.id || plan.name}
                  plan={plan}
                  dragProps={{
                    draggable: true,
                    onDragStart: () => setDragged(index),
                    onDragOver: (event: DragEvent) => event.preventDefault(),
                    onDrop: () => void reorder(index),
                  }}
                  onEdit={() => setEditing({ ...plan })}
                  onDelete={() => setDeleting(plan)}
                  onDuplicate={() =>
                    setEditing({
                      ...plan,
                      id: undefined,
                      name: `${plan.name} αντίγραφο`,
                      isPopular: false,
                    })
                  }
                />
              ))}
            </div>
            <button
              type="button"
              onClick={() => setEditing(blankPlan())}
              className="hidden min-h-28 w-full items-center justify-center rounded-[20px] border border-dashed border-border text-sm font-extrabold hover:bg-muted"
            >
              <Plus className="mr-2 h-4 w-4" />
              Πρόσθεσε νέο πλάνο
            </button>
            <p className="hidden text-center text-xs text-muted-foreground">
              Σύρε τις κάρτες για να αλλάξεις τη σειρά. Οι κρυφές δεν φαίνονται
              στους πελάτες.
            </p>
            <PaymentSummary
              settings={settings}
              onOpen={() => setActiveTab("payment")}
            />
          </TabsContent>
          <TabsContent value="payment" className="mt-6">
            <PaymentSettingsForm
              settings={settings}
              setSettings={setSettings}
              onMove={moveAccount}
              onSave={() => void saveSettings()}
              saving={saving}
            />
          </TabsContent>
        </Tabs>
      </main>
      <PlanEditor
        plan={editing}
        open={Boolean(editing)}
        onOpenChange={(open) => !open && setEditing(null)}
        setPlan={setEditing}
        onSave={() => void savePlan()}
        saving={saving}
      />
      <AlertDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Διαγραφή πλάνου</AlertDialogTitle>
            <AlertDialogDescription>
              Αν το πλάνο έχει ενεργούς πελάτες, θα κρυφτεί αντί να διαγραφεί.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Ακύρωση</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => void deletePlan()}
            >
              Διαγραφή
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </CoachShell>
  );
}

function PackageBuilder({ catalog, onSaved }: { catalog: PackageCatalog | null; onSaved: () => Promise<void> }) {
  const [editing, setEditing] = useState<AdminPackage | null>(null);
  const [durations, setDurations] = useState<PackageDuration[]>([]);
  const [common, setCommon] = useState<string[]>([]);
  const [pointsRate, setPointsRate] = useState(5);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!catalog) return;
    setDurations(catalog.durations);
    setCommon(catalog.commonFeatures.map((item) => item.text));
    setPointsRate(catalog.pointsPerEuro);
  }, [catalog]);

  if (!catalog) return <Card className="rounded-[20px]"><CardContent className="p-6 text-sm text-muted-foreground">Φόρτωση πακέτων…</CardContent></Card>;
  const baseOneMonth = durations.find((item) => item.months === 1)?.basePriceCents || 0;
  const saveSettings = async () => {
    setSaving(true);
    try {
      await Promise.all([
        api.put("/pricing-plans/package-durations", { durations }),
        api.put("/pricing-plans/common-features", { features: common }),
        api.put("/pricing-plans/points-rate", { pointsPerEuro: pointsRate }),
      ]);
      await onSaved();
      toast.success("Οι ρυθμίσεις πακέτων αποθηκεύτηκαν.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Δεν αποθηκεύτηκαν οι ρυθμίσεις."); }
    finally { setSaving(false); }
  };
  const savePackage = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const firstOfferFeatures = editing.offers?.[0]?.features || [];
      const payload = {
        ...editing,
        features: editing.features.filter((feature) => feature.text.trim()).length
          ? editing.features.filter((feature) => feature.text.trim())
          : firstOfferFeatures.map((text, index) => ({ text, sortOrder: index + 1 })),
      };
      if (editing.id) await api.put(`/pricing-plans/packages/${editing.id}`, payload);
      else await api.post("/pricing-plans/packages", payload);
      setEditing(null);
      await onSaved();
      toast.success("Το πακέτο αποθηκεύτηκε.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Δεν αποθηκεύτηκε το πακέτο."); }
    finally { setSaving(false); }
  };
  const removePackage = async (item: AdminPackage) => {
    if (!window.confirm(`Διαγραφή του πακέτου «${item.name}»;`)) return;
    try { const result = await api.delete<{ message: string }>(`/pricing-plans/packages/${item.id}`); await onSaved(); toast.success(result.message); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Δεν διαγράφηκε το πακέτο."); }
  };
  return <PackageReferenceLayout
    catalog={catalog}
    durations={durations}
    setDurations={setDurations}
    common={common}
    setCommon={setCommon}
    pointsRate={pointsRate}
    setPointsRate={setPointsRate}
    saving={saving}
    onSaveSettings={saveSettings}
    onEditPackage={setEditing}
    onRemovePackage={removePackage}
    editing={editing}
    setEditing={setEditing}
    onSavePackage={savePackage}
  />;
  /* Legacy builder retained below temporarily while its Sheet editor remains shared.
  <section id="package-builder" className="space-y-5 scroll-mt-6">
    <Card className="rounded-[20px] border-border bg-card shadow-none"><CardContent className="space-y-5 p-5 sm:p-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-xl font-extrabold">Πακέτα & διάρκειες</h2><p className="text-sm text-muted-foreground">Η τελική τιμή υπολογίζεται αυτόματα: βασική διάρκεια + αναβάθμιση × μήνες.</p></div><Button onClick={() => setEditing({ id: 0, key: "", name: "Νέο πακέτο", monthlyAddonCents: 0, label: null, sortOrder: catalog.packages.length + 1, isVisible: true, isUpgradable: true, features: [{ text: "", sortOrder: 1 }] })} className="rounded-full bg-accent text-accent-foreground hover:bg-accent/85"><Plus className="mr-1 h-4 w-4"/>Νέο πακέτο</Button></div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{durations.map((duration, index) => <div key={duration.id} className="rounded-[16px] border border-border bg-muted/40 p-4"><Label>{duration.months} {duration.months === 1 ? "μήνας" : "μήνες"}</Label><div className="mt-2 flex items-center gap-2"><Input type="number" min={0} step={1} className="h-10 rounded-xl bg-card" value={(duration.basePriceCents / 100).toFixed(2)} onChange={(event) => setDurations((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, basePriceCents: Math.round(Number(event.target.value || 0) * 100) } : row))}/><span className="text-sm font-bold">€</span></div><p className="mt-2 text-xs text-muted-foreground">{duration.months > 1 ? `Έκπτωση ${Math.round((1 - duration.basePriceCents / Math.max(1, baseOneMonth * duration.months)) * 100)}%` : "Βασική τιμή"}</p></div>)}</div>
      <div className="grid gap-4 lg:grid-cols-[1fr_220px]"><div><Label>Κοινές παροχές</Label><Textarea className="mt-2 min-h-28 rounded-2xl bg-muted" value={common.join("\n")} onChange={(event) => setCommon(event.target.value.split("\n").map((item) => item.trim()).filter(Boolean))}/><p className="mt-1 text-xs text-muted-foreground">Μία παροχή σε κάθε γραμμή.</p></div><div><Label>Πόντοι ανά €</Label><Input type="number" min={0} className="mt-2 h-12 rounded-xl bg-muted" value={pointsRate} onChange={(event) => setPointsRate(Number(event.target.value || 0))}/><p className="mt-2 text-xs text-muted-foreground">Οι πόντοι υπολογίζονται όταν εγκριθεί η πληρωμή.</p></div></div>
      <Button onClick={() => void saveSettings()} disabled={saving} className="rounded-full bg-foreground text-background">Αποθήκευση ρυθμίσεων</Button>
    </CardContent></Card>
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{catalog.packages.map((item) => <Card key={item.id} className="rounded-[20px] border-border bg-card shadow-none"><CardContent className="flex min-h-[260px] flex-col gap-4 p-5"><div className="flex items-start justify-between gap-2"><div><h3 className="text-lg font-extrabold">{item.name}</h3><p className="mt-1 text-sm text-muted-foreground">+{money(item.monthlyAddonCents / 100)} / μήνα</p></div>{item.label && <Badge className="bg-accent text-accent-foreground">{item.label}</Badge>}</div><Separator/><div className="space-y-2">{item.features.slice(0, 4).map((feature) => <p key={feature.id || feature.text} className="flex gap-2 text-xs"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent"/>{feature.text}</p>)}</div><div className="mt-auto flex gap-2"><Button className="flex-1 rounded-full bg-foreground text-background" onClick={() => setEditing({ ...item, features: item.features.map((feature) => ({ ...feature })) })}>Επεξεργασία</Button><Button variant="outline" className="rounded-full" onClick={() => void removePackage(item)}>Διαγραφή</Button></div></CardContent></Card>)}</div>
    <Sheet open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}><SheetContent className="w-full overflow-y-auto sm:max-w-[520px]"><SheetHeader><SheetTitle>{editing?.id ? "Επεξεργασία πακέτου" : "Νέο πακέτο"}</SheetTitle></SheetHeader>{editing && <div className="space-y-5 py-6"><Field label="Όνομα"><Input value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })}/></Field><Field label="Μηνιαία αναβάθμιση (€)"><Input type="number" min={0} value={(editing.monthlyAddonCents / 100).toFixed(2)} onChange={(event) => setEditing({ ...editing, monthlyAddonCents: Math.round(Number(event.target.value || 0) * 100) })}/></Field><Field label="Ετικέτα"><Input value={editing.label || ""} onChange={(event) => setEditing({ ...editing, label: event.target.value || null })}/></Field><Field label="Παροχές"><div className="space-y-2">{editing.features.map((feature, index) => <div key={`${feature.id || "new"}-${index}`} className="flex gap-2"><Input value={feature.text} onChange={(event) => setEditing({ ...editing, features: editing.features.map((item, itemIndex) => itemIndex === index ? { ...item, text: event.target.value } : item) })}/><Button variant="outline" size="icon" onClick={() => setEditing({ ...editing, features: editing.features.filter((_, itemIndex) => itemIndex !== index) })}><X className="h-4 w-4"/></Button></div>)}<Button variant="outline" className="w-full rounded-xl border-dashed" onClick={() => setEditing({ ...editing, features: [...editing.features, { text: "" }] })}>+ Προσθήκη παροχής</Button></div></Field><SettingRow label="Ορατό στους πελάτες" detail="Μόνο τα ορατά πακέτα προσφέρονται για αγορά"><Switch checked={editing.isVisible} onCheckedChange={(value) => setEditing({ ...editing, isVisible: value })}/></SettingRow></div>}<SheetFooter><Button variant="outline" className="rounded-full" onClick={() => setEditing(null)}>Ακύρωση</Button><Button className="rounded-full bg-accent text-accent-foreground" disabled={saving} onClick={() => void savePackage()}>Αποθήκευση</Button></SheetFooter></SheetContent></Sheet>
  </section>; */
}

function PackageReferenceLayout({
  catalog, durations, setDurations, common, setCommon, pointsRate, setPointsRate, saving, onSaveSettings, onEditPackage, onRemovePackage, editing, setEditing, onSavePackage,
}: {
  catalog: PackageCatalog;
  durations: PackageDuration[];
  setDurations: React.Dispatch<React.SetStateAction<PackageDuration[]>>;
  common: string[];
  setCommon: React.Dispatch<React.SetStateAction<string[]>>;
  pointsRate: number;
  setPointsRate: React.Dispatch<React.SetStateAction<number>>;
  saving: boolean;
  onSaveSettings: () => Promise<void>;
  onEditPackage: (item: AdminPackage | null) => void;
  onRemovePackage: (item: AdminPackage) => Promise<void>;
  editing: AdminPackage | null;
  setEditing: React.Dispatch<React.SetStateAction<AdminPackage | null>>;
  onSavePackage: () => Promise<void>;
}) {
  const [commonOpen, setCommonOpen] = useState(false);
  const oneMonth = durations.find((item) => item.months === 1)?.basePriceCents || 0;
  const updateDuration = (index: number, patch: Partial<PackageDuration>) => setDurations((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row));
  const priceFor = (pkg: AdminPackage, duration: PackageDuration) => pkg.offers?.find((offer) => offer.months === duration.months)?.priceCents ?? duration.basePriceCents + pkg.monthlyAddonCents * duration.months;
  const pluralMonths = (months: number) => months === 1 ? "μήνας" : "μήνες";
  return <section id="package-builder" className="scroll-mt-6 space-y-5">
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_330px] xl:items-start">
      <div className="space-y-5">
        <Card className="rounded-[20px] border-border bg-card shadow-none">
          <CardContent className="space-y-4 p-[22px]">
            <div className="flex items-center gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-foreground text-accent"><Clock3 className="h-[18px] w-[18px]" /></span><div><h2 className="text-[17px] font-extrabold">1 · Διάρκειες & τιμή Βασικού</h2><p className="text-xs text-muted-foreground">Η τιμή του Βασικού για κάθε διάρκεια · οι υπόλοιπες τιμές υπολογίζονται αυτόματα.</p></div></div>
            <div className="overflow-x-auto"><div className="min-w-[760px]">
              <div className="grid grid-cols-[110px_1fr_1fr_100px_1.3fr_50px] gap-3 border-b border-border px-1 pb-2 text-[10px] font-extrabold tracking-[.8px] text-[#8A8A8A]"><span>ΔΙΑΡΚΕΙΑ</span><span>ΤΙΜΗ ΒΑΣΙΚΟΥ</span><span>ΑΝΑ ΜΗΝΑ</span><span>ΕΚΠΤΩΣΗ</span><span>ΕΤΙΚΕΤΑ</span><span>ΕΝΕΡΓΗ</span></div>
              {durations.map((duration, index) => { const discount = duration.months > 1 ? Math.round((1 - duration.basePriceCents / Math.max(1, oneMonth * duration.months)) * 100) : 0; return <div key={duration.id} className="grid grid-cols-[110px_1fr_1fr_100px_1.3fr_50px] items-center gap-3 border-b border-border/50 px-1 py-2.5"><span className="text-sm font-extrabold">{duration.months} {pluralMonths(duration.months)}</span><div className="relative"><Input type="number" min={0} className="h-[42px] rounded-xl pr-7 font-extrabold" value={(duration.basePriceCents / 100).toFixed(2)} onChange={(event) => updateDuration(index, { basePriceCents: Math.round(Number(event.target.value || 0) * 100) })}/><span className="pointer-events-none absolute right-3 top-3 text-sm font-semibold text-muted-foreground">€</span></div><span className="text-sm text-muted-foreground">{money(duration.basePriceCents / 100)} / μήνα</span><span className={`text-[13px] font-extrabold ${discount ? "text-[#3f6b00] dark:text-accent" : "text-muted-foreground"}`}>{discount ? `−${discount} %` : "—"}</span><Select value={duration.label || undefined} onValueChange={(value) => updateDuration(index, { label: value === "clear" ? null : value })}><SelectTrigger className="h-[42px] w-full rounded-xl bg-card text-sm font-semibold">{duration.label ? <span className="rounded-full bg-accent px-2 py-1 text-[11px] font-extrabold text-accent-foreground">{duration.label}</span> : <SelectValue placeholder="" />}</SelectTrigger><SelectContent><SelectItem value="clear">—</SelectItem><SelectItem value="Δημοφιλές"><span className="rounded-full bg-accent px-2 py-1 text-[11px] font-extrabold text-accent-foreground">Δημοφιλές</span></SelectItem><SelectItem value="Καλύτερη τιμή"><span className="rounded-full bg-accent px-2 py-1 text-[11px] font-extrabold text-accent-foreground">Καλύτερη τιμή</span></SelectItem></SelectContent></Select><Switch checked={duration.isActive} onCheckedChange={(value) => updateDuration(index, { isActive: value })}/></div>; })}
            </div></div>
            <div className="flex flex-col gap-3 rounded-[14px] bg-muted p-4 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><p className="text-sm font-extrabold">Κοινές παροχές όλων των πακέτων · {common.length}</p><p className="truncate text-xs text-muted-foreground">Εμφανίζονται στο «Δες και τις {common.length} παροχές» · {common.slice(0, 3).join(" · ")}</p></div><Button type="button" variant="outline" className="h-[38px] rounded-full border-border font-extrabold" onClick={() => setCommonOpen((value) => !value)}><Pencil className="mr-1.5 h-3.5 w-3.5"/>Επεξεργασία</Button></div>
            {commonOpen && <Textarea className="min-h-44 rounded-[14px] bg-muted" value={common.join("\n")} onChange={(event) => setCommon(event.target.value.split("\n").map((item) => item.trim()).filter(Boolean))}/>} 
          </CardContent>
        </Card>
        <Card className="rounded-[20px] border-border bg-card shadow-none"><CardContent className="space-y-4 p-[22px]"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-foreground text-accent"><Layers3 className="h-[18px] w-[18px]" /></span><div><h2 className="text-[17px] font-extrabold">2 · Πακέτα</h2><p className="text-xs text-muted-foreground">Άνοιξε ένα πακέτο και όρισε ξεχωριστά τιμή και παροχές για 1, 2, 3 ή 4 μήνες.</p></div></div><div className="grid gap-[14px] md:grid-cols-2">{catalog.packages.map((pkg, index) => <PackageTierCard key={pkg.id} pkg={pkg} index={index} durations={durations} priceFor={priceFor} onEdit={() => onEditPackage({ ...pkg, features: pkg.features.map((feature) => ({ ...feature })), offers: pkg.offers?.map((offer) => ({ ...offer, features: [...offer.features] })) })} onDelete={() => void onRemovePackage(pkg)} />)}</div><Button type="button" variant="outline" className="rounded-full border-[1.5px] border-foreground font-extrabold" onClick={() => onEditPackage({ id: 0, key: "", name: "Νέο πακέτο", monthlyAddonCents: 0, label: null, sortOrder: catalog.packages.length + 1, isVisible: true, isUpgradable: true, features: [{ text: "", sortOrder: 1 }], offers: durations.map((duration) => ({ months: duration.months, priceCents: duration.basePriceCents, features: [], isActive: duration.isActive })) })}><Plus className="mr-1.5 h-4 w-4"/>Νέο πακέτο</Button></CardContent></Card>
      </div>
      <aside className="space-y-5 xl:sticky xl:top-6"><Card className="rounded-[20px] border-border bg-card shadow-none"><CardContent className="space-y-3 p-5"><div className="flex items-baseline justify-between"><h2 className="text-[15px] font-extrabold">Τελικές τιμές (€)</h2><span className="text-[11px] font-extrabold tracking-[1px] text-muted-foreground">ΑΥΤΟΜΑΤΑ</span></div><div className="overflow-x-auto"><table className="w-full min-w-[285px] text-[13px]"><thead className="text-[10px] font-extrabold text-muted-foreground"><tr><th></th>{catalog.packages.map((pkg) => <th key={pkg.id} className="pb-1 text-right">{pkg.name.toUpperCase().slice(0, 6)}</th>)}</tr></thead><tbody>{durations.map((duration) => <tr key={duration.id}><td className="py-[7px] font-extrabold">{duration.months}μ</td>{catalog.packages.map((pkg) => <td key={pkg.id} className="py-[7px] text-right font-medium">{money(priceFor(pkg, duration)).replace("€", "").trim()}</td>)}</tr>)}</tbody></table></div><p className="text-xs leading-5 text-muted-foreground">Τιμή Βασικού + αναβάθμιση × μήνες. Έτσι ακριβώς τις βλέπει ο πελάτης.</p></CardContent></Card><Card className="rounded-[20px] border-border bg-card shadow-none"><CardContent className="space-y-3 p-5"><h2 className="text-[15px] font-extrabold">Πόντοι από πληρωμές</h2><div className="flex items-center gap-3"><Input type="number" min={0} className="h-[42px] w-20 rounded-xl text-center text-lg font-extrabold" value={pointsRate} onChange={(event) => setPointsRate(Number(event.target.value || 0))}/><p className="text-sm font-bold">πόντοι ανά 1 € πληρωμής</p></div>{durations[2] && catalog.packages[1] && <div className="rounded-xl bg-[color:var(--sp-lime-soft)] p-3 text-[13px]"><p>{money(priceFor(catalog.packages[1], durations[2]))} → <b>{new Intl.NumberFormat("el-GR").format(Math.round(priceFor(catalog.packages[1], durations[2]) / 100 * pointsRate))} πόντοι</b></p><p className="mt-1 text-[#3f6b00] dark:text-accent">= κουπόνι eshop</p></div>}</CardContent></Card><Button className="h-[46px] w-full rounded-full bg-accent font-extrabold text-accent-foreground hover:bg-accent/85" disabled={saving} onClick={() => void onSaveSettings()}>{saving ? "Αποθήκευση..." : "Αποθήκευση"}</Button><a href="/client-billing" target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-[20px] bg-foreground p-4 text-background"><span className="grid h-[38px] w-[38px] place-items-center rounded-[11px] bg-accent text-accent-foreground"><Eye className="h-[17px] w-[17px]"/></span><span className="flex-1"><b className="block text-sm">Δες όπως ο πελάτης</b><small className="text-xs text-muted-foreground">Εγγραφή & Συνδρομή</small></span></a></aside>
    </div>
    <PackageBuilderSheetReference editing={editing} setEditing={setEditing} saving={saving} onSave={onSavePackage} packages={catalog.packages} durations={durations} onDelete={onRemovePackage} />
  </section>;
}

function PackageBuilderSheetReference({ editing, setEditing, saving, onSave, packages, durations, onDelete }: { editing: AdminPackage | null; setEditing: React.Dispatch<React.SetStateAction<AdminPackage | null>>; saving: boolean; onSave: () => Promise<void>; packages: AdminPackage[]; durations: PackageDuration[]; onDelete: (item: AdminPackage) => Promise<void> }) {
  const packageIndex = editing ? packages.findIndex((item) => item.id === editing.id) : -1;
  const previous = packageIndex > 0 ? packages[packageIndex - 1] : null;
  const offers = (editing ? durations.map((duration) => editing.offers?.find((offer) => offer.months === duration.months) || ({
    months: duration.months,
    priceCents: duration.basePriceCents + editing.monthlyAddonCents * duration.months,
    features: editing.features.map((feature) => feature.text).filter(Boolean),
    isActive: duration.isActive,
  })) : []) as PackageOffer[];
  const updateOffer = (months: number, patch: Partial<PackageOffer>) => editing && setEditing({
    ...editing,
    offers: offers.map((offer) => offer.months === months ? { ...offer, ...patch } : offer),
  });
  const copyOffer = (from: PackageOffer, to: PackageOffer) => updateOffer(to.months, {
    priceCents: from.priceCents,
    features: [...from.features],
    isActive: from.isActive,
  });
  const removeOfferFeature = (offer: PackageOffer, index: number) => updateOffer(offer.months, { features: offer.features.filter((_, itemIndex) => itemIndex !== index) });
  const setOfferFeature = (offer: PackageOffer, index: number, text: string) => updateOffer(offer.months, { features: offer.features.map((item, itemIndex) => itemIndex === index ? text : item) });

  return <Sheet open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
    <SheetContent className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-[520px]">
      <SheetHeader className="flex-row items-center gap-3 border-b border-border px-7 py-[22px]">
        <span className="flex gap-[3px]">{[0, 1, 2, 3].map((item) => <i key={item} className={`h-[5px] w-[14px] rounded-full ${item <= Math.max(packageIndex, 0) ? "bg-accent" : "bg-muted"}`} />)}</span>
        <SheetTitle className="text-xl">{editing?.id ? "Επεξεργασία πακέτου" : "Νέο πακέτο"}</SheetTitle>
      </SheetHeader>
      {editing && <div className="flex-1 overflow-y-auto px-7 py-[22px]">
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Όνομα"><Input className="h-12 rounded-[14px] bg-muted text-[15px] font-semibold" value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} /></Field>
            <Field label="Ετικέτα"><Select value={editing.label || undefined} onValueChange={(value) => setEditing({ ...editing, label: value === "clear" ? null : value })}><SelectTrigger className="h-12 rounded-[14px] bg-muted">{editing.label ? <span className="rounded-full bg-accent px-2 py-1 text-[11px] font-extrabold text-accent-foreground">{editing.label}</span> : <SelectValue placeholder="" />}</SelectTrigger><SelectContent><SelectItem value="clear">—</SelectItem><SelectItem value="Δημοφιλές">Δημοφιλές</SelectItem><SelectItem value="Καλύτερη τιμή">Καλύτερη τιμή</SelectItem><SelectItem value="Πλήρης πρόσβαση">Πλήρης πρόσβαση</SelectItem></SelectContent></Select></Field>
          </div>
          <div className="rounded-[14px] bg-muted px-4 py-3 text-xs text-muted-foreground">{previous ? `Το ${editing.name || "πακέτο"} χτίζεται μετά το «${previous.name}». Οι παροχές παρακάτω ορίζονται ξεχωριστά για κάθε διάρκεια.` : "Ορίζεις ξεχωριστά τιμή και παροχές για κάθε διάρκεια."}</div>
          <div className="space-y-2"><Label>Παροχές και τιμή ανά διάρκεια</Label><p className="-mt-1 text-xs text-muted-foreground">Άνοιξε μία διάρκεια, κάνε αντιγραφή από την προηγούμενη και άλλαξε μόνο ό,τι διαφέρει.</p>
            <Accordion multiple defaultValue={[String(offers[0]?.months || 1)]} className="space-y-2">
              {offers.map((offer, index) => <AccordionItem key={offer.months} value={String(offer.months)} className="overflow-hidden rounded-[14px] border border-border bg-card px-0">
                <AccordionTrigger className="px-4 py-3 hover:no-underline"><span className="flex min-w-0 items-center gap-3 text-left"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-foreground text-[11px] font-extrabold text-accent">{offer.months}</span><span><b className="block text-sm">{offer.months} {offer.months === 1 ? "μήνας" : "μήνες"}</b><small className="text-xs font-medium text-muted-foreground">{offer.features.filter(Boolean).length} παροχές · {money(offer.priceCents / 100)}</small></span></span></AccordionTrigger>
                <AccordionContent className="border-t border-border px-4 pb-4 pt-3">
                  <div className="mb-3 grid grid-cols-[1fr_auto] gap-3"><Field label="Τελική τιμή"><div className="relative"><Input type="number" min={0} className="h-11 rounded-xl bg-muted pr-7 font-extrabold" value={(offer.priceCents / 100).toFixed(2)} onChange={(event) => updateOffer(offer.months, { priceCents: Math.round(Number(event.target.value || 0) * 100) })} /><span className="pointer-events-none absolute right-3 top-3 text-sm font-semibold text-muted-foreground">€</span></div></Field><div className="pt-[23px]"><Switch checked={offer.isActive} onCheckedChange={(value) => updateOffer(offer.months, { isActive: value })} /></div></div>
                  {index > 0 && <Button type="button" variant="outline" className="mb-3 h-9 rounded-full border-border text-xs font-extrabold" onClick={() => copyOffer(offers[index - 1], offer)}><Copy className="mr-1.5 h-3.5 w-3.5" />Αντιγραφή από {offers[index - 1].months} {offers[index - 1].months === 1 ? "μήνα" : "μήνες"}</Button>}
                  <div className="space-y-2">{offer.features.map((feature, featureIndex) => <div key={`${offer.months}-${featureIndex}`} className="flex min-h-10 items-center gap-2 rounded-xl bg-muted px-3"><GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" /><Input className="h-8 border-0 bg-transparent p-0 text-sm font-semibold shadow-none focus-visible:ring-0" value={feature} onChange={(event) => setOfferFeature(offer, featureIndex, event.target.value)} /><Button type="button" size="icon" variant="ghost" className="h-8 w-8 shrink-0 text-muted-foreground" onClick={() => removeOfferFeature(offer, featureIndex)}><X className="h-4 w-4" /></Button></div>)}<Button type="button" variant="outline" className="h-10 w-full justify-start rounded-xl border-dashed text-xs font-bold text-muted-foreground" onClick={() => updateOffer(offer.months, { features: [...offer.features, ""] })}><Plus className="mr-1.5 h-3.5 w-3.5" />Πρόσθεσε παροχή</Button></div>
                </AccordionContent>
              </AccordionItem>)}
            </Accordion>
          </div>
          <div className="border-t border-border"><SettingRow label="Ορατό στους πελάτες" detail="Τα κρυφά πακέτα δεν εμφανίζονται σε Εγγραφή & Συνδρομή"><Switch checked={editing.isVisible} onCheckedChange={(value) => setEditing({ ...editing, isVisible: value })} /></SettingRow><SettingRow label="Διαθέσιμο για αναβάθμιση" detail="Ο πελάτης μπορεί να το επιλέξει στην ανανέωση"><Switch checked={editing.isUpgradable} onCheckedChange={(value) => setEditing({ ...editing, isUpgradable: value })} /></SettingRow></div>
        </div>
      </div>}
      <SheetFooter className="flex-row items-center justify-between border-t border-border px-7 py-[18px]"><Button variant="ghost" className="p-0 font-extrabold text-destructive hover:bg-transparent hover:text-destructive" onClick={() => { if (!editing?.id) return setEditing(null); void onDelete(editing).then(() => setEditing(null)); }}>Διαγραφή</Button><div className="flex gap-2"><Button variant="outline" className="rounded-full" onClick={() => setEditing(null)}>Ακύρωση</Button><Button className="h-12 rounded-full bg-foreground px-7 text-background hover:bg-foreground/90" disabled={saving} onClick={() => void onSave()}>{saving ? "Αποθήκευση..." : "Αποθήκευση"}</Button></div></SheetFooter>
    </SheetContent>
  </Sheet>;
}

function LegacyPackageBuilderSheetReference({ editing, setEditing, saving, onSave, packages, durations, onDelete }: { editing: AdminPackage | null; setEditing: React.Dispatch<React.SetStateAction<AdminPackage | null>>; saving: boolean; onSave: () => Promise<void>; packages: AdminPackage[]; durations: PackageDuration[]; onDelete: (item: AdminPackage) => Promise<void> }) {
  const packageIndex = editing ? packages.findIndex((item) => item.id === editing.id) : -1;
  const previous = packageIndex > 0 ? packages[packageIndex - 1] : null;
  const priceFor = (duration: PackageDuration) => (duration.basePriceCents + (editing?.monthlyAddonCents || 0) * duration.months) / 100;
  const setFeature = (index: number, text: string) => editing && setEditing({ ...editing, features: editing.features.map((feature, itemIndex) => itemIndex === index ? { ...feature, text } : feature) });
  return <Sheet open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}><SheetContent className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-[520px]"><SheetHeader className="flex-row items-center gap-3 border-b border-border px-7 py-[22px]"><span className="flex gap-[3px]">{[0, 1, 2, 3].map((item) => <i key={item} className={`h-[5px] w-[14px] rounded-full ${item <= Math.max(packageIndex, 0) ? "bg-accent" : "bg-muted"}`}/>)}</span><SheetTitle className="text-xl">{editing?.id ? "Επεξεργασία πακέτου" : "Νέο πακέτο"}</SheetTitle></SheetHeader>{editing && <div className="flex-1 overflow-y-auto px-7 py-[22px]"><div className="space-y-4"><div className="grid grid-cols-2 gap-3"><Field label="Όνομα"><Input className="h-12 rounded-[14px] bg-muted text-[15px] font-semibold" value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })}/></Field><Field label="Αναβάθμιση"><div className="relative"><Input className="h-12 rounded-[14px] bg-muted pr-20 text-[15px] font-semibold" type="number" min={0} value={(editing.monthlyAddonCents / 100).toFixed(2)} onChange={(event) => setEditing({ ...editing, monthlyAddonCents: Math.round(Number(event.target.value || 0) * 100) })}/><span className="pointer-events-none absolute right-4 top-[15px] text-[13px] text-muted-foreground">€ / μήνα</span></div></Field></div><div className="grid grid-cols-2 gap-3"><Field label="Ετικέτα"><Select value={editing.label || undefined} onValueChange={(value) => setEditing({ ...editing, label: value === "clear" ? null : value })}><SelectTrigger className="h-12 rounded-[14px] bg-muted">{editing.label ? <span className={`rounded-full px-2 py-1 text-[11px] font-extrabold ${editing.label === "Πλήρης πρόσβαση" ? "bg-foreground text-accent" : "bg-accent text-accent-foreground"}`}>{editing.label}</span> : <SelectValue placeholder="" />}</SelectTrigger><SelectContent><SelectItem value="clear">—</SelectItem><SelectItem value="Δημοφιλές">Δημοφιλές</SelectItem><SelectItem value="Καλύτερη τιμή">Καλύτερη τιμή</SelectItem><SelectItem value="Πλήρης πρόσβαση">Πλήρης πρόσβαση</SelectItem></SelectContent></Select></Field><Field label="Χτίζεται πάνω στο"><div className="flex h-12 items-center rounded-[14px] bg-muted px-4 text-[15px] font-semibold">{previous?.name || "Βάση"}<span className="ml-auto text-[11px] font-bold text-muted-foreground">από τη σειρά</span></div></Field></div><div className="space-y-2"><Label>Επιπλέον παροχές</Label><p className="-mt-1 text-xs text-muted-foreground">Ο πελάτης βλέπει: «{previous ? `Όλα του ${previous.name}, και:` : "Περιλαμβάνει:"}» + αυτές</p><div className="space-y-2">{editing.features.map((feature, index) => <div key={`${feature.id || "new"}-${index}`} className="flex min-h-10 items-center gap-2 rounded-xl bg-muted px-3"><GripVertical className="h-4 w-4 shrink-0 text-[#b5b5b5]"/><Input className="h-8 border-0 bg-transparent p-0 text-sm font-semibold shadow-none focus-visible:ring-0" value={feature.text} onChange={(event) => setFeature(index, event.target.value)}/><Button size="icon" variant="ghost" className="h-8 w-8 shrink-0 text-muted-foreground" onClick={() => setEditing({ ...editing, features: editing.features.filter((_, itemIndex) => itemIndex !== index) })}><X className="h-4 w-4"/></Button></div>)}<Button variant="outline" className="h-11 w-full justify-start rounded-xl border-dashed border-border text-[13px] font-bold text-muted-foreground" onClick={() => setEditing({ ...editing, features: [...editing.features, { text: "" }] })}><Plus className="mr-2 h-4 w-4"/>Πρόσθεσε παροχή</Button></div></div><div className="space-y-2"><Label>Τελικές τιμές {editing.name || "πακέτου"} <span className="font-semibold text-muted-foreground">· αυτόματα</span></Label><div className="grid grid-cols-4 gap-2">{durations.map((duration) => <div key={duration.id} className={`rounded-xl p-2 text-center ${duration.label ? "bg-[color:var(--sp-lime-soft)]" : "bg-muted"}`}><p className="text-[11px] font-extrabold text-muted-foreground">{duration.months} {duration.months === 1 ? "μήνας" : "μήνες"}</p><p className="mt-1 text-base font-extrabold">{money(priceFor(duration))}</p></div>)}</div></div><div className="border-t border-border"><SettingRow label="Ορατό στους πελάτες" detail="Τα κρυφά πακέτα δεν εμφανίζονται σε Εγγραφή & Συνδρομή"><Switch checked={editing.isVisible} onCheckedChange={(value) => setEditing({ ...editing, isVisible: value })}/></SettingRow><SettingRow label="Διαθέσιμο για αναβάθμιση" detail="Ο πελάτης μπορεί να το επιλέξει στην ανανέωση"><Switch checked={editing.isUpgradable} onCheckedChange={(value) => setEditing({ ...editing, isUpgradable: value })}/></SettingRow></div></div></div>}<SheetFooter className="flex-row items-center justify-between border-t border-border px-7 py-[18px]"><Button variant="ghost" className="p-0 font-extrabold text-destructive hover:bg-transparent hover:text-destructive" onClick={() => { if (editing?.id) void onDelete(editing); else setEditing(null); }}>Διαγραφή</Button><div className="flex gap-2"><Button variant="outline" className="rounded-full" onClick={() => setEditing(null)}>Ακύρωση</Button><Button className="h-12 rounded-full bg-foreground px-7 text-background hover:bg-foreground/90" disabled={saving} onClick={() => void onSave()}>{saving ? "Αποθήκευση..." : "Αποθήκευση"}</Button></div></SheetFooter></SheetContent></Sheet>;
}

function PackageEditorSheet({ editing, setEditing, saving, onSave }: { editing: AdminPackage | null; setEditing: React.Dispatch<React.SetStateAction<AdminPackage | null>>; saving: boolean; onSave: () => Promise<void> }) {
  return <Sheet open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}><SheetContent className="w-full overflow-y-auto sm:max-w-[520px]"><SheetHeader><SheetTitle>{editing?.id ? "Επεξεργασία πακέτου" : "Νέο πακέτο"}</SheetTitle></SheetHeader>{editing && <div className="space-y-5 py-6"><Field label="Όνομα"><Input value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })}/></Field><Field label="Μηνιαία αναβάθμιση (€)"><Input type="number" min={0} value={(editing.monthlyAddonCents / 100).toFixed(2)} onChange={(event) => setEditing({ ...editing, monthlyAddonCents: Math.round(Number(event.target.value || 0) * 100) })}/></Field><Field label="Ετικέτα"><Input value={editing.label || ""} onChange={(event) => setEditing({ ...editing, label: event.target.value || null })}/></Field><Field label="Παροχές"><div className="space-y-2">{editing.features.map((feature, index) => <div key={`${feature.id || "new"}-${index}`} className="flex gap-2"><Input value={feature.text} onChange={(event) => setEditing({ ...editing, features: editing.features.map((item, itemIndex) => itemIndex === index ? { ...item, text: event.target.value } : item) })}/><Button variant="outline" size="icon" onClick={() => setEditing({ ...editing, features: editing.features.filter((_, itemIndex) => itemIndex !== index) })}><X className="h-4 w-4"/></Button></div>)}<Button variant="outline" className="w-full rounded-xl border-dashed" onClick={() => setEditing({ ...editing, features: [...editing.features, { text: "" }] })}>+ Προσθήκη παροχής</Button></div></Field><SettingRow label="Ορατό στους πελάτες" detail="Μόνο τα ορατά πακέτα προσφέρονται για αγορά"><Switch checked={editing.isVisible} onCheckedChange={(value) => setEditing({ ...editing, isVisible: value })}/></SettingRow></div>}<SheetFooter><Button variant="outline" className="rounded-full" onClick={() => setEditing(null)}>Ακύρωση</Button><Button className="rounded-full bg-accent text-accent-foreground" disabled={saving} onClick={() => void onSave()}>Αποθήκευση</Button></SheetFooter></SheetContent></Sheet>;
}

function PackageTierCard({ pkg, index, durations, priceFor, onEdit, onDelete }: { pkg: AdminPackage; index: number; durations: PackageDuration[]; priceFor: (pkg: AdminPackage, duration: PackageDuration) => number; onEdit: () => void; onDelete: () => void }) {
  const first = durations.find((duration) => duration.months === 1) || durations[0];
  const three = durations.find((duration) => duration.months === 3) || durations[durations.length - 1];
  const inherited = index ? `Όλα του ${index === 1 ? "Βασικού" : index === 2 ? "Plus" : "Premium"}, και:` : "Περιλαμβάνει:";
  return <div className="flex min-h-[290px] flex-col gap-3 rounded-[18px] border border-border bg-card p-[18px]"><div className="flex items-center gap-2"><GripVertical className="h-4 w-4 text-[#c8c8c4]"/><h3 className="text-[17px] font-extrabold">{pkg.name}</h3>{pkg.label && <Badge className={pkg.key === "DIRECT" ? "bg-foreground text-accent" : "bg-accent text-accent-foreground"}>{pkg.label}</Badge>}<div className="ml-auto flex items-center gap-2"><span className="flex gap-[3px]">{[0, 1, 2, 3].map((item) => <i key={item} className={`h-[5px] w-[14px] rounded-full ${item <= index ? "bg-accent" : "bg-muted"}`}/>)}</span><Switch checked={pkg.isVisible} disabled /></div></div>{index ? <p className="flex h-[42px] w-[120px] items-center rounded-xl border border-border px-3 text-sm font-extrabold">+{money(pkg.monthlyAddonCents / 100).replace("€", "")}<span className="ml-auto text-xs font-semibold text-muted-foreground">€/μήνα</span></p> : <p className="flex h-[42px] items-center text-[13px] font-bold text-muted-foreground">Βάση · τιμές από τον πίνακα διάρκειας</p>}<div className="space-y-2 border-t border-border pt-3"><p className="text-xs font-extrabold text-[#3a3a3a] dark:text-foreground">{inherited} {index > 0 && <span className="text-[10px] font-bold text-muted-foreground">αυτόματα</span>}</p>{pkg.features.map((feature) => <p key={feature.id || feature.text} className="flex gap-2 text-[13px] leading-[1.4]"><span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground"><CheckCircle2 className="h-2.5 w-2.5"/></span>{feature.text}</p>)}</div><div className="mt-auto flex items-center justify-between gap-2 pt-1"><span className="text-xs text-muted-foreground">{first ? `1μ ${money(priceFor(pkg, first))}` : ""}{three ? ` · 3μ ${money(priceFor(pkg, three))}` : ""}</span><div className="flex gap-2"><Button variant="outline" className="h-9 rounded-full px-3 font-extrabold" onClick={onEdit}><Pencil className="mr-1 h-3.5 w-3.5"/>Επεξεργασία</Button>{pkg.id && <Button variant="ghost" className="h-9 px-2 text-destructive" onClick={onDelete}>×</Button>}</div></div></div>;
}

function AdminPlanCard({
  plan,
  dragProps,
  onEdit,
  onDelete,
  onDuplicate,
}: {
  plan: Plan;
  dragProps: React.HTMLAttributes<HTMLDivElement>;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
}) {
  const hidden = !plan.isActive;
  return (
    <Card
      {...dragProps}
      className={`relative flex min-h-[330px] rounded-[20px] shadow-none ${plan.isPopular ? "border-foreground bg-foreground text-background" : "border-border bg-card"} ${hidden ? "opacity-55" : ""}`}
    >
      <CardContent className="flex w-full flex-col gap-4 p-[22px]">
        <span className="absolute left-1/2 top-2 -translate-x-1/2 text-muted-foreground">
          <GripVertical className="h-4 w-4" />
        </span>
        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: plan.themeColor }}
            />
            <h2 className="font-extrabold">{plan.name}</h2>
          </div>
          <div className="flex gap-1">
            {plan.isPopular && (
              <Badge className="bg-accent text-accent-foreground">
                <Star className="mr-1 h-3 w-3 fill-current" />
                Δημοφιλές
              </Badge>
            )}
            {hidden && <Badge variant="secondary">Κρυφό</Badge>}
          </div>
        </div>
        <div>
          <p className="text-[30px] font-extrabold italic leading-none">
            {money(plan.price, plan.currency)}{" "}
            <span className="text-sm font-semibold not-italic text-muted-foreground">
              / {plan.period}
            </span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {months(plan.period) > 1
              ? `≈ ${money(Number(plan.price) / months(plan.period), plan.currency)} / μήνα`
              : "πληρωμή κάθε μήνα"}
          </p>
        </div>
        <Separator />
        <div className="space-y-2">
          {plan.features
            .filter((feature) => feature.included)
            .slice(0, 3)
            .map((feature) => (
              <p key={feature.text} className="flex items-center gap-2 text-xs">
                <CheckCircle2 className="h-3.5 w-3.5 text-accent" />
                {feature.text}
              </p>
            ))}
          {plan.features.filter((feature) => feature.included).length > 3 && (
            <p className="text-xs text-muted-foreground">
              +{plan.features.filter((feature) => feature.included).length - 3}{" "}
              ακόμη
            </p>
          )}
        </div>
        <p className="text-xs font-extrabold">
          <Star className="mr-1 inline h-3.5 w-3.5 text-accent" />
          {plan.pointsReward} πόντοι ανά πληρωμή
        </p>
        <div className="mt-auto flex gap-2">
          <Button
            className={`h-10 flex-1 rounded-full font-extrabold ${plan.isPopular ? "bg-accent text-accent-foreground hover:bg-accent/85" : "bg-foreground text-background"}`}
            onClick={onEdit}
          >
            Επεξεργασία
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  size="icon"
                  variant="outline"
                  className="h-10 w-10 rounded-full"
                />
              }
            >
              <MoreHorizontal className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>Επεξεργασία</DropdownMenuItem>
              <DropdownMenuItem onClick={onDuplicate}>
                Διπλότυπο
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDelete} variant="destructive">
                Διαγραφή
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
}

function PaymentSummary({
  settings,
  onOpen,
}: {
  settings: PaymentSettings;
  onOpen: () => void;
}) {
  const account =
    settings.bankAccounts.find((item) => item.isDefault) ||
    settings.bankAccounts[0];
  return (
    <Card className="rounded-[20px] border-border bg-card shadow-none">
      <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
        <span className="grid h-11 w-11 place-items-center rounded-[14px] bg-foreground text-accent">
          <CreditCard className="h-5 w-5" />
        </span>
        <div className="flex-1">
          <p className="font-extrabold">Πώς σε πληρώνουν</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {settings.bankTransferEnabled && account
              ? `Τραπεζικό έμβασμα · ${account.bankName} ${formatIban(account.iban).slice(0, 2)} •••• ${account.iban.slice(-4)}`
              : ""}
            {settings.bankTransferEnabled && settings.cashEnabled ? " · " : ""}
            {settings.cashEnabled ? "Μετρητά στον coach" : ""}
          </p>
        </div>
        <Button
          variant="outline"
          className="rounded-full border-foreground"
          onClick={onOpen}
        >
          Στοιχεία πληρωμής →
        </Button>
      </CardContent>
    </Card>
  );
}

function PlanEditor({
  plan,
  open,
  onOpenChange,
  setPlan,
  onSave,
  saving,
}: {
  plan: Plan | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  setPlan: (plan: Plan | null) => void;
  onSave: () => void;
  saving: boolean;
}) {
  if (!plan) return null;
  const update = <K extends keyof Plan>(key: K, value: Plan[K]) =>
    setPlan({ ...plan, [key]: value });
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto p-0 sm:max-w-[520px]">
        <SheetHeader className="border-b border-border px-6 py-5">
          <SheetTitle>
            {plan.id ? "Επεξεργασία πλάνου" : "Νέο πλάνο"}
          </SheetTitle>
        </SheetHeader>
        <div className="space-y-5 p-6">
          <Field label="Όνομα">
            <Input
              className="h-12 rounded-2xl bg-muted"
              value={plan.name}
              onChange={(event) => update("name", event.target.value)}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Τιμή">
              <Input
                className="h-12 rounded-2xl bg-muted"
                type="number"
                value={plan.price}
                onChange={(event) => update("price", event.target.value)}
              />
            </Field>
            <Field label="Διάρκεια">
              <Select
                value={plan.period}
                onValueChange={(value) => update("period", value || "Μηνιαίο")}
              >
                <SelectTrigger className="h-12 rounded-2xl bg-muted">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["Μηνιαίο", "2 μήνες", "3 μήνες", "4 μήνες", "Ετήσιο"].map(
                    (value) => (
                      <SelectItem key={value} value={value}>
                        {value}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="Περιγραφή">
            <Textarea
              className="min-h-24 rounded-2xl bg-muted"
              value={plan.description || ""}
              onChange={(event) => update("description", event.target.value)}
            />
          </Field>
          <Field label="Τι περιλαμβάνει">
            <div className="space-y-2">
              {plan.features.map((feature, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    value={feature.text}
                    onChange={(event) =>
                      update(
                        "features",
                        plan.features.map((item, i) =>
                          i === index
                            ? { ...item, text: event.target.value }
                            : item,
                        ),
                      )
                    }
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() =>
                      update(
                        "features",
                        plan.features.filter((_, i) => i !== index),
                      )
                    }
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                className="w-full rounded-xl border-dashed"
                onClick={() =>
                  update("features", [
                    ...plan.features,
                    { text: "", included: true },
                  ])
                }
              >
                + Πρόσθεσε κάτι
              </Button>
            </div>
          </Field>
          <Separator />
          <SettingRow label="Δημοφιλές" detail="Ξεχωρίζει στη σελίδα πελατών">
            <Switch
              checked={plan.isPopular}
              onCheckedChange={(value) => update("isPopular", value)}
            />
          </SettingRow>
          <SettingRow
            label="Πόντοι ανά πληρωμή"
            detail="Κερδίζονται με κάθε πληρωμή"
          >
            <Input
              className="h-10 w-24"
              type="number"
              min={0}
              value={plan.pointsReward}
              onChange={(event) =>
                update("pointsReward", Number(event.target.value) || 0)
              }
            />
          </SettingRow>
          <SettingRow label="Χρώμα" detail="Εμφάνιση πλάνου">
            <div className="flex gap-2">
              {colors.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => update("themeColor", color)}
                  className={`h-6 w-6 rounded-full ${plan.themeColor === color ? "ring-2 ring-foreground ring-offset-2" : ""}`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </SettingRow>
          <SettingRow
            label="Ορατό στους πελάτες"
            detail="Τα κρυφά πλάνα δεν εμφανίζονται"
          >
            <Switch
              checked={plan.isActive}
              onCheckedChange={(value) => update("isActive", value)}
            />
          </SettingRow>
        </div>
        <SheetFooter className="sticky bottom-0 border-t border-border bg-card p-4">
          <Button
            className="h-11 rounded-full bg-foreground px-6 text-background"
            disabled={saving || !plan.name.trim()}
            onClick={onSave}
          >
            {saving ? "Αποθήκευση..." : "Αποθήκευση"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function PaymentSettingsForm({
  settings,
  setSettings,
  onMove,
  onSave,
  saving,
}: {
  settings: PaymentSettings;
  setSettings: (settings: PaymentSettings) => void;
  onMove: (from: number, to: number) => void;
  onSave: () => void;
  saving: boolean;
}) {
  const updateAccount = (index: number, patch: Partial<BankAccount>) =>
    setSettings({
      ...settings,
      bankAccounts: settings.bankAccounts.map((account, i) =>
        i === index
          ? { ...account, ...patch }
          : patch.isDefault
            ? { ...account, isDefault: false }
            : account,
      ),
    });
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
      <Card className="rounded-[20px] border-border bg-card shadow-none">
        <CardHeader>
          <CardTitle>Πώς σε πληρώνουν οι πελάτες</CardTitle>
          <CardDescription>
            Ισχύουν για όλα τα πλάνα και εμφανίζονται στον πελάτη.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <SettingCard
              icon={<Landmark className="h-5 w-5" />}
              title="Τραπεζικό έμβασμα"
              checked={settings.bankTransferEnabled}
              onCheckedChange={(value) =>
                setSettings({ ...settings, bankTransferEnabled: value })
              }
            />
            <SettingCard
              icon={<CreditCard className="h-5 w-5" />}
              title="Μετρητά στον coach"
              checked={settings.cashEnabled}
              onCheckedChange={(value) =>
                setSettings({ ...settings, cashEnabled: value })
              }
            />
          </div>
          <div className="grid gap-3 border-t border-border pt-6 sm:grid-cols-2">
            <OnlineProviderCard
              title="Stripe"
              description="Κάρτες και Apple Pay / Google Pay όταν συνδεθεί το checkout."
              enabled={settings.stripeEnabled}
              ready={settings.stripeConfigured}
              onEnabledChange={(stripeEnabled) => setSettings({ ...settings, stripeEnabled })}
            />
            <OnlineProviderCard
              title="PayPal"
              description="PayPal checkout όταν ολοκληρωθεί η διασύνδεση."
              enabled={settings.paypalEnabled}
              ready={settings.paypalConfigured}
              onEnabledChange={(paypalEnabled) => setSettings({ ...settings, paypalEnabled })}
            >
              <Field label="Περιβάλλον">
                <Select value={settings.paypalMode} disabled>
                  <SelectTrigger><SelectValue>{settings.paypalMode === "live" ? "Live / Πραγματικές πληρωμές" : "Sandbox / Δοκιμές"}</SelectValue></SelectTrigger>
                  <SelectContent><SelectItem value="sandbox">Sandbox / Δοκιμές</SelectItem><SelectItem value="live">Live / Πραγματικές πληρωμές</SelectItem></SelectContent>
                </Select>
              </Field>
            </OnlineProviderCard>
          </div>
          {settings.bankTransferEnabled && <div>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-extrabold">Τραπεζικοί λογαριασμοί</h3>
              <Button
                variant="outline"
                className="rounded-full"
                onClick={() =>
                  setSettings({
                    ...settings,
                    bankAccounts: [...settings.bankAccounts, blankAccount()],
                  })
                }
              >
                + Προσθήκη λογαριασμού
              </Button>
            </div>
            <Accordion defaultValue={settings.bankAccounts.length ? ["account-0"] : []} className="gap-3">
              {settings.bankAccounts.map((account, index) => (
                <AccordionItem
                  key={account.id || index}
                  value={`account-${index}`}
                  className={`rounded-[16px] border ${account.isDefault ? "border-foreground" : "border-border"}`}
                >
                  <AccordionTrigger className="items-center px-4 py-3 no-underline hover:no-underline">
                    <span className="flex min-w-0 items-center gap-2 text-left">
                      <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0"><span className="block text-sm font-extrabold">{account.bankName || `Λογαριασμός ${index + 1}`}</span><span className="mt-0.5 block truncate text-xs text-muted-foreground">{account.iban ? formatIban(account.iban) : "Συμπλήρωσε τα στοιχεία"}</span></span>
                      {account.isDefault && <Badge className="ml-1 shrink-0 bg-foreground text-accent">Προεπιλογή</Badge>}
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4">
                    <div className="space-y-3 border-t border-border pt-4">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-2 text-xs text-muted-foreground">
                        <GripVertical className="h-4 w-4" />
                        Λογαριασμός {index + 1}
                      </span>
                      <div className="flex gap-2">
                        {account.isDefault ? (
                          <Badge className="bg-foreground text-accent">
                            Προεπιλογή
                          </Badge>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="rounded-full"
                            onClick={() =>
                              updateAccount(index, { isDefault: true })
                            }
                          >
                            Ορισμός ως προεπιλογή
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            setSettings({
                              ...settings,
                              bankAccounts: settings.bankAccounts.filter(
                                (_, i) => i !== index,
                              ),
                            })
                          }
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Τράπεζα">
                        <Input
                          value={account.bankName}
                          onChange={(event) =>
                            updateAccount(index, {
                              bankName: event.target.value,
                            })
                          }
                        />
                      </Field>
                      <Field label="Δικαιούχος">
                        <Input
                          value={account.accountHolder}
                          onChange={(event) =>
                            updateAccount(index, {
                              accountHolder: event.target.value,
                            })
                          }
                        />
                      </Field>
                    </div>
                    <Field label="IBAN">
                      <Input
                        value={formatIban(account.iban)}
                        onChange={(event) =>
                          updateAccount(index, {
                            iban: event.target.value
                              .replace(/\s/g, "")
                              .toUpperCase(),
                          })
                        }
                      />
                      {account.iban && (
                        <p
                          className={`mt-1 text-xs ${validIban(account.iban) ? "text-emerald-600" : "text-destructive"}`}
                        >
                          {validIban(account.iban)
                            ? "✓ Έγκυρο IBAN"
                            : "Μη έγκυρο IBAN"}
                        </p>
                      )}
                    </Field>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold">
                        Εμφάνιση στους πελάτες
                      </span>
                      <Switch
                        checked={account.isVisible}
                        onCheckedChange={(value) =>
                          updateAccount(index, { isVisible: value })
                        }
                      />
                    </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>}
          <Field label="Οδηγία αιτιολογίας">
            <Input
              value={settings.paymentReference}
              onChange={(event) =>
                setSettings({
                  ...settings,
                  paymentReference: event.target.value,
                })
              }
              placeholder="π.χ. Ονοματεπώνυμο πελάτη"
            />
          </Field>
          <Field label="Σημείωση για πελάτες">
            <Textarea
              value={settings.paymentNote}
              onChange={(event) =>
                setSettings({ ...settings, paymentNote: event.target.value })
              }
            />
          </Field>
          <Button
            className="h-11 rounded-full bg-foreground text-background"
            disabled={saving}
            onClick={onSave}
          >
            {saving ? "Αποθήκευση..." : "Αποθήκευση στοιχείων"}
          </Button>
        </CardContent>
      </Card>
      <div className="space-y-4">
        <Card className="rounded-[22px] border-[#ECECEA] bg-card shadow-none">
          <CardContent className="space-y-[14px] p-[22px]">
            <p className="text-[15px] font-extrabold">Προεπισκόπηση πελάτη</p>
            {settings.bankAccounts.filter((item) => item.isVisible).map((account) => (
              <div key={account.id || account.iban} className="space-y-3 rounded-[18px] border border-border p-[18px]">
                <div className="flex items-center gap-2.5"><span className="grid h-[34px] w-[34px] place-items-center rounded-[10px] bg-foreground text-accent"><Landmark className="h-4 w-4" /></span><div><p className="text-[14px] font-extrabold">Στοιχεία κατάθεσης</p><p className="text-[11px] text-muted-foreground">{account.bankName || "Τράπεζα"}</p></div></div>
                <PreviewValue label="Δικαιούχος" value={account.accountHolder || "Ονοματεπώνυμο δικαιούχου"} />
                <PreviewValue label="IBAN" value={formatIban(account.iban) || "GR•• •••• •••• •••• •••• •••"} mono />
                <p className="text-[12px] leading-[1.45] text-[#555555] dark:text-muted-foreground">Στην αιτιολογία γράψε <b className="text-foreground">{settings.paymentReference || "Ονοματεπώνυμο + πλάνο"}</b>.</p>
              </div>
            ))}
            {!settings.bankAccounts.some((item) => item.isVisible) && <p className="rounded-[18px] border border-dashed border-border p-4 text-sm text-muted-foreground">Πρόσθεσε έναν ορατό λογαριασμό για να δεις την προεπισκόπηση.</p>}
            <p className="text-[12px] leading-5 text-[#8A8A8A]">Οι πελάτες βλέπουν μόνο τους ενεργούς λογαριασμούς. Το κουμπί αντιγραφής αντιγράφει το IBAN χωρίς κενά.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
function OnlineProviderCard({ title, description, enabled, ready, onEnabledChange, children }: { title: string; description: string; enabled: boolean; ready: boolean; onEnabledChange: (value: boolean) => void; children?: React.ReactNode }) {
  return <Card className="rounded-[16px] border-border bg-muted/40 shadow-none"><CardContent className="space-y-4 p-4"><div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2"><CreditCard className="h-4 w-4" /><p className="font-extrabold">{title}</p>{ready ? <Badge className="bg-[color:var(--sp-lime-soft)] text-foreground">Έτοιμο</Badge> : <Badge variant="secondary">Χρειάζεται ρύθμιση</Badge>}</div><p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p></div><Switch checked={enabled} disabled={!ready} onCheckedChange={onEnabledChange} /></div>{children && <div className="space-y-3">{children}</div>}{!ready && <p className="text-xs text-muted-foreground">Τα κλειδιά διαβάζονται μόνο από τις μεταβλητές περιβάλλοντος του server. Δεν αποθηκεύονται στο διαχειριστικό.</p>}</CardContent></Card>
}

function PreviewValue({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return <div className="flex items-center gap-2 rounded-[13px] bg-muted px-[13px] py-[11px]"><div className="min-w-0 flex-1"><p className="text-[11px] text-muted-foreground">{label}</p><p className={`mt-0.5 truncate text-[13px] font-extrabold ${mono ? "font-mono text-[12px] tabular-nums" : ""}`}>{value}</p></div><Button type="button" variant="outline" size="icon" className="h-8 w-8 shrink-0 rounded-[9px] border-border" aria-label={`Αντιγραφή ${label}`}><Copy className="h-3.5 w-3.5" /></Button></div>
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Label className="flex flex-col items-start gap-2 text-sm font-bold">
      {label}
      {children}
    </Label>
  );
}
function SettingRow({
  label,
  detail,
  children,
}: {
  label: string;
  detail: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="font-bold">{label}</p>
        <p className="text-xs text-muted-foreground">{detail}</p>
      </div>
      {children}
    </div>
  );
}
function SettingCard({
  icon,
  title,
  checked,
  onCheckedChange,
}: {
  icon: React.ReactNode;
  title: string;
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-[16px] border border-border p-4">
      <span className="flex items-center gap-3 font-extrabold">
        {icon}
        {title}
      </span>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
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
