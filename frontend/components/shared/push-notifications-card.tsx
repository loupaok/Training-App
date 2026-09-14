"use client";

import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth/auth-context";
import { api } from "@/lib/api/client";
import {
  deletePushSubscription,
  isPushSupported,
  listPushSubscriptions,
  subscribeToPush,
  unsubscribeFromPush,
  type PushSubscriptionRow,
} from "@/lib/push-notifications";
import type { AuthUser } from "@/types/auth";

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function PushNotificationsCard() {
  const { user, updateUser } = useAuth();
  const [devices, setDevices] = useState<PushSubscriptionRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const supported = isPushSupported();

  useEffect(() => {
    if (!supported) return;
    listPushSubscriptions()
      .then(setDevices)
      .catch(() => setDevices([]));
  }, [supported]);

  const togglePush = async (checked: boolean) => {
    setError("");
    setSaving(true);
    try {
      if (checked) {
        await subscribeToPush();
        setDevices(await listPushSubscriptions());
      } else {
        await unsubscribeFromPush();
      }
      const data = await api.put<{ user: AuthUser }>("/auth/profile", { pushEnabled: checked });
      updateUser({ ...(user as AuthUser), ...data.user });
    } catch (err) {
      setError(getErrorMessage(err, "Δεν ενημερώθηκαν οι ειδοποιήσεις."));
    } finally {
      setSaving(false);
    }
  };

  const removeDevice = async (id: number | string) => {
    try {
      await deletePushSubscription(id);
      setDevices((current) => current.filter((device) => device.id !== id));
    } catch (err) {
      setError(getErrorMessage(err, "Δεν αφαιρέθηκε η συσκευή."));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Push Ειδοποιήσεις</CardTitle>
        <CardDescription>Λάβε ειδοποιήσεις στη συσκευή σου, ακόμα και όταν η εφαρμογή είναι κλειστή.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200">
            {error}
          </div>
        )}

        {!supported ? (
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
            Ο browser σου δεν υποστηρίζει push notifications.
          </p>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <Checkbox
                id="pushEnabled"
                checked={Boolean(user?.pushEnabled)}
                onCheckedChange={(checked) => togglePush(checked === true)}
                disabled={saving}
              />
              <Label htmlFor="pushEnabled" className="font-semibold">
                Ενεργοποίηση push ειδοποιήσεων σε αυτή τη συσκευή
              </Label>
            </div>

            {devices.length > 0 && (
              <div className="space-y-2">
                <div className="text-sm font-bold text-slate-500 dark:text-slate-400">Συνδεδεμένες συσκευές</div>
                {devices.map((device) => (
                  <div
                    key={device.id}
                    className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-sm dark:border-slate-800"
                  >
                    <span className="truncate text-slate-600 dark:text-slate-400">{device.user_agent || "Άγνωστη συσκευή"}</span>
                    <Button variant="ghost" size="icon-sm" onClick={() => removeDevice(device.id)} aria-label="Αφαίρεση συσκευής">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
