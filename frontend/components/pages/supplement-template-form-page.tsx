"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { CoachShell } from "@/components/shell/coach-shell";
import { useAuth } from "@/lib/auth/auth-context";
import { api } from "@/lib/api/client";

const CATEGORIES = [
  { value: "proteins", label: "Πρωτεΐνες" },
  { value: "amino-acids", label: "Αμινοξέα" },
  { value: "vitamins-health", label: "Βιταμίνες & Υγεία" },
  { value: "fat-burners", label: "Λιποδιαλύτες & Έλεγχος Βάρους" },
  { value: "creatine", label: "Κρεατίνες" },
  { value: "pre-workout", label: "Pre-Workout & Ενέργεια" },
  { value: "carbohydrates", label: "Υδατάνθρακες" },
  { value: "foods", label: "Τρόφιμα" },
] as const;

type SupplementItem = { category: string; name: string; dosage: string; timing: string; notes: string };
type SupplementTemplate = { title: string; description: string; notes: string; items: SupplementItem[] };

const emptyItem = (): SupplementItem => ({ category: "proteins", name: "", dosage: "", timing: "", notes: "" });
const emptyTemplate = (): SupplementTemplate => ({ title: "", description: "", notes: "", items: [emptyItem()] });

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function SupplementTemplateFormContent({ templateId }: { templateId: string | null }) {
  const { user, logout } = useAuth();
  const [template, setTemplate] = useState<SupplementTemplate>(emptyTemplate);
  const [loading, setLoading] = useState(Boolean(templateId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!templateId) return;
    api.get<SupplementTemplate>(`/templates/supplements/${templateId}`)
      .then((data) => setTemplate({
        title: data.title || "",
        description: data.description || "",
        notes: data.notes || "",
        items: Array.isArray(data.items) && data.items.length ? data.items.map((item) => ({ ...emptyItem(), ...item })) : [emptyItem()],
      }))
      .catch((requestError) => setError(getErrorMessage(requestError, "Δεν φορτώθηκε το πρότυπο.")))
      .finally(() => setLoading(false));
  }, [templateId]);

  const updateItem = (index: number, patch: Partial<SupplementItem>) => {
    setTemplate((current) => ({ ...current, items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item) }));
  };

  const save = async () => {
    if (!template.title.trim()) {
      setError("Ο τίτλος του προτύπου είναι υποχρεωτικός.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      if (templateId) await api.put(`/templates/supplements/${templateId}`, template);
      else await api.post("/templates/supplements", template);
      window.location.assign("/coach/templates/supplements");
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Δεν αποθηκεύτηκε το πρότυπο."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <CoachShell title={templateId ? "Επεξεργασία Προτύπου Συμπληρωμάτων" : "Νέο Πρότυπο Συμπληρωμάτων"} user={user} logout={logout}>
      <div className="mx-auto max-w-5xl">
        <Button variant="ghost" size="sm" className="mb-4" nativeButton={false} render={<Link href="/coach/templates/supplements" />}><ChevronLeft />Πρότυπα Συμπληρωμάτων</Button>
        <h1 className="text-3xl font-bold">{templateId ? "Επεξεργασία Προτύπου" : "Νέο Πρότυπο Συμπληρωμάτων"}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Οργάνωσε τις προτάσεις συμπληρωμάτων. Η σύνδεση με πλάνο πελάτη θα προστεθεί στο επόμενο βήμα.</p>

        {error && <div className="mt-5 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">{error}</div>}
        {loading ? <p className="mt-8 text-sm text-muted-foreground">Φόρτωση...</p> : (
          <div className="mt-6 space-y-5">
            <Card>
              <CardContent className="grid gap-4 pt-6">
                <Label>Τίτλος<Input className="mt-2" value={template.title} onChange={(event) => setTemplate((current) => ({ ...current, title: event.target.value }))} placeholder="π.χ. Βασικό καθημερινό stack" /></Label>
                <Label>Περιγραφή<Textarea className="mt-2" value={template.description} onChange={(event) => setTemplate((current) => ({ ...current, description: event.target.value }))} placeholder="Για ποιον στόχο ή περίοδο είναι;" /></Label>
                <Label>Γενικές σημειώσεις<Textarea className="mt-2" value={template.notes} onChange={(event) => setTemplate((current) => ({ ...current, notes: event.target.value }))} placeholder="Προειδοποιήσεις ή γενικές οδηγίες." /></Label>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex-row items-center justify-between"><CardTitle>Συμπληρώματα</CardTitle><Button size="sm" variant="outline" onClick={() => setTemplate((current) => ({ ...current, items: [...current.items, emptyItem()] }))}><Plus />Προσθήκη</Button></CardHeader>
              <CardContent className="space-y-3">
                {template.items.map((item, index) => (
                  <div key={index} className="grid gap-3 rounded-lg border bg-muted/20 p-4 md:grid-cols-[minmax(10rem,1fr)_minmax(11rem,1.2fr)_9rem_10rem_auto] md:items-end">
                    <Label>Κατηγορία
                      <Select value={item.category} onValueChange={(value) => updateItem(index, { category: value || "proteins" })}>
                        <SelectTrigger className="mt-2 w-full"><SelectValue /></SelectTrigger>
                        <SelectContent>{CATEGORIES.map((category) => <SelectItem key={category.value} value={category.value}>{category.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </Label>
                    <Label>Συμπλήρωμα<Input className="mt-2" value={item.name} onChange={(event) => updateItem(index, { name: event.target.value })} placeholder="π.χ. Creatine monohydrate" /></Label>
                    <Label>Δόση<Input className="mt-2" value={item.dosage} onChange={(event) => updateItem(index, { dosage: event.target.value })} placeholder="5 g" /></Label>
                    <Label>Πότε<Input className="mt-2" value={item.timing} onChange={(event) => updateItem(index, { timing: event.target.value })} placeholder="Μετά την προπόνηση" /></Label>
                    <Button size="icon-sm" variant="ghost" aria-label="Αφαίρεση" disabled={template.items.length === 1} onClick={() => setTemplate((current) => ({ ...current, items: current.items.filter((_, itemIndex) => itemIndex !== index) }))}><Trash2 className="text-destructive" /></Button>
                    <Label className="md:col-span-4">Σημειώσεις<Textarea className="mt-2 min-h-12" value={item.notes} onChange={(event) => updateItem(index, { notes: event.target.value })} placeholder="Προαιρετικές οδηγίες." /></Label>
                  </div>
                ))}
              </CardContent>
            </Card>
            <div className="flex justify-end"><Button disabled={saving} onClick={save}>{saving ? "Αποθήκευση..." : "Αποθήκευση Προτύπου"}</Button></div>
          </div>
        )}
      </div>
    </CoachShell>
  );
}

export default function SupplementTemplateFormPage({ templateId }: { templateId: string | null }) {
  return <ProtectedRoute allow="coach"><SupplementTemplateFormContent templateId={templateId} /></ProtectedRoute>;
}
