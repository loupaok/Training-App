"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { CoachShell } from "@/components/shell/coach-shell";
import { UserAvatar } from "@/components/shared/user-avatar";
import { useAuth } from "@/lib/auth/auth-context";
import { api } from "@/lib/api/client";
import { getInitials } from "@/lib/media";
import { cropAndCompressImage } from "@/lib/image-compression";
import type { AuthUser } from "@/types/auth";

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function CoachProfileContent() {
  const { user, logout, updateUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({ fullName: "", profileTitle: "" });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setForm({ fullName: user?.fullName || "", profileTitle: user?.profileTitle || "" });
  }, [user?.fullName, user?.profileTitle]);

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const data = await api.put<{ user: AuthUser }>("/auth/profile", form);
      updateUser({ ...(user as AuthUser), ...data.user });
      setMessage("Το προφίλ ενημερώθηκε.");
    } catch (err) {
      setError(getErrorMessage(err, "Δεν έγινε αποθήκευση."));
    } finally {
      setSaving(false);
    }
  };

  const uploadPhoto = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError("");
    setMessage("");

    try {
      const compressedBlob = await cropAndCompressImage(file);
      const formData = new FormData();
      formData.append("photo", compressedBlob, "profile-photo.jpg");
      const data = await api.upload<{ user: AuthUser }>("/auth/profile-photo", formData);
      updateUser({ ...(user as AuthUser), ...data.user });
      setMessage("Η φωτογραφία προφίλ ανέβηκε.");
    } catch (err) {
      setError(getErrorMessage(err, "Δεν ανέβηκε η φωτογραφία."));
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  return (
    <CoachShell title="Προφίλ" user={user} logout={logout}>
      <div className="mb-6">
        <h1 className="text-3xl font-black">Το προφίλ μου</h1>
        <p className="mt-2 text-sm font-semibold text-slate-500">Διαχειρίσου τα προσωπικά σου στοιχεία και τη φωτογραφία προφίλ.</p>
      </div>

      {error && (
        <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-red-700">{error}</div>
      )}
      {message && (
        <div className="mb-5 rounded-lg border border-green-200 bg-green-50 px-5 py-4 text-sm font-bold text-green-700">{message}</div>
      )}

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <Card>
          <CardContent className="flex flex-col items-center gap-4 p-6 text-center">
            <UserAvatar
              initials={getInitials(user?.fullName || user?.email)}
              tone="bg-red-600"
              size="h-24 w-24"
              photoUrl={user?.profilePhoto}
            />
            <div>
              <div className="font-bold">{user?.fullName}</div>
              <div className="text-sm text-slate-500">{user?.email}</div>
            </div>
            <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
              <Camera className="h-4 w-4" />
              {uploading ? "Ανέβασμα..." : "Αλλαγή φωτογραφίας"}
            </Button>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={uploadPhoto} className="hidden" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Προσωπικά στοιχεία</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={saveProfile} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Όνομα και επίθετο</Label>
                <Input
                  id="fullName"
                  value={form.fullName}
                  onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" value={user?.email || ""} disabled />
              </div>
              <div className="space-y-2">
                <Label htmlFor="profileTitle">Τίτλος</Label>
                <Input
                  id="profileTitle"
                  value={form.profileTitle}
                  onChange={(event) => setForm((current) => ({ ...current, profileTitle: event.target.value }))}
                  placeholder="π.χ. Head Coach"
                />
              </div>
              <Button type="submit" disabled={saving}>
                {saving ? "Αποθήκευση..." : "Αποθήκευση"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </CoachShell>
  );
}

export default function CoachProfilePage() {
  return (
    <ProtectedRoute>
      <CoachProfileContent />
    </ProtectedRoute>
  );
}
