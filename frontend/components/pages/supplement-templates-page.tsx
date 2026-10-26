"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ClipboardList, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { CoachShell } from "@/components/shell/coach-shell";
import { useAuth } from "@/lib/auth/auth-context";
import { api } from "@/lib/api/client";

interface SupplementTemplateRow {
  id: number | string;
  title: string;
  description?: string | null;
  item_count?: number;
  updated_at?: string;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function SupplementTemplatesContent() {
  const { user, logout } = useAuth();
  const [templates, setTemplates] = useState<SupplementTemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadTemplates = () => {
    setLoading(true);
    api.get<SupplementTemplateRow[]>("/templates/supplements")
      .then(setTemplates)
      .catch((requestError) => setError(getErrorMessage(requestError, "Δεν φορτώθηκαν τα πρότυπα συμπληρωμάτων.")))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadTemplates(); }, []);

  const deleteTemplate = async (template: SupplementTemplateRow) => {
    if (!window.confirm(`Να διαγραφεί το πρότυπο «${template.title}»;`)) return;
    try {
      await api.delete(`/templates/supplements/${template.id}`);
      loadTemplates();
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Δεν διαγράφηκε το πρότυπο."));
    }
  };

  return (
    <CoachShell title="Πρότυπα Συμπληρωμάτων" user={user} logout={logout}>
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Πρότυπα Συμπληρωμάτων</h1>
            <p className="mt-2 text-sm text-muted-foreground">Φτιάξε επαναχρησιμοποιήσιμες προτάσεις συμπληρωμάτων ανά στόχο ή περίοδο.</p>
          </div>
          <Button nativeButton={false} render={<Link href="/coach/templates/supplements/new" />}><Plus />Νέο Πρότυπο</Button>
        </div>

        {error && <div className="mb-5 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">{error}</div>}
        {loading && <p className="text-sm text-muted-foreground">Φόρτωση...</p>}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <Card key={template.id} className="flex min-h-48 flex-col">
              <CardHeader>
                <CardTitle className="text-lg">{template.title}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col">
                <p className="line-clamp-3 text-sm text-muted-foreground">{template.description || "Χωρίς περιγραφή."}</p>
                <p className="mt-4 text-xs font-semibold text-muted-foreground">{template.item_count || 0} συμπληρώματα</p>
                <div className="mt-auto flex gap-2 pt-5">
                  <Button size="sm" variant="outline" nativeButton={false} render={<Link href={`/coach/templates/supplements/${template.id}`} />}><Pencil />Επεξεργασία</Button>
                  <Button size="icon-sm" variant="ghost" aria-label="Διαγραφή" onClick={() => deleteTemplate(template)}><Trash2 className="text-destructive" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {!loading && !templates.length && (
            <div className="col-span-full grid min-h-56 place-items-center rounded-lg border border-dashed text-center">
              <div><ClipboardList className="mx-auto size-7 text-muted-foreground" /><p className="mt-3 text-sm font-semibold">Δεν υπάρχουν πρότυπα ακόμη.</p></div>
            </div>
          )}
        </div>
      </div>
    </CoachShell>
  );
}

export default function SupplementTemplatesPage() {
  return <ProtectedRoute allow="coach"><SupplementTemplatesContent /></ProtectedRoute>;
}
