"use client";

import { useEffect, useMemo, useState } from "react";
import { CoachShell } from "@/components/shell/coach-shell";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth/auth-context";
import { api } from "@/lib/api/client";

interface PointsSettings {
  points_per_euro: number;
  euro_per_points: number;
  coupon_expiry_days: number;
  min_points_redeem: number;
  max_discount_percent: number;
  is_active: boolean | number;
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

function CoachPointsContent() {
  const { user, logout } = useAuth();
  const [settings, setSettings] = useState<PointsSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [wcStatus, setWcStatus] = useState<{ connected: boolean; store?: string; message?: string } | null>(null);
  const [testingWc, setTestingWc] = useState(false);

  const [clients, setClients] = useState<ClientRow[]>([]);
  const [clientPoints, setClientPoints] = useState<Record<string, ClientPoints>>({});

  const [awardOpen, setAwardOpen] = useState(false);
  const [awardClientId, setAwardClientId] = useState("");
  const [awardPoints, setAwardPoints] = useState("100");
  const [awardDescription, setAwardDescription] = useState("");
  const [awarding, setAwarding] = useState(false);

  useEffect(() => {
    api.get<PointsSettings>("/points/settings").then(setSettings).catch(() => {});
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
      });
      setSettings(saved);
      setMessage("Οι ρυθμίσεις αποθηκεύτηκαν.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Δεν αποθηκεύτηκαν οι ρυθμίσεις.");
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async () => {
    setTestingWc(true);
    setWcStatus(null);
    try {
      const result = await api.get<{ connected: boolean; store?: string; message?: string }>("/points/wc-test");
      setWcStatus(result);
    } catch (err) {
      setWcStatus({ connected: false, message: err instanceof Error ? err.message : "Σφάλμα σύνδεσης." });
    } finally {
      setTestingWc(false);
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

  return (
    <CoachShell title="Πόντοι & Rewards" user={user} logout={logout}>
      <div className="mx-auto max-w-4xl space-y-6">
        {message && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200">{message}</div>}
        {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200">{error}</div>}

        <Card className="p-6">
          <h2 className="text-xl font-bold">Ρυθμίσεις Πόντων</h2>
          {settings && (
            <div className="mt-5 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Label className="flex flex-col items-start gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
                  Πόντοι ανά €
                  <Input type="number" value={settings.points_per_euro} onChange={(e) => update("points_per_euro", Number(e.target.value) || 0)} />
                  <span className="text-xs font-semibold text-slate-400">100 πόντοι = 1€ έκπτωση</span>
                </Label>
                <Label className="flex flex-col items-start gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
                  Ελάχιστοι για εξαργύρωση
                  <Input type="number" value={settings.min_points_redeem} onChange={(e) => update("min_points_redeem", Number(e.target.value) || 0)} />
                </Label>
                <Label className="flex flex-col items-start gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
                  Λήξη coupon (μέρες)
                  <Input type="number" value={settings.coupon_expiry_days} onChange={(e) => update("coupon_expiry_days", Number(e.target.value) || 0)} />
                </Label>
                <Label className="flex flex-col items-start gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
                  Μέγιστη έκπτωση (%)
                  <Input type="number" value={settings.max_discount_percent} onChange={(e) => update("max_discount_percent", Number(e.target.value) || 0)} />
                </Label>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Ενεργό</span>
                <Switch checked={Boolean(settings.is_active)} onCheckedChange={(checked) => update("is_active", checked === true)} />
              </div>
              <Button onClick={saveSettings} disabled={saving} className="font-bold">
                💾 Αποθήκευση
              </Button>
            </div>
          )}
        </Card>

        <Card className="p-6">
          <h2 className="text-xl font-bold">WooCommerce Status</h2>
          <p className="mt-2 text-sm font-semibold text-slate-500 dark:text-slate-400">Ελέγχει αν η σύνδεση με το WooCommerce store λειτουργεί.</p>
          <div className="mt-4 flex items-center gap-3">
            <Button variant="outline" onClick={testConnection} disabled={testingWc} className="font-bold">
              🔗 {testingWc ? "Δοκιμή..." : "Δοκιμή Σύνδεσης"}
            </Button>
            {wcStatus && (
              <span className={wcStatus.connected ? "font-bold text-emerald-600" : "font-bold text-red-600"}>
                {wcStatus.connected ? `✅ Συνδέθηκε (${wcStatus.store})` : `❌ Σφάλμα: ${wcStatus.message}`}
              </span>
            )}
          </div>
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
              {clients.map((client) => {
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
                  <SelectValue placeholder="Επίλεξε πελάτη" />
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
