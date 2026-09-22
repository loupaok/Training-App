"use client";

import { useEffect, useState } from "react";
import { Bell, CreditCard, Info, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { CoachShell } from "@/components/shell/coach-shell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/lib/auth/auth-context";
import { api } from "@/lib/api/client";

type CronSetting = {
  jobKey: "update_reminder" | "subscription_expiry" | "subscription_status";
  jobName: string;
  description: string;
  hour: number;
  minute: number;
  isActive: boolean;
  lastRun: string | null;
};

const jobPresentation = {
  update_reminder: { Icon: Bell, iconClass: "bg-blue-500/10 text-blue-600" },
  subscription_expiry: { Icon: CreditCard, iconClass: "bg-amber-500/10 text-amber-600" },
  subscription_status: { Icon: RefreshCw, iconClass: "bg-green-500/10 text-green-600" },
} as const;

const hours = Array.from({ length: 24 }, (_, value) => String(value).padStart(2, "0"));
const minutes = ["00", "15", "30", "45"];

function relativeTime(value: string) {
  const diff = new Date(value).getTime() - Date.now();
  const formatter = new Intl.RelativeTimeFormat("el", { numeric: "auto" });
  const minutesAgo = Math.round(diff / 60_000);
  if (Math.abs(minutesAgo) < 60) return formatter.format(minutesAgo, "minute");
  const hoursAgo = Math.round(minutesAgo / 60);
  if (Math.abs(hoursAgo) < 24) return formatter.format(hoursAgo, "hour");
  return formatter.format(Math.round(hoursAgo / 24), "day");
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Σφάλμα φόρτωσης.";
}

function AutomationsContent() {
  const { user, logout } = useAuth();
  const [jobs, setJobs] = useState<CronSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    api.get<CronSetting[]>("/settings/crons")
      .then(setJobs)
      .catch((requestError) => setError(getErrorMessage(requestError)))
      .finally(() => setLoading(false));
  }, []);

  const updateJob = (jobKey: CronSetting["jobKey"], changes: Partial<CronSetting>) => {
    setJobs((current) => current.map((job) => job.jobKey === jobKey ? { ...job, ...changes } : job));
  };

  const saveJob = async (job: CronSetting) => {
    setSaving(job.jobKey);
    try {
      const saved = await api.put<CronSetting>(`/settings/crons/${job.jobKey}`, {
        hour: job.hour,
        minute: job.minute,
        isActive: job.isActive,
      });
      updateJob(job.jobKey, saved);
      toast.success("Αποθηκεύτηκε");
    } catch (requestError) {
      toast.error(getErrorMessage(requestError) || "Σφάλμα αποθήκευσης");
    } finally {
      setSaving(null);
    }
  };

  return (
    <CoachShell title="Αυτοματισμοί" user={user} logout={logout}>
      <main className="mx-auto max-w-4xl space-y-6 pb-8">
        <header>
          <h1 className="text-3xl font-bold">Αυτοματισμοί</h1>
          <p className="mt-2 text-sm text-muted-foreground">Εργασίες που τρέχουν αυτόματα κάθε μέρα στο background.</p>
        </header>

        <Alert className="border-blue-200 bg-blue-50 text-blue-900 [&_[data-slot=alert-description]]:text-blue-800 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-100 dark:[&_[data-slot=alert-description]]:text-blue-200">
          <Info />
          <AlertTitle>Καθημερινές εργασίες</AlertTitle>
          <AlertDescription>Οι αυτοματισμοί τρέχουν καθημερινά την ώρα που ορίζεις. Χρειάζεται σωστή ρύθμιση SMTP για να στέλνονται τα emails.</AlertDescription>
        </Alert>

        {loading && <AutomationSkeleton />}
        {error && <Alert variant="destructive"><AlertTitle>Δεν φορτώθηκαν οι αυτοματισμοί</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}

        <div className="space-y-4">
          {jobs.map((job) => {
            const presentation = jobPresentation[job.jobKey];
            const JobIcon = presentation.Icon;
            return (
              <Card key={job.jobKey}>
                <CardHeader className="flex items-center gap-4 sm:flex-row">
                  <div className={`grid size-10 place-items-center rounded-full ${presentation.iconClass}`}><JobIcon className="size-5" /></div>
                  <div className="flex-1">
                    <CardTitle>{job.jobName}</CardTitle>
                    <CardDescription className="mt-1">{job.description}</CardDescription>
                  </div>
                  <Switch checked={job.isActive} onCheckedChange={(isActive) => updateJob(job.jobKey, { isActive })} aria-label={`Ενεργοποίηση ${job.jobName}`} />
                </CardHeader>
                <CardContent>
                  <Separator />
                  <div className="flex flex-wrap items-center gap-3 pt-3">
                    <span className="text-sm font-medium">Ώρα εκτέλεσης:</span>
                    <Select value={String(job.hour).padStart(2, "0")} onValueChange={(hour) => updateJob(job.jobKey, { hour: Number(hour) })}>
                      <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
                      <SelectContent>{hours.map((hour) => <SelectItem key={hour} value={hour}>{hour}</SelectItem>)}</SelectContent>
                    </Select>
                    <span className="text-muted-foreground">:</span>
                    <Select value={String(job.minute).padStart(2, "0")} onValueChange={(minute) => updateJob(job.jobKey, { minute: Number(minute) })}>
                      <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
                      <SelectContent>{minutes.map((minute) => <SelectItem key={minute} value={minute}>{minute}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-3">
                    <p className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span className={`size-2 rounded-full ${job.lastRun ? "bg-green-500" : "bg-muted-foreground/50"}`} />
                      {job.lastRun ? `Τελευταία: ${relativeTime(job.lastRun)}` : "Δεν έχει τρέξει ακόμα"}
                    </p>
                    <Button variant="outline" size="sm" onClick={() => saveJob(job)} disabled={saving === job.jobKey}>
                      {saving === job.jobKey ? "Αποθήκευση..." : "Αποθήκευση"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </main>
    </CoachShell>
  );
}

function AutomationSkeleton() {
  return <div className="space-y-4">{Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="h-48 w-full" />)}</div>;
}

export default function CoachSettingsAutomationsPage() {
  return <ProtectedRoute allow="coach"><AutomationsContent /></ProtectedRoute>;
}
