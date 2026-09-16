"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { ClientShell } from "@/components/shell/client-shell";
import { useAuth } from "@/lib/auth/auth-context";
import { api } from "@/lib/api/client";
import { resolveMediaUrl } from "@/lib/media";
import { cropAndCompressImage } from "@/lib/image-compression";
import { ChangePasswordCard } from "@/components/shared/change-password-card";
import { PushNotificationsCard } from "@/components/shared/push-notifications-card";
import { useFontSize, type FontSize } from "@/components/shell/font-size-context";
import type { AuthUser } from "@/types/auth";

const socialPlatforms = ["Instagram", "Facebook", "YouTube", "TikTok"];

interface SocialLink {
  platform: string;
  url: string;
}

interface ProfileData {
  fullName?: string;
  email?: string;
  phone?: string;
  gender?: string;
  dateOfBirth?: string;
  heightCm?: string | number;
  weightKg?: string | number;
  updateDay?: string | number;
  goal?: string;
  occupationSchedule?: string;
  healthProblem?: string;
  injuries?: string;
  cycleHistory?: string;
  cardioSessionsPerWeek?: string | number;
  sleepSchedule?: string;
  currentTrainingPlan?: string;
  currentNutritionPlan?: string;
  previousPlanHistory?: string;
  socialLinks?: { platform?: string; url?: string }[];
  profilePhoto?: string | null;
  [key: string]: unknown;
}

interface ProfileForm {
  fullName: string;
  email: string;
  phone: string;
  gender: string;
  dateOfBirth: string;
  heightCm: string | number;
  weightKg: string | number;
  updateDay: string | number;
  goal: string;
  occupationSchedule: string;
  healthProblem: string;
  injuries: string;
  cycleHistory: string;
  cardioSessionsPerWeek: string | number;
  sleepSchedule: string;
  currentTrainingPlan: string;
  currentNutritionPlan: string;
  previousPlanHistory: string;
  socialLinks: SocialLink[];
}

interface DashboardPeek {
  paymentApproved?: boolean;
}

function getErrorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

function toDateInput(value?: string | null): string {
  if (!value) return "";
  return String(value).slice(0, 10);
}

function calculateAge(dateOfBirth?: string): number | string {
  if (!dateOfBirth) return "";
  const birth = new Date(dateOfBirth);
  if (Number.isNaN(birth.getTime())) return "";
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age -= 1;
  return age;
}

function normalizeSocialLinks(rows: { platform?: string; url?: string }[] = []): SocialLink[] {
  return socialPlatforms.map((platform) => {
    const existing = rows.find((item) => item.platform?.toLowerCase() === platform.toLowerCase());
    return { platform, url: existing?.url || "" };
  });
}

function emptyForm(): ProfileForm {
  return {
    fullName: "",
    email: "",
    phone: "",
    gender: "",
    dateOfBirth: "",
    heightCm: "",
    weightKg: "",
    updateDay: "",
    goal: "",
    occupationSchedule: "",
    healthProblem: "",
    injuries: "",
    cycleHistory: "",
    cardioSessionsPerWeek: "",
    sleepSchedule: "",
    currentTrainingPlan: "",
    currentNutritionPlan: "",
    previousPlanHistory: "",
    socialLinks: normalizeSocialLinks(),
  };
}

function TextField({
  label,
  value,
  onChange,
  type = "text",
  required = false,
}: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <Input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        className="mt-2"
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  options: (string | [string, string])[];
}) {
  const stringValue = String(value ?? "");
  const items = [
    { value: "", label: "Επιλογή" },
    ...options.map((option) => {
      const optionValue = Array.isArray(option) ? option[0] : option;
      const optionLabel = Array.isArray(option) ? option[1] : option;
      return { value: optionValue, label: optionLabel };
    }),
  ];
  return (
    <div>
      <Label>{label}</Label>
      <Select items={items} value={stringValue} onValueChange={(next) => onChange(String(next))}>
        <SelectTrigger className="mt-2 w-full">
          <SelectValue placeholder="Επιλογή" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">Επιλογή</SelectItem>
          {options.map((option) => {
            const optionValue = Array.isArray(option) ? option[0] : option;
            const optionLabel = Array.isArray(option) ? option[1] : option;
            return (
              <SelectItem key={optionValue} value={optionValue}>
                {optionLabel}
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    </div>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="mt-2 flex h-9 items-center rounded-md border border-input bg-slate-50 px-3 text-sm font-medium text-slate-600 dark:bg-slate-950 dark:text-slate-300">
        {value}
      </div>
    </div>
  );
}

function ClientProfileContent() {
  const { user, logout, updateUser } = useAuth();
  const { fontSize, setFontSize } = useFontSize();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingPhoto, setDeletingPhoto] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [paymentApproved, setPaymentApproved] = useState(false);
  const [form, setForm] = useState<ProfileForm>(emptyForm());
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Promise.all([
      api.get<ProfileData>("/clients/me/profile"),
      api.get<DashboardPeek>("/client-dashboard").catch(() => null),
    ])
      .then(([data, dashboard]) => {
        setPaymentApproved(Boolean(dashboard?.paymentApproved));
        setProfile(data);
        setForm({
          fullName: data.fullName || "",
          email: data.email || "",
          phone: data.phone || "",
          gender: data.gender || "",
          dateOfBirth: toDateInput(data.dateOfBirth),
          heightCm: data.heightCm || "",
          weightKg: data.weightKg || "",
          updateDay: data.updateDay ?? "",
          goal: data.goal || "",
          occupationSchedule: data.occupationSchedule || "",
          healthProblem: data.healthProblem || "",
          injuries: data.injuries || "",
          cycleHistory: data.cycleHistory || "",
          cardioSessionsPerWeek: data.cardioSessionsPerWeek || "",
          sleepSchedule: data.sleepSchedule || "",
          currentTrainingPlan: data.currentTrainingPlan || "",
          currentNutritionPlan: data.currentNutritionPlan || "",
          previousPlanHistory: data.previousPlanHistory || "",
          socialLinks: normalizeSocialLinks(data.socialLinks),
        });
      })
      .catch((err) => setError(getErrorMessage(err, "Δεν φορτώθηκε το προφίλ.")))
      .finally(() => setLoading(false));
  }, []);

  const age = useMemo(() => calculateAge(form.dateOfBirth), [form.dateOfBirth]);
  const currentProfilePhoto = profile?.profilePhoto || user?.profilePhoto || null;
  const profilePhoto = resolveMediaUrl(currentProfilePhoto);

  const updateField = <K extends keyof ProfileForm>(field: K, value: ProfileForm[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const updateSocialLink = (platform: string, url: string) => {
    setForm((current) => ({
      ...current,
      socialLinks: current.socialLinks.map((item) => (item.platform === platform ? { ...item, url } : item)),
    }));
  };

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const data = await api.put<{ user: AuthUser }>("/clients/me/profile", form);
      if (user) updateUser({ ...user, ...data.user, profilePhoto: currentProfilePhoto ?? undefined });
      setMessage("Το προφίλ ενημερώθηκε.");
    } catch (err) {
      setError(getErrorMessage(err, "Δεν έγινε αποθήκευση."));
    } finally {
      setSaving(false);
    }
  };

  const uploadProfilePhoto = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError("");
    setMessage("");

    try {
      const compressedBlob = await cropAndCompressImage(file);
      const formData = new FormData();
      formData.append("photo", compressedBlob, "profile-photo.jpg");
      const data = await api.upload<{ profilePhoto: string }>("/clients/me/profile-photo", formData);
      setProfile((current) => (current ? { ...current, profilePhoto: data.profilePhoto } : current));
      if (user) updateUser({ ...user, profilePhoto: data.profilePhoto });
      setMessage("Η φωτογραφία προφίλ ανέβηκε και αποθηκεύτηκε στο Media Library.");
    } catch (err) {
      setError(getErrorMessage(err, "Δεν ανέβηκε η φωτογραφία."));
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  const deleteProfilePhoto = async () => {
    if (!currentProfilePhoto) return;
    setDeletingPhoto(true);
    setError("");
    setMessage("");

    try {
      const data = await api.delete<{ profilePhoto: string | null }>("/clients/me/profile-photo");
      setProfile((current) => (current ? { ...current, profilePhoto: data.profilePhoto } : current));
      if (user) updateUser({ ...user, profilePhoto: undefined });
      setMessage("Η φωτογραφία αφαιρέθηκε από το προφίλ σου.");
    } catch (err) {
      setError(getErrorMessage(err, "Δεν διαγράφηκε η φωτογραφία."));
    } finally {
      setDeletingPhoto(false);
    }
  };

  const shellUser: AuthUser | null = user ? { ...user, profilePhoto: currentProfilePhoto ?? undefined } : null;

  return (
    <ClientShell title="Προφίλ" user={shellUser} logout={logout} paymentApproved={paymentApproved} active="profile">
      <div className="mb-6">
        <p className="text-sm font-bold text-slate-500 dark:text-slate-400">Dashboard / Προφίλ</p>
        <h1 className="mt-2 text-3xl font-black">Το προφίλ μου</h1>
      </div>

      {loading ? (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-sm font-bold text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
          Φόρτωση...
        </div>
      ) : (
        <div className="space-y-6">
        <form onSubmit={saveProfile} className="space-y-6">
          {(error || message) && (
            <div
              className={`rounded-lg border px-5 py-4 text-sm font-bold ${
                error
                  ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200"
                  : "border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950/50 dark:text-green-200"
              }`}
            >
              {error || message}
            </div>
          )}

          <Card>
            <CardContent>
              <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-5">
                  {profilePhoto ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={profilePhoto}
                      alt=""
                      className="h-24 w-24 rounded-full object-cover ring-4 ring-red-50 dark:ring-red-950/40"
                    />
                  ) : (
                    <div className="grid h-24 w-24 place-items-center rounded-full bg-slate-900 text-2xl font-black text-white dark:bg-red-600">
                      {(form.fullName || form.email || "CL").slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <h2 className="text-xl font-black">Φωτογραφία προφίλ</h2>
                    <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
                      Η εικόνα γίνεται αυτόματα τετράγωνο crop και συμπίεση πριν αποθηκευτεί.
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button
                    type="button"
                    disabled={uploading}
                    onClick={() => fileInputRef.current?.click()}
                    className="h-12 px-5 font-bold shadow-lg shadow-red-100 dark:shadow-none"
                  >
                    {uploading ? "Ανέβασμα..." : "Αλλαγή φωτογραφίας"}
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={uploadProfilePhoto}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!currentProfilePhoto || deletingPhoto}
                    onClick={deleteProfilePhoto}
                    className="h-12 px-5 font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                  >
                    {deletingPhoto ? "Διαγραφή..." : "Διαγραφή"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-xl font-black">Προσωπικά στοιχεία</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                <TextField label="Όνομα & Επώνυμο" value={form.fullName} onChange={(value) => updateField("fullName", value)} required />
                <TextField label="Email" type="email" value={form.email} onChange={(value) => updateField("email", value)} required />
                <TextField label="Τηλέφωνο" value={form.phone} onChange={(value) => updateField("phone", value)} />
                <TextField label="Ημερομηνία γέννησης" type="date" value={form.dateOfBirth} onChange={(value) => updateField("dateOfBirth", value)} />
                <ReadOnlyField label="Ηλικία" value={age ? `${age} ετών` : "Υπολογίζεται από τη γέννηση"} />
                <SelectField label="Φύλο" value={form.gender} onChange={(value) => updateField("gender", value)} options={["Άνδρας", "Γυναίκα", "Άλλο"]} />
                <TextField label="Ύψος σε cm" value={form.heightCm} onChange={(value) => updateField("heightCm", value)} />
                <TextField label="Βάρος σε kg" value={form.weightKg} onChange={(value) => updateField("weightKg", value)} />
                <SelectField
                  label="Ημέρα update"
                  value={form.updateDay}
                  onChange={(value) => updateField("updateDay", value)}
                  options={[
                    ["1", "Δευτέρα"],
                    ["2", "Τρίτη"],
                    ["3", "Τετάρτη"],
                    ["4", "Πέμπτη"],
                    ["5", "Παρασκευή"],
                    ["6", "Σάββατο"],
                    ["0", "Κυριακή"],
                  ]}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-xl font-black">Social Media</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                {form.socialLinks.map((link) => (
                  <div key={link.platform}>
                    <Label>{link.platform}</Label>
                    <Input
                      value={link.url}
                      onChange={(event) => updateSocialLink(link.platform, event.target.value)}
                      placeholder={`Σύνδεσμος ${link.platform}`}
                      className="mt-2"
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={saving}
              className="h-12 px-8 font-black shadow-lg shadow-red-100 dark:shadow-none"
            >
              {saving ? "Αποθήκευση..." : "Αποθήκευση αλλαγών"}
            </Button>
          </div>
        </form>

        <Card>
          <CardHeader>
            <CardTitle>Εμφάνιση</CardTitle>
            <CardDescription>Μέγεθος γραμματοσειράς για όλη την εφαρμογή.</CardDescription>
          </CardHeader>
          <CardContent>
            <ToggleGroup
              value={[fontSize]}
              onValueChange={(value) => value[0] && setFontSize(value[0] as FontSize)}
            >
              <ToggleGroupItem value="small">Μικρό</ToggleGroupItem>
              <ToggleGroupItem value="medium">Κανονικό</ToggleGroupItem>
              <ToggleGroupItem value="large">Μεγάλο</ToggleGroupItem>
            </ToggleGroup>
          </CardContent>
        </Card>

        <PushNotificationsCard />

        <ChangePasswordCard />
        </div>
      )}
    </ClientShell>
  );
}

export default function ClientProfilePage() {
  return (
    <ProtectedRoute>
      <ClientProfileContent />
    </ProtectedRoute>
  );
}
