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
import { useBranding, type BrandingData } from "@/contexts/BrandingContext";
import { api } from "@/lib/api/client";
import { resolveMediaUrl } from "@/lib/media";

type Branding = BrandingData;

const emptyBranding: Branding = {
  appName: "CoachApp",
  primaryColor: "#e74c3c",
  fontColor: "#1a1a2e",
  titleColor: "#1a1a2e",
  buttonColor: "#e74c3c",
  buttonHoverColor: "#c0392b",
  buttonTextColor: "#ffffff",
  logoUrl: null,
  faviconUrl: null,
  loginBackgroundUrl: null,
};

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function isHexColor(value: string) {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}

function ColorField({ id, label, value, fallback, disabled, onChange }: {
  id: string;
  label: string;
  value: string;
  fallback: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const valid = isHexColor(value);

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex flex-wrap items-center gap-3">
        <input
          id={id}
          type="color"
          value={valid ? value : fallback}
          onChange={(event) => onChange(event.target.value)}
          aria-label={`Επιλογή ${label.toLowerCase()}`}
          disabled={disabled}
          className="h-10 w-10 cursor-pointer rounded-full border-0 bg-transparent p-0 disabled:cursor-not-allowed"
        />
        <Input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-36 font-mono uppercase"
          aria-invalid={!valid}
          disabled={disabled}
        />
        <div className="h-10 w-10 rounded-full border" style={{ backgroundColor: valid ? value : "transparent" }} aria-label={`Προεπισκόπηση ${label.toLowerCase()}`} />
      </div>
    </div>
  );
}

function CoachBrandingContent() {
  const { user, logout } = useAuth();
  const { refreshBranding } = useBranding();
  const logoInputRef = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);
  const loginBackgroundInputRef = useRef<HTMLInputElement>(null);
  const [branding, setBranding] = useState<Branding>(emptyBranding);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<"logo" | "favicon" | "login-background" | null>(null);

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
    if (![branding.primaryColor, branding.fontColor, branding.titleColor, branding.buttonColor, branding.buttonHoverColor, branding.buttonTextColor].every(isHexColor)) {
      toast.error("Το χρώμα πρέπει να είναι σε μορφή #RRGGBB.");
      return;
    }

    setSaving(true);
    try {
      setBranding(await api.put<Branding>("/branding", {
        appName: branding.appName.trim(),
        primaryColor: branding.primaryColor,
        fontColor: branding.fontColor,
        titleColor: branding.titleColor,
        buttonColor: branding.buttonColor,
        buttonHoverColor: branding.buttonHoverColor,
        buttonTextColor: branding.buttonTextColor,
      }));
      await refreshBranding();
      toast.success("Οι αλλαγές αποθηκεύτηκαν.");
    } catch (error) {
      toast.error(getErrorMessage(error, "Δεν έγινε η αποθήκευση."));
    } finally {
      setSaving(false);
    }
  };

  const uploadBrandImage = async (kind: "logo" | "favicon" | "login-background", event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(kind);
    try {
      const formData = new FormData();
      formData.append("file", file);
      setBranding(await api.upload<Branding>(`/branding/${kind}`, formData));
      await refreshBranding();
      toast.success(kind === "logo" ? "Το logo ανέβηκε." : kind === "favicon" ? "Το favicon ανέβηκε." : "Το background του login ανέβηκε.");
    } catch (error) {
      toast.error(getErrorMessage(error, "Η μεταφόρτωση απέτυχε."));
    } finally {
      setUploading(null);
      event.target.value = "";
    }
  };

  const validColor = isHexColor(branding.primaryColor);

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
            <div className="hidden" aria-hidden="true">
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
            <CardTitle>Background Σύνδεσης</CardTitle>
            <CardDescription>Προαιρετική εικόνα φόντου για τη σελίδα σύνδεσης. Προτεινόμενο: οριζόντια JPG, PNG ή WEBP, max 5MB.</CardDescription>
          </CardHeader>
          <CardContent className="gap-5">
            <BrandImagePreview url={branding.loginBackgroundUrl} type="login-background" />
            <Button type="button" variant="outline" onClick={() => loginBackgroundInputRef.current?.click()} disabled={uploading !== null || loading}>
              {uploading === "login-background" ? <LoaderCircle className="animate-spin" /> : <Upload />}
              {uploading === "login-background" ? "Ανέβασμα..." : "Ανέβασε Background"}
            </Button>
            <input ref={loginBackgroundInputRef} type="file" accept=".jpg,.jpeg,.png,.webp" onChange={(event) => uploadBrandImage("login-background", event)} className="hidden" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Χρώματα</CardTitle>
            <CardDescription>Προσάρμοσε τα χρώματα της εφαρμογής και δες την προεπισκόπηση πριν την αποθήκευση.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 md:grid-cols-2">
            <ColorField id="primary-color" label="Βασικό Χρώμα" value={branding.primaryColor} fallback={emptyBranding.primaryColor} disabled={loading} onChange={(value) => updateBranding("primaryColor", value)} />
            <ColorField id="font-color" label="Χρώμα Γραμματοσειράς" value={branding.fontColor} fallback={emptyBranding.fontColor} disabled={loading} onChange={(value) => updateBranding("fontColor", value)} />
            <ColorField id="title-color" label="Χρώμα Τίτλων" value={branding.titleColor} fallback={emptyBranding.titleColor} disabled={loading} onChange={(value) => updateBranding("titleColor", value)} />
            <ColorField id="button-color" label="Χρώμα Κουμπιών" value={branding.buttonColor} fallback={emptyBranding.buttonColor} disabled={loading} onChange={(value) => updateBranding("buttonColor", value)} />
            <ColorField id="button-hover-color" label="Hover Κουμπιών" value={branding.buttonHoverColor} fallback={emptyBranding.buttonHoverColor} disabled={loading} onChange={(value) => updateBranding("buttonHoverColor", value)} />
            <ColorField id="button-text-color" label="Χρώμα Κειμένου Κουμπιών" value={branding.buttonTextColor} fallback={emptyBranding.buttonTextColor} disabled={loading} onChange={(value) => updateBranding("buttonTextColor", value)} />
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
            <div className="flex min-h-16 items-center gap-3 rounded-t-lg px-4 text-white" style={{ backgroundColor: validColor ? branding.primaryColor : emptyBranding.primaryColor }}>
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
            <div className="space-y-3 rounded-b-lg border border-t-0 p-4">
              <h3 className="text-lg font-semibold" style={{ color: isHexColor(branding.titleColor) ? branding.titleColor : emptyBranding.titleColor }}>Τίτλος Σελίδας</h3>
              <p className="text-sm" style={{ color: isHexColor(branding.fontColor) ? branding.fontColor : emptyBranding.fontColor }}>Κείμενο παραγράφου με την επιλεγμένη χρωματική ταυτότητα.</p>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  data-primary-btn
                  className="rounded-md px-4 py-2 text-sm font-medium"
                  style={{
                    backgroundColor: isHexColor(branding.buttonColor) ? branding.buttonColor : emptyBranding.buttonColor,
                    color: isHexColor(branding.buttonTextColor) ? branding.buttonTextColor : emptyBranding.buttonTextColor,
                  }}
                >
                  Κουμπί
                </button>
                <span className="text-xs text-muted-foreground">Hover: <span className="inline-block h-3 w-3 rounded-full align-middle" style={{ backgroundColor: isHexColor(branding.buttonHoverColor) ? branding.buttonHoverColor : emptyBranding.buttonHoverColor }} /></span>
              </div>
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

function BrandImagePreview({ url, type }: { url: string | null; type: "logo" | "favicon" | "login-background" }) {
  if (url) {
    return (
      <div className="flex min-h-20 items-center rounded-lg border bg-muted/30 p-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={resolveMediaUrl(url)} alt={type === "logo" ? "Current logo" : type === "favicon" ? "Current favicon" : "Current login background"} className={type === "logo" ? "max-h-16 max-w-full object-contain" : type === "favicon" ? "h-8 w-8 object-contain" : "max-h-48 w-full rounded-md object-cover"} />
      </div>
    );
  }

  return (
    <div className={`flex items-center justify-center rounded-lg border border-dashed bg-muted/30 text-muted-foreground ${type === "logo" ? "min-h-20 gap-2" : type === "favicon" ? "h-12 w-12" : "min-h-36 gap-2"}`}>
      <ImageIcon className="h-5 w-5" />
      {type !== "favicon" && <span className="text-sm">{type === "logo" ? "Δεν έχει οριστεί logo" : "Δεν έχει οριστεί background"}</span>}
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
