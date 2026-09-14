"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/auth-context";
import type { AuthUser } from "@/types/auth";

export function EditProfileDialog({
  user,
  open,
  onOpenChange,
}: {
  user: AuthUser | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { updateUser } = useAuth();
  const [form, setForm] = useState({ fullName: user?.fullName || "", profileTitle: user?.profileTitle || "" });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setForm({ fullName: user?.fullName || "", profileTitle: user?.profileTitle || "" });
  }, [user?.fullName, user?.profileTitle]);

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setMessage("");

    try {
      const data = await api.put<{ user: AuthUser }>("/auth/profile", form);
      updateUser({ ...(user as AuthUser), ...data.user });
      setMessage("Το προφίλ ενημερώθηκε.");
      window.setTimeout(() => {
        onOpenChange(false);
        setMessage("");
      }, 700);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Δεν έγινε αποθήκευση.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Επεξεργασία προφίλ</DialogTitle>
          <DialogDescription>Άλλαξε το όνομα και τον τίτλο που εμφανίζονται στο panel.</DialogDescription>
        </DialogHeader>

        <form onSubmit={saveProfile} className="space-y-4">
          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div>
          )}
          {message && (
            <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm font-bold text-green-700">{message}</div>
          )}

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
            <Label htmlFor="profileTitle">Τίτλος</Label>
            <Input
              id="profileTitle"
              value={form.profileTitle}
              onChange={(event) => setForm((current) => ({ ...current, profileTitle: event.target.value }))}
              placeholder="π.χ. Admin"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Άκυρο
            </Button>
            <Button type="submit">Αποθήκευση</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
