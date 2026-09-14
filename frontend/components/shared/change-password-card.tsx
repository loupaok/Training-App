"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api/client";

export function ChangePasswordCard() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setMessage("");

    if (newPassword.length < 6) {
      setError("Ο νέος κωδικός πρέπει να έχει τουλάχιστον 6 χαρακτήρες.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Οι νέοι κωδικοί δεν ταιριάζουν.");
      return;
    }

    setSaving(true);
    try {
      await api.put("/auth/change-password", { currentPassword, newPassword });
      setMessage("Ο κωδικός ενημερώθηκε.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Δεν έγινε αλλαγή κωδικού.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Αλλαγή Κωδικού</CardTitle>
        <CardDescription>Χρειάζεται ο τρέχων κωδικός σου για επιβεβαίωση.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200">
              {error}
            </div>
          )}
          {message && (
            <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm font-bold text-green-700 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200">
              {message}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="currentPassword">Τρέχων κωδικός</Label>
            <Input
              id="currentPassword"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="newPassword">Νέος κωδικός</Label>
            <Input
              id="newPassword"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              required
              minLength={6}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Επιβεβαίωση νέου κωδικού</Label>
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
              minLength={6}
            />
          </div>
          <Button type="submit" disabled={saving}>
            {saving ? "Αποθήκευση..." : "Αλλαγή Κωδικού"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
