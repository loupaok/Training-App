"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { LoaderCircle, Upload } from "lucide-react";
import { CoachShell } from "@/components/shell/coach-shell";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth/auth-context";
import { api } from "@/lib/api/client";
import { BrandingData, useBranding } from "@/contexts/BrandingContext";
import { resolveMediaUrl } from "@/lib/media";

interface PointsSettings {
  points_per_euro: number;
  euro_per_points: number;
  coupon_expiry_days: number;
  min_points_redeem: number;
  max_discount_percent: number;
  is_active: boolean | number;
  shop_url: string | null;
  cashback_percent: number;
  weekly_update_points: number;
  weekly_streak_bonus_points: number;
  early_renewal_days: number;
  early_renewal_points: number;
  loyalty_3_month_points: number;
  loyalty_6_month_points: number;
  loyalty_9_month_points: number;
  loyalty_12_month_points: number;
  birthday_points: number;
  referral_points: number;
}

interface ClientRow {
  id: number | string;
  full_name?: string;
  email?: string;
}

interface ClientPoints {
  totalPoints: number;
  usedPoints: number;
  availablePoints: number;
}

interface MediaAsset {
  id: string | number;
  title: string;
  url: string;
  assetType?: string;
  folderName?: string;
}

function CoachPointsContent() {
  const { user, logout } = useAuth();
  const { refreshBranding } = useBranding();
  const [settings, setSettings] = useState<PointsSettings | null>(null);
  const [branding, setBranding] = useState<BrandingData | null>(null);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [mediaAssets, setMediaAssets] = useState<MediaAsset[]>([]);
  const [loadingMedia, setLoadingMedia] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");


  const [clients, setClients] = useState<ClientRow[]>([]);
  const [visibleClients, setVisibleClients] = useState(10);
  const [clientPoints, setClientPoints] = useState<Record<string, ClientPoints>>({});

  const [awardOpen, setAwardOpen] = useState(false);
  const [awardClientId, setAwardClientId] = useState("");
  const [awardPoints, setAwardPoints] = useState("100");
  const [awardDescription, setAwardDescription] = useState("");
  const [awarding, setAwarding] = useState(false);

  useEffect(() => {
    api.get<PointsSettings>("/points/settings").then(setSettings).catch(() => {});
    api.get<BrandingData>("/branding").then(setBranding).catch(() => {});
    api
      .get<ClientRow[]>("/clients")
      .then((rows) => {
        setClients(rows);
        rows.forEach((row) => {
          api
            .get<ClientPoints>(`/points/client/${row.id}`)
            .then((data) => setClientPoints((current) => ({ ...current, [String(row.id)]: data })))
            .catch(() => {});
        });
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!mediaPickerOpen) return;
    setLoadingMedia(true);
    api.get<MediaAsset[]>("/media?limit=60")
      .then((assets) => setMediaAssets(assets.filter((asset) => asset.assetType === "photo")))
      .catch(() => setMediaAssets([]))
      .finally(() => setLoadingMedia(false));
  }, [mediaPickerOpen]);

  const update = <K extends keyof PointsSettings>(key: K, value: PointsSettings[K]) =>
    setSettings((current) => (current ? { ...current, [key]: value } : current));

  const saveSettings = async () => {
    if (!settings) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const saved = await api.put<PointsSettings>("/points/settings", {
        pointsPerEuro: Number(settings.points_per_euro),
        euroPerPoints: Number(settings.euro_per_points),
        couponExpiryDays: Number(settings.coupon_expiry_days),
        minPointsRedeem: Number(settings.min_points_redeem),
        maxDiscountPercent: Number(settings.max_discount_percent),
        isActive: Boolean(settings.is_active),
        shopUrl: settings.shop_url || "",
        cashbackPercent: Number(settings.cashback_percent),
        weeklyUpdatePoints: Number(settings.weekly_update_points),
        weeklyStreakBonusPoints: Number(settings.weekly_streak_bonus_points),
        earlyRenewalDays: Number(settings.early_renewal_days),
        earlyRenewalPoints: Number(settings.early_renewal_points),
        loyalty3MonthPoints: Number(settings.loyalty_3_month_points),
        loyalty6MonthPoints: Number(settings.loyalty_6_month_points),
        loyalty9MonthPoints: Number(settings.loyalty_9_month_points),
        loyalty12MonthPoints: Number(settings.loyalty_12_month_points),
        birthdayPoints: Number(settings.birthday_points),
        referralPoints: Number(settings.referral_points),
      });
      setSettings(saved);
      setMessage("Οι ρυθμίσεις αποθηκεύτηκαν.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Δεν αποθηκεύτηκαν οι ρυθμίσεις.");
    } finally {
      setSaving(false);
    }
  };

  const uploadBanner = async (file?: File) => {
    if (!file) return;
    setUploadingBanner(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const saved = await api.upload<BrandingData>("/branding/eshop-banner", formData);
      setBranding(saved);
      await refreshBranding();
      setMessage("Η φωτογραφία του banner αποθηκεύτηκε.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Δεν ανέβηκε η φωτογραφία του banner.");
    } finally {
      setUploadingBanner(false);
    }
  };

  const testConnection = async () => {
    setError("");
    setMessage("");
    try {
      const result = await api.get<{ connected: boolean; store?: string; message?: string }>("/points/wc-test");
      setMessage(result.connected ? `Συνδέθηκε με ${result.store || "WooCommerce"}.` : `Δεν συνδέθηκε: ${result.message || "άγνωστο σφάλμα"}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Δεν ήταν δυνατή η σύνδεση με WooCommerce.");
    }
  };

  const chooseMediaBanner = async (asset: MediaAsset) => {
    setError("");
    try {
      const saved = await api.put<BrandingData>("/branding/eshop-banner/library", { url: asset.url });
      setBranding(saved);
      setMediaPickerOpen(false);
      await refreshBranding();
      setMessage("Η φωτογραφία από τη Media Library επιλέχθηκε.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Δεν ενημερώθηκε η φωτογραφία banner.");
    }
  };

  const submitAward = async () => {
    if (!awardClientId || !awardPoints) return;
    setAwarding(true);
    setError("");
    try {
      const result = await api.post<ClientPoints>("/points/award", {
        clientId: Number(awardClientId),
        points: Number(awardPoints),
        description: awardDescription || undefined,
      });
      setClientPoints((current) => ({ ...current, [awardClientId]: result }));
      setMessage("Οι πόντοι προστέθηκαν.");
      setAwardOpen(false);
      setAwardClientId("");
      setAwardPoints("100");
      setAwardDescription("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Δεν προστέθηκαν οι πόντοι.");
    } finally {
      setAwarding(false);
    }
  };

  const clientOptions = useMemo(() => clients.map((c) => ({ value: String(c.id), label: c.full_name || c.email || `#${c.id}` })), [clients]);
  const cashbackPercent = Number(settings?.cashback_percent || 0);
  const cashbackExamples = [105, 190, 270, 350].map((amount) => ({ amount, points: Math.round(amount * cashbackPercent) }));

  return (
    <CoachShell title="Πόντοι & Rewards" user={user} logout={logout}>
      <div className="mx-auto max-w-4xl space-y-6">
        {message && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200">{message}</div>}
        {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200">{error}</div>}

        <Card className="p-6">
          <h2 className="text-xl font-bold">Ρυθμίσεις Πόντων</h2>
          {settings && (
            <div className="mt-5 space-y-4">
              <div className="rounded-[16px] border border-border bg-muted/40 p-4">
                <p className="text-[15px] font-extrabold">Αυτόματες επιβραβεύσεις</p>
                <p className="mt-1 text-xs text-muted-foreground">Οι πόντοι δίνονται μόνο αφού ολοκληρωθεί η αντίστοιχη ενέργεια.</p>
                <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  <Label className="space-y-2 sm:col-span-2 xl:col-span-3"><span>Επιστροφή σε πληρωμή (%)</span><div className="flex items-center gap-3"><Input type="number" min="0" max="100" step="0.1" value={settings.cashback_percent} onChange={(e) => update("cashback_percent", Number(e.target.value) || 0)} /><span className="inline-flex h-11 shrink-0 items-center rounded-full bg-foreground px-4 text-sm font-extrabold text-background">{cashbackPercent.toLocaleString("el-GR")}%</span></div><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{cashbackExamples.map(({ amount, points }) => <span key={amount} className="rounded-[12px] bg-card p-3 text-xs text-muted-foreground"><b className="block text-sm text-foreground">{amount} € → {points.toLocaleString("el-GR")}</b>πόντοι · {(points / 100).toLocaleString("el-GR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</span>)}</div></Label>
                  <Label className="space-y-2"><span>Έγκαιρο weekly update</span><Input type="number" min="0" value={settings.weekly_update_points} onChange={(e) => update("weekly_update_points", Number(e.target.value) || 0)} /><small className="text-xs text-muted-foreground">1ο, 2ο και 3ο της τετράδας</small></Label>
                  <Label className="space-y-2"><span>Bonus 4 συνεχόμενων updates</span><Input type="number" min="0" value={settings.weekly_streak_bonus_points} onChange={(e) => update("weekly_streak_bonus_points", Number(e.target.value) || 0)} /><small className="text-xs text-muted-foreground">Το 4ο δίνει το bonus αντί για τους 100</small></Label>
                  <Label className="space-y-2"><span>Έγκαιρη ανανέωση (ημέρες πριν)</span><Input type="number" min="0" value={settings.early_renewal_days} onChange={(e) => update("early_renewal_days", Number(e.target.value) || 0)} /></Label>
                  <Label className="space-y-2"><span>Bonus έγκαιρης ανανέωσης</span><Input type="number" min="0" value={settings.early_renewal_points} onChange={(e) => update("early_renewal_points", Number(e.target.value) || 0)} /></Label>
                  <Label className="space-y-2"><span>Δώρο γενεθλίων</span><Input type="number" min="0" value={settings.birthday_points} onChange={(e) => update("birthday_points", Number(e.target.value) || 0)} /></Label>
                  <Label className="space-y-2"><span>Πρότεινε φίλο</span><Input type="number" min="0" value={settings.referral_points} onChange={(e) => update("referral_points", Number(e.target.value) || 0)} /><small className="text-xs text-muted-foreground">Δίνεται χειροκίνητα μέχρι να προστεθεί referral link.</small></Label>
                </div>
                <div className="mt-4 grid grid-cols-4 gap-2">
                  {[[3, settings.loyalty_3_month_points], [6, settings.loyalty_6_month_points], [9, settings.loyalty_9_month_points], [12, settings.loyalty_12_month_points]].map(([months, points]) => <Label key={months} className="space-y-2 text-center"><span>{months} μήνες χωρίς διακοπή</span><Input type="number" min="0" value={points} onChange={(e) => update(`loyalty_${months}_month_points` as keyof PointsSettings, Number(e.target.value) || 0)} /></Label>)}
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Label className="space-y-2"><span>Γενική ισοτιμία κουπονιού</span><div className="flex items-center gap-3"><Input type="number" min="1" value={settings.euro_per_points} onChange={(e) => update("euro_per_points", Number(e.target.value) || 100)} /><span className="shrink-0 text-sm font-extrabold">πόντοι = 1 €</span></div></Label>
                <Label className="space-y-2"><span>Λήξη κουπονιού (ημέρες)</span><Input type="number" min="1" value={settings.coupon_expiry_days} onChange={(e) => update("coupon_expiry_days", Number(e.target.value) || 1)} /><small className="text-xs text-muted-foreground">Από την ημέρα δημιουργίας του coupon.</small></Label>
              </div>
              <Button onClick={saveSettings} disabled={saving} className="font-bold">
                Αποθήκευση
              </Button>
            </div>
          )}
        </Card>

        <Card className="rounded-[20px] border-border shadow-none">
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
            {branding?.eshopBannerImageUrl ? <img src={resolveMediaUrl(branding.eshopBannerImageUrl)} alt="Banner eshop" className="h-20 w-full rounded-[14px] border border-border object-cover sm:w-40" /> : <div className="grid h-20 w-full place-items-center rounded-[14px] bg-muted text-xs font-bold text-muted-foreground sm:w-40">Χωρίς φωτογραφία</div>}
            <div className="min-w-0 flex-1"><h2 className="text-[16px] font-extrabold">Φωτογραφία banner eshop</h2><p className="mt-1 text-xs text-muted-foreground">Η εικόνα εμφανίζεται στη σελίδα Πόντοι & Rewards του πελάτη.</p></div>
            <div className="flex shrink-0 flex-wrap gap-2"><Button type="button" variant="outline" onClick={() => setMediaPickerOpen(true)}>Media Library</Button><Button type="button" variant="outline" onClick={() => bannerInputRef.current?.click()} disabled={uploadingBanner}>{uploadingBanner ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}{uploadingBanner ? "Ανέβασμα..." : "Ανέβασε φωτογραφία"}</Button></div>
            <input ref={bannerInputRef} type="file" accept=".jpg,.jpeg,.png" className="hidden" onChange={(event) => void uploadBanner(event.target.files?.[0])} />
          </CardContent>
        </Card>

        <Card className="rounded-[20px] border-border shadow-none">
          <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
            <div><h2 className="text-[16px] font-extrabold">WooCommerce</h2><p className="mt-1 text-xs text-muted-foreground">Έλεγχος σύνδεσης για δημιουργία και έλεγχο κουπονιών.</p></div>
            <Button type="button" variant="outline" onClick={() => void testConnection()}>Δοκιμή σύνδεσης</Button>
          </CardContent>
        </Card>

        <Card className="overflow-hidden p-0">
          <CardHeader className="flex flex-row items-center justify-between border-b border-slate-200 px-6 py-5 dark:border-slate-800">
            <CardTitle className="text-xl font-bold">Πόντοι Πελατών</CardTitle>
            <Button onClick={() => setAwardOpen(true)} className="font-bold">
              + Χειροκίνητη Προσθήκη
            </Button>
          </CardHeader>
          <Table>
            <TableHeader className="border-b border-slate-200 bg-slate-50 text-xs font-bold text-slate-500 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-400">
              <TableRow>
                <TableHead className="px-5 py-4">Πελάτης</TableHead>
                <TableHead className="px-5 py-4">Σύνολο</TableHead>
                <TableHead className="px-5 py-4">Διαθέσιμοι</TableHead>
                <TableHead className="px-5 py-4">Χρησιμοποιημένοι</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-slate-100 dark:divide-slate-800">
              {clients.slice(0, visibleClients).map((client) => {
                const points = clientPoints[String(client.id)];
                return (
                  <TableRow key={client.id}>
                    <TableCell className="px-5 py-4 font-semibold text-slate-700 dark:text-slate-200">{client.full_name || client.email}</TableCell>
                    <TableCell className="px-5 py-4">{points?.totalPoints ?? 0}</TableCell>
                    <TableCell className="px-5 py-4 font-bold text-primary">{points?.availablePoints ?? 0}</TableCell>
                    <TableCell className="px-5 py-4 text-slate-500 dark:text-slate-400">{points?.usedPoints ?? 0}</TableCell>
                  </TableRow>
                );
              })}
              {!clients.length && (
                <TableRow>
                  <TableCell colSpan={4} className="px-5 py-10 text-center font-semibold text-slate-500 dark:text-slate-400">
                    Δεν υπάρχουν πελάτες ακόμα.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          {clients.length > visibleClients && <div className="border-t border-border p-3 text-center"><Button type="button" variant="outline" size="sm" onClick={() => setVisibleClients((count) => count + 10)}>Δες περισσότερα</Button></div>}
        </Card>
      </div>

      <Dialog open={awardOpen} onOpenChange={setAwardOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Χειροκίνητη Προσθήκη Πόντων</DialogTitle>
            <DialogDescription>Προσθέτει πόντους σε έναν πελάτη, ανεξάρτητα από πληρωμή.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Label className="flex flex-col items-start gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
              Πελάτης
              <Select value={awardClientId} onValueChange={(value) => value && setAwardClientId(value)}>
                <SelectTrigger className="h-11 w-full">
                  <SelectValue placeholder="Επίλεξε πελάτη">
                    {(value: string) => clientOptions.find((option) => option.value === value)?.label ?? ""}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {clientOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Label>
            <Label className="flex flex-col items-start gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
              Πόντοι
              <Input type="number" value={awardPoints} onChange={(e) => setAwardPoints(e.target.value)} />
            </Label>
            <Label className="flex flex-col items-start gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
              Περιγραφή (προαιρετικό)
              <Input value={awardDescription} onChange={(e) => setAwardDescription(e.target.value)} placeholder="π.χ. Bonus πρόοδου" />
            </Label>
          </div>
          <DialogFooter>
            <Button onClick={submitAward} disabled={awarding || !awardClientId} className="font-bold">
              Αποθήκευση
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={mediaPickerOpen} onOpenChange={setMediaPickerOpen}>
        <DialogContent className="max-h-[88vh] max-w-4xl overflow-hidden">
          <DialogHeader>
            <DialogTitle>Επιλογή από Media Library</DialogTitle>
            <DialogDescription>Διάλεξε μια ήδη αποθηκευμένη φωτογραφία για το banner του e-shop.</DialogDescription>
          </DialogHeader>
          <div className="grid max-h-[62vh] grid-cols-2 gap-3 overflow-y-auto pr-1 sm:grid-cols-3 md:grid-cols-4">
            {loadingMedia && <p className="col-span-full py-10 text-center text-sm text-muted-foreground">Φόρτωση φωτογραφιών…</p>}
            {!loadingMedia && !mediaAssets.length && <p className="col-span-full py-10 text-center text-sm text-muted-foreground">Δεν υπάρχουν διαθέσιμες φωτογραφίες στη Media Library.</p>}
            {mediaAssets.map((asset) => <button key={asset.id} type="button" onClick={() => void chooseMediaBanner(asset)} className="overflow-hidden rounded-[14px] border border-border bg-card text-left transition-colors hover:border-foreground"><img src={resolveMediaUrl(asset.url)} alt="" className="aspect-[4/3] w-full object-cover" /><span className="block truncate p-2.5 text-xs font-extrabold">{asset.title}</span></button>)}
          </div>
        </DialogContent>
      </Dialog>
    </CoachShell>
  );
}

export default function CoachPointsPage() {
  return (
    <ProtectedRoute allow="coach">
      <CoachPointsContent />
    </ProtectedRoute>
  );
}
