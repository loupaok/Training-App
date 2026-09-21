"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { ImageIcon, LoaderCircle, Save, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { CoachShell } from "@/components/shell/coach-shell";
import { useAuth } from "@/lib/auth/auth-context";
import { useBranding } from "@/contexts/BrandingContext";
import { api } from "@/lib/api/client";
import { resolveMediaUrl } from "@/lib/media";

interface Branding {
  appName: string;
  primaryColor: string;
  logoUrl: string | null;
  faviconUrl: string | null;
}

const emptyBranding: Branding = {
  appName: "CoachApp",
  primaryColor: "#e74c3c",
  logoUrl: null,
  faviconUrl: null,
};

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function CoachBrandingContent() {
  const { user, logout } = useAuth();
  const { refreshBranding } = useBranding();
  const logoInputRef = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);
  const [branding, setBranding] = useState<Branding>(emptyBranding);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<"logo" | "favicon" | null>(null);

  useEffect(() => {
    api
      .get<Branding>("/branding")
      .then(setBranding)
      .catch((error) => toast.error(getErrorMessage(error, "Δεν φορτώθηκαν τα στοιχεία branding.")))
      .finally(() => setLoading(false));
  }, []);

  const updateBranding = <Key extends keyof Branding>(key: Key, value: Branding[Key]) => {
    setBranding((current) => ({ ...current, [key]: value }));
  };

  const saveBranding = async () => {
    if (!/^#[0-9a-fA-F]{6}$/.test(branding.primaryColor)) {
      toast.error("Το χρώμα πρέπει να είναι σε μορφή #RRGGBB.");
      return;
    }

    setSaving(true);
    try {
      setBranding(await api.put<Branding>("/branding", {
        appName: branding.appName.trim(),
        primaryColor: branding.primaryColor,
      }));
      await refreshBranding();
      toast.success("Οι αλλαγές αποθηκεύτηκαν.");
    } catch (error) {
      toast.error(getErrorMessage(error, "Δεν έγινε η αποθήκευση."));
    } finally {
      setSaving(false);
    }
  };

  const uploadBrandImage = async (kind: "logo" | "favicon", event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(kind);
    try {
      const formData = new FormData();
      formData.append("file", file);
      setBranding(await api.upload<Branding>(`/branding/${kind}`, formData));
      await refreshBranding();
      toast.success(kind === "logo" ? "Το logo ανέβηκε." : "Το favicon ανέβηκε.");
    } catch (error) {
      toast.error(getErrorMessage(error, "Η μεταφόρτωση απέτυχε."));
    } finally {
      setUploading(null);
      event.target.value = "";
    }
  };

  const validColor = /^#[0-9a-fA-F]{6}$/.test(branding.primaryColor);

  return (
    <CoachShell title="Branding" user={user} logout={logout}>
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Branding</h1>
          <p className="mt-2 text-sm text-muted-foreground">Ρύθμισε το όνομα, το χρώμα και τα βασικά στοιχεία της εφαρμογής.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Γενικά Στοιχεία</CardTitle>
            <CardDescription>Οι αλλαγές θα εφαρμοστούν σε όλη την εφαρμογή στο επόμενο βήμα.</CardDescription>
          </CardHeader>
          <CardContent className="gap-6">
            <div className="space-y-2">
              <Label htmlFor="app-name">Όνομα Εφαρμογής</Label>
              <Input
                id="app-name"
                value={branding.appName}
                onChange={(event) => updateBranding("appName", event.target.value)}
                placeholder="CoachApp"
                disabled={loading}
              />
            </div>
            <div className="space-y-3">
              <Label htmlFor="primary-color">Βασικό χρώμα</Label>
              <div className="flex flex-wrap items-center gap-3">
                <input
                  id="primary-color"
                  type="color"
                  value={validColor ? branding.primaryColor : emptyBranding.primaryColor}
                  onChange={(event) => updateBranding("primaryColor", event.target.value)}
                  aria-label="Επιλογή βασικού χρώματος"
                  disabled={loading}
                  className="h-10 w-10 cursor-pointer rounded-full border-0 bg-transparent p-0 disabled:cursor-not-allowed"
                />
                <Input
                  value={branding.primaryColor}
                  onChange={(event) => updateBranding("primaryColor", event.target.value)}
                  className="w-36 font-mono uppercase"
                  aria-invalid={!validColor}
                  disabled={loading}
                />
                <div className="h-10 w-10 rounded-full border" style={{ backgroundColor: validColor ? branding.primaryColor : "transparent" }} />
              </div>
              <p className="text-xs text-muted-foreground">Προεπισκόπηση χρώματος</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Logo</CardTitle>
            <CardDescription>Προτεινόμενο: PNG ή SVG, διαφανές φόντο, max 2MB.</CardDescription>
          </CardHeader>
          <CardContent className="gap-5">
            <BrandImagePreview url={branding.logoUrl} type="logo" />
            <Button type="button" variant="outline" onClick={() => logoInputRef.current?.click()} disabled={uploading !== null || loading}>
              {uploading === "logo" ? <LoaderCircle className="animate-spin" /> : <Upload />}
              {uploading === "logo" ? "Ανέβασμα..." : "Ανέβασε Logo"}
            </Button>
            <input ref={logoInputRef} type="file" accept=".jpg,.jpeg,.png,.svg,.webp" onChange={(event) => uploadBrandImage("logo", event)} className="hidden" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Favicon</CardTitle>
            <CardDescription>Προτεινόμενο: PNG 32x32 ή 64x64, max 512KB.</CardDescription>
          </CardHeader>
          <CardContent className="gap-5">
            <BrandImagePreview url={branding.faviconUrl} type="favicon" />
            <Button type="button" variant="outline" onClick={() => faviconInputRef.current?.click()} disabled={uploading !== null || loading}>
              {uploading === "favicon" ? <LoaderCircle className="animate-spin" /> : <Upload />}
              {uploading === "favicon" ? "Ανέβασμα..." : "Ανέβασε Favicon"}
            </Button>
            <input ref={faviconInputRef} type="file" accept=".png,.ico,.svg" onChange={(event) => uploadBrandImage("favicon", event)} className="hidden" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Προεπισκόπηση</CardTitle>
            <CardDescription>Ένα μικρό δείγμα του header με τις τρέχουσες ρυθμίσεις.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex min-h-16 items-center gap-3 rounded-lg px-4 text-white" style={{ backgroundColor: validColor ? branding.primaryColor : emptyBranding.primaryColor }}>
              {branding.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={resolveMediaUrl(branding.logoUrl)} alt="Logo" className="max-h-10 max-w-28 object-contain" />
              ) : (
                <span className="grid h-9 w-9 place-items-center rounded bg-white/20 font-bold">{branding.appName.slice(0, 1).toUpperCase() || "C"}</span>
              )}
              <span className="font-semibold">{branding.appName || "CoachApp"}</span>
              <Separator orientation="vertical" className="mx-2 h-6 bg-white/30" />
              <span className="text-sm text-white/80">Dashboard</span>
              <span className="text-sm text-white/80">Πελάτες</span>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end pb-6">
          <Button type="button" size="lg" onClick={saveBranding} disabled={saving || loading}>
            {saving ? <LoaderCircle className="animate-spin" /> : <Save />}
            {saving ? "Αποθήκευση..." : "Αποθήκευση Αλλαγών"}
          </Button>
        </div>
      </div>
    </CoachShell>
  );
}

function BrandImagePreview({ url, type }: { url: string | null; type: "logo" | "favicon" }) {
  if (url) {
    return (
      <div className="flex min-h-20 items-center rounded-lg border bg-muted/30 p-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={resolveMediaUrl(url)} alt={type === "logo" ? "Current logo" : "Current favicon"} className={type === "logo" ? "max-h-16 max-w-full object-contain" : "h-8 w-8 object-contain"} />
      </div>
    );
  }

  return (
    <div className={`flex items-center justify-center rounded-lg border border-dashed bg-muted/30 text-muted-foreground ${type === "logo" ? "min-h-20 gap-2" : "h-12 w-12"}`}>
      <ImageIcon className="h-5 w-5" />
      {type === "logo" && <span className="text-sm">Δεν έχει οριστεί logo</span>}
    </div>
  );
}

export default function CoachBrandingPage() {
  return (
    <ProtectedRoute allow="coach">
      <CoachBrandingContent />
    </ProtectedRoute>
  );
}
