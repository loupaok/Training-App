"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { CheckCircle2, KeyRound, Loader2, PlugZap, Save, Server, ShieldCheck } from "lucide-react";
import { useAuth } from "@/lib/auth/auth-context";
import { api } from "@/lib/api/client";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { CoachShell } from "@/components/shell/coach-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type DiscordSettings = {
  enabled: boolean;
  clientId: string;
  guildId: string;
  redirectUri: string;
  activeRoleId: string;
  activeRoleName: string;
  hasClientSecret: boolean;
  hasBotToken: boolean;
};

type Role = { id: string; name: string };

const emptySettings: DiscordSettings = {
  enabled: true,
  clientId: "",
  guildId: "",
  redirectUri: "",
  activeRoleId: "",
  activeRoleName: "Ενεργό Μέλος",
  hasClientSecret: false,
  hasBotToken: false,
};

function DiscordSettingsContent() {
  const { user, logout } = useAuth();
  const [settings, setSettings] = useState<DiscordSettings>(emptySettings);
  const [clientSecret, setClientSecret] = useState("");
  const [botToken, setBotToken] = useState("");
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadSettings = async () => {
    setLoading(true);
    try {
      setSettings(await api.get<DiscordSettings>("/discord-settings"));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Δεν ήταν δυνατή η φόρτωση των ρυθμίσεων Discord.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadSettings(); }, []);

  const update = <K extends keyof DiscordSettings>(key: K, value: DiscordSettings[K]) => {
    setSettings((current) => ({ ...current, [key]: value }));
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const saved = await api.put<DiscordSettings>("/discord-settings", {
        enabled: Boolean(settings.enabled),
        clientId: settings.clientId.trim(),
        clientSecret: clientSecret.trim(),
        botToken: botToken.trim(),
        guildId: settings.guildId.trim(),
        redirectUri: settings.redirectUri.trim(),
        activeRoleId: settings.activeRoleId.trim(),
        activeRoleName: settings.activeRoleName.trim(),
      });
      setSettings(saved);
      setClientSecret("");
      setBotToken("");
      setMessage("Οι ρυθμίσεις Discord αποθηκεύτηκαν και εφαρμόζονται άμεσα.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Δεν ήταν δυνατή η αποθήκευση.");
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async () => {
    setTesting(true);
    setError(null);
    setMessage(null);
    try {
      const result = await api.post<{ rolesFound: number }>("/discord-settings/test", {});
      setMessage(`Η σύνδεση με το Discord λειτουργεί. Βρέθηκαν ${result.rolesFound} roles.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Η σύνδεση με το Discord απέτυχε.");
    } finally {
      setTesting(false);
    }
  };

  const loadRoles = async () => {
    setError(null);
    try {
      setRoles(await api.get<Role[]>("/discord-settings/roles"));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Δεν ήταν δυνατή η φόρτωση των roles.");
    }
  };

  return (
    <CoachShell title="Discord" user={user} logout={logout}>
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Discord</h1>
          <p className="mt-1 text-sm text-muted-foreground">Ρύθμισε τη σύνδεση OAuth, το Discord server και την πρόσβαση ενεργών μελών.</p>
        </div>

        {error && <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>}
        {message && <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"><CheckCircle2 className="h-4 w-4" />{message}</div>}

        {loading ? <Card><CardContent className="flex items-center gap-2 p-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Φόρτωση...</CardContent></Card> : (
          <form onSubmit={save} className="space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2"><PlugZap className="h-5 w-5" />Σύνδεση</CardTitle>
                  <CardDescription>Απενεργοποίησε προσωρινά το Discord χωρίς να χαθούν οι ρυθμίσεις.</CardDescription>
                </div>
                <Switch checked={settings.enabled} onCheckedChange={(value) => update("enabled", value === true)} />
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5" />OAuth2 εφαρμογή</CardTitle>
                <CardDescription>Το Redirect URI πρέπει να είναι ίδιο με αυτό που έχεις δηλώσει στο Discord Developer Portal.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-5 sm:grid-cols-2">
                <Field label="Client ID"><Input value={settings.clientId} onChange={(event) => update("clientId", event.target.value)} autoComplete="off" /></Field>
                <Field label="Redirect URI"><Input type="url" value={settings.redirectUri} onChange={(event) => update("redirectUri", event.target.value)} placeholder="https://app.example.com/discord/callback" /></Field>
                <Field label="Client Secret" hint={settings.hasClientSecret ? "Αποθηκευμένο. Συμπλήρωσε μόνο για αντικατάσταση." : "Απαιτείται για OAuth."}>
                  <Input type="password" value={clientSecret} onChange={(event) => setClientSecret(event.target.value)} autoComplete="new-password" placeholder={settings.hasClientSecret ? "••••••••" : "Client Secret"} />
                </Field>
                <Field label="Bot Token" hint={settings.hasBotToken ? "Αποθηκευμένο. Συμπλήρωσε μόνο για αντικατάσταση." : "Απαιτείται για role management."}>
                  <Input type="password" value={botToken} onChange={(event) => setBotToken(event.target.value)} autoComplete="new-password" placeholder={settings.hasBotToken ? "••••••••" : "Bot Token"} />
                </Field>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Server className="h-5 w-5" />Server και πρόσβαση</CardTitle>
                <CardDescription>Ο role δίνεται σε ενεργές συνδρομές και αφαιρείται όταν λήγουν.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-5 sm:grid-cols-2">
                <Field label="Server / Guild ID"><Input value={settings.guildId} onChange={(event) => update("guildId", event.target.value)} autoComplete="off" /></Field>
                <Field label="Όνομα ενεργού role"><Input value={settings.activeRoleName} onChange={(event) => update("activeRoleName", event.target.value)} placeholder="Ενεργό Μέλος" /></Field>
                <div className="space-y-2">
                  <Label>Επιλογή role από Discord</Label>
                  <div className="flex gap-2">
                    <Select value={settings.activeRoleId || "none"} onValueChange={(value) => update("activeRoleId", !value || value === "none" ? "" : value)}>
                      <SelectTrigger className="flex-1"><SelectValue placeholder="Φόρτωσε roles" /></SelectTrigger>
                      <SelectContent><SelectItem value="none">Αυτόματη εύρεση από όνομα</SelectItem>{roles.map((role) => <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>)}</SelectContent>
                    </Select>
                    <Button type="button" variant="outline" onClick={() => void loadRoles()}>Roles</Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex flex-wrap justify-end gap-3">
              <Button type="button" variant="outline" disabled={testing} onClick={() => void testConnection()}>{testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}Δοκιμή σύνδεσης</Button>
              <Button type="submit" disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Αποθήκευση</Button>
            </div>
          </form>
        )}
      </div>
    </CoachShell>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return <div className="space-y-2"><Label>{label}</Label>{children}{hint && <p className="text-xs text-muted-foreground">{hint}</p>}</div>;
}

export default function CoachDiscordSettingsPage() {
  return <ProtectedRoute allow="coach"><DiscordSettingsContent /></ProtectedRoute>;
}
