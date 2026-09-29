"use client";

import { useEffect, useState } from "react";
import { Bell, ChevronDown, ClipboardList, CreditCard, Info, Mail, RefreshCw, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { CoachShell } from "@/components/shell/coach-shell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth/auth-context";
import { api } from "@/lib/api/client";

type CronKey = "update_reminder" | "subscription_expiry" | "subscription_status";
type CronSetting = { jobKey: CronKey; jobName: string; description: string; hour: number; minute: number; isActive: boolean; lastRun: string | null };
type TemplateKey = "update_reminder" | "registration" | "subscription_expiry" | "update_notification";
type EmailTemplate = { key: TemplateKey; name: string; subject: string; body: string; variables: string[] };
type SmtpSettings = { host: string; port: number; secure: boolean; username: string; password: string; fromEmail: string; fromName: string; hasPassword: boolean; updatedAt: string | null };

const cronPresentation = {
  update_reminder: { Icon: Bell, iconClass: "bg-blue-500/10 text-blue-600" },
  subscription_expiry: { Icon: CreditCard, iconClass: "bg-amber-500/10 text-amber-600" },
  subscription_status: { Icon: RefreshCw, iconClass: "bg-green-500/10 text-green-600" },
} as const;
const templatePresentation = {
  update_reminder: { Icon: Bell, iconClass: "text-blue-600", variables: ["{{clientName}}", "{{submitUrl}}"] },
  registration: { Icon: UserCheck, iconClass: "text-green-600", variables: ["{{clientName}}", "{{planName}}"] },
  subscription_expiry: { Icon: CreditCard, iconClass: "text-amber-600", variables: ["{{clientName}}", "{{daysLeft}}", "{{renewUrl}}"] },
  update_notification: { Icon: ClipboardList, iconClass: "text-purple-600", variables: ["{{clientName}}", "{{weight}}", "{{trainingScore}}", "{{nutritionScore}}", "{{updateUrl}}"] },
} as const;
const hours = Array.from({ length: 24 }, (_, value) => String(value).padStart(2, "0"));
const minutes = ["00", "15", "30", "45"];

function getErrorMessage(error: unknown) { return error instanceof Error ? error.message : "Σφάλμα φόρτωσης."; }
function relativeTime(value: string) {
  const minutesAgo = Math.round((new Date(value).getTime() - Date.now()) / 60_000);
  const formatter = new Intl.RelativeTimeFormat("el", { numeric: "auto" });
  if (Math.abs(minutesAgo) < 60) return formatter.format(minutesAgo, "minute");
  const hoursAgo = Math.round(minutesAgo / 60);
  return Math.abs(hoursAgo) < 24 ? formatter.format(hoursAgo, "hour") : formatter.format(Math.round(hoursAgo / 24), "day");
}

function AutomationsTab() {
  const [jobs, setJobs] = useState<CronSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  useEffect(() => { api.get<CronSetting[]>("/settings/crons").then(setJobs).catch((e) => setError(getErrorMessage(e))).finally(() => setLoading(false)); }, []);
  const updateJob = (jobKey: CronKey, changes: Partial<CronSetting>) => setJobs((items) => items.map((job) => job.jobKey === jobKey ? { ...job, ...changes } : job));
  const saveJob = async (job: CronSetting) => {
    setSaving(job.jobKey);
    try {
      const saved = await api.put<CronSetting>(`/settings/crons/${job.jobKey}`, { hour: job.hour, minute: job.minute, isActive: job.isActive });
      updateJob(job.jobKey, saved); toast.success("Αποθηκεύτηκε");
    } catch (e) { toast.error(getErrorMessage(e)); } finally { setSaving(null); }
  };
  return <div className="space-y-6">
    <div><h2 className="text-2xl font-bold">Αυτοματισμοί</h2><p className="mt-2 text-sm text-muted-foreground">Εργασίες που τρέχουν αυτόματα κάθε μέρα στο background.</p></div>
    <Alert className="border-blue-200 bg-blue-50 text-blue-900 [&_[data-slot=alert-description]]:text-blue-800 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-100 dark:[&_[data-slot=alert-description]]:text-blue-200"><Info /><AlertTitle>Καθημερινές εργασίες</AlertTitle><AlertDescription>Οι αυτοματισμοί τρέχουν καθημερινά την ώρα που ορίζεις. Χρειάζεται σωστή ρύθμιση SMTP για να στέλνονται τα emails.</AlertDescription></Alert>
    {loading && <SkeletonList count={3} height="h-48" />}
    {error && <Alert variant="destructive"><AlertTitle>Δεν φορτώθηκαν οι αυτοματισμοί</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
    <div className="space-y-4">{jobs.map((job) => <CronCard key={job.jobKey} job={job} saving={saving === job.jobKey} onChange={updateJob} onSave={saveJob} />)}</div>
  </div>;
}

function CronCard({ job, saving, onChange, onSave }: { job: CronSetting; saving: boolean; onChange: (key: CronKey, changes: Partial<CronSetting>) => void; onSave: (job: CronSetting) => void }) {
  const presentation = cronPresentation[job.jobKey];
  const JobIcon = presentation.Icon;
  return <Card><CardHeader className="flex items-center gap-4 sm:flex-row"><div className={`grid size-10 place-items-center rounded-full ${presentation.iconClass}`}><JobIcon className="size-5" /></div><div className="flex-1"><CardTitle>{job.jobName}</CardTitle><CardDescription className="mt-1">{job.description}</CardDescription></div><Switch checked={job.isActive} onCheckedChange={(isActive) => onChange(job.jobKey, { isActive })} aria-label={`Ενεργοποίηση ${job.jobName}`} /></CardHeader><CardContent><Separator /><div className="flex flex-wrap items-center gap-3 pt-3"><span className="text-sm font-medium">Ώρα εκτέλεσης:</span><Select value={String(job.hour).padStart(2, "0")} onValueChange={(hour) => onChange(job.jobKey, { hour: Number(hour) })}><SelectTrigger className="w-20"><SelectValue /></SelectTrigger><SelectContent>{hours.map((hour) => <SelectItem key={hour} value={hour}>{hour}</SelectItem>)}</SelectContent></Select><span className="text-muted-foreground">:</span><Select value={String(job.minute).padStart(2, "0")} onValueChange={(minute) => onChange(job.jobKey, { minute: Number(minute) })}><SelectTrigger className="w-20"><SelectValue /></SelectTrigger><SelectContent>{minutes.map((minute) => <SelectItem key={minute} value={minute}>{minute}</SelectItem>)}</SelectContent></Select></div><div className="flex flex-wrap items-center justify-between gap-3 pt-3"><p className="flex items-center gap-2 text-sm text-muted-foreground"><span className={`size-2 rounded-full ${job.lastRun ? "bg-green-500" : "bg-muted-foreground/50"}`} />{job.lastRun ? `Τελευταία: ${relativeTime(job.lastRun)}` : "Δεν έχει τρέξει ακόμα"}</p><Button variant="outline" size="sm" onClick={() => onSave(job)} disabled={saving}>{saving ? "Αποθήκευση..." : "Αποθήκευση"}</Button></div></CardContent></Card>;
}

function SmtpSettingsCard() {
  const [settings, setSettings] = useState<SmtpSettings>({ host: "smtp.office365.com", port: 587, secure: false, username: "", password: "", fromEmail: "", fromName: "", hasPassword: false, updatedAt: null });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get<Omit<SmtpSettings, "password">>("/settings/smtp")
      .then((data) => setSettings((current) => ({ ...current, ...data, password: "" })))
      .catch((error) => toast.error(getErrorMessage(error)))
      .finally(() => setLoading(false));
  }, []);

  const update = <K extends keyof SmtpSettings>(key: K, value: SmtpSettings[K]) => setSettings((current) => ({ ...current, [key]: value }));
  const save = async () => {
    setSaving(true);
    try {
      const saved = await api.put<Omit<SmtpSettings, "password">>("/settings/smtp", {
        host: settings.host,
        port: Number(settings.port),
        secure: settings.secure,
        username: settings.username,
        password: settings.password,
        fromEmail: settings.fromEmail,
        fromName: settings.fromName,
      });
      setSettings((current) => ({ ...current, ...saved, password: "" }));
      toast.success("Οι ρυθμίσεις SMTP αποθηκεύτηκαν.");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return <Card className="overflow-hidden border-border shadow-sm">
    <CardHeader className="border-b bg-muted/30"><CardTitle className="flex items-center gap-2 text-lg"><Mail className="size-5 text-primary" />Ρύθμιση SMTP</CardTitle><CardDescription>Η αποστολή email χρησιμοποιεί αυτές τις ρυθμίσεις αμέσως μετά την αποθήκευση.</CardDescription></CardHeader>
    <CardContent className="p-5 sm:p-6">
      {loading ? <Skeleton className="h-52 w-full" /> : <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_8rem]">
          <div className="space-y-2"><Label htmlFor="smtp-host">SMTP Host</Label><Input id="smtp-host" value={settings.host} onChange={(event) => update("host", event.target.value)} placeholder="smtp.office365.com" /></div>
          <div className="space-y-2"><Label htmlFor="smtp-port">Port</Label><Input id="smtp-port" type="number" min="1" max="65535" value={settings.port} onChange={(event) => update("port", Number(event.target.value))} /></div>
        </div>
        <div className="flex items-center justify-between rounded-lg border border-border bg-muted/20 px-4 py-3"><div><p className="text-sm font-medium">SSL / TLS</p><p className="text-xs text-muted-foreground">Ενεργοποίησέ το για SMTPS, συνήθως στη θύρα 465.</p></div><Switch checked={settings.secure} onCheckedChange={(value) => update("secure", value)} aria-label="SSL ή TLS" /></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2"><Label htmlFor="smtp-user">Username</Label><Input id="smtp-user" autoComplete="username" value={settings.username} onChange={(event) => update("username", event.target.value)} placeholder="email@example.com" /></div>
          <div className="space-y-2"><Label htmlFor="smtp-password">Password</Label><Input id="smtp-password" type="password" autoComplete="new-password" value={settings.password} onChange={(event) => update("password", event.target.value)} placeholder={settings.hasPassword ? "Αποθηκευμένος κωδικός" : "SMTP password"} /></div>
        </div>
        <Separator />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2"><Label htmlFor="smtp-from-email">From email</Label><Input id="smtp-from-email" type="email" value={settings.fromEmail} onChange={(event) => update("fromEmail", event.target.value)} placeholder="email@example.com" /></div>
          <div className="space-y-2"><Label htmlFor="smtp-from-name">Όνομα αποστολέα</Label><Input id="smtp-from-name" value={settings.fromName} onChange={(event) => update("fromName", event.target.value)} placeholder="Το όνομα της επιχείρησής σου" /></div>
        </div>
        <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs text-muted-foreground">Ο κωδικός αποθηκεύεται κρυπτογραφημένος και δεν εμφανίζεται ξανά.</p><Button type="button" onClick={() => void save()} disabled={saving}>{saving ? "Αποθήκευση..." : "Αποθήκευση SMTP"}</Button></div>
      </div>}
    </CardContent>
  </Card>;
}

function EmailsTab() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [testEmails, setTestEmails] = useState<Record<string, string>>({});
  useEffect(() => { api.get<EmailTemplate[]>("/settings/email-templates").then(setTemplates).catch((e) => setError(getErrorMessage(e))).finally(() => setLoading(false)); }, []);
  const updateTemplate = (key: TemplateKey, changes: Partial<EmailTemplate>) => setTemplates((items) => items.map((template) => template.key === key ? { ...template, ...changes } : template));
  const saveTemplate = async (template: EmailTemplate) => { setSaving(template.key); try { const saved = await api.put<EmailTemplate>(`/settings/email-templates/${template.key}`, { subject: template.subject, body: template.body }); updateTemplate(template.key, saved); toast.success("Template αποθηκεύτηκε"); } catch (e) { toast.error(getErrorMessage(e)); } finally { setSaving(null); } };
  const sendTest = async (template: EmailTemplate) => { const testEmail = testEmails[template.key]?.trim(); if (!testEmail) { toast.error("Συμπλήρωσε email για το test."); return; } setTesting(template.key); try { await api.post("/settings/email-templates/test", { templateKey: template.key, testEmail }); toast.success("Test email εστάλη!"); } catch (e) { toast.error(getErrorMessage(e)); } finally { setTesting(null); } };
  const copyVariable = async (variable: string) => { try { await navigator.clipboard.writeText(variable); toast.success("Αντιγράφηκε!"); } catch { toast.error("Δεν έγινε η αντιγραφή."); } };
  return <div className="space-y-6">
    <div><h2 className="text-2xl font-bold">Emails &amp; Templates</h2><p className="mt-2 text-sm text-muted-foreground">Διαχείριση αυτόματων email της εφαρμογής.</p></div>
    <SmtpSettingsCard />
    {loading && <SkeletonList count={4} height="h-20" />}
    {error && <Card><CardContent className="text-destructive">Δεν φορτώθηκαν τα templates: {error}</CardContent></Card>}
    <div className="space-y-4">{templates.map((template) => <TemplateCard key={template.key} template={template} testEmail={testEmails[template.key] || ""} saving={saving === template.key} testing={testing === template.key} onChange={updateTemplate} onTestEmailChange={(value) => setTestEmails((items) => ({ ...items, [template.key]: value }))} onSave={saveTemplate} onTest={sendTest} onCopy={copyVariable} />)}</div>
  </div>;
}

function TemplateCard({ template, testEmail, saving, testing, onChange, onTestEmailChange, onSave, onTest, onCopy }: { template: EmailTemplate; testEmail: string; saving: boolean; testing: boolean; onChange: (key: TemplateKey, changes: Partial<EmailTemplate>) => void; onTestEmailChange: (value: string) => void; onSave: (template: EmailTemplate) => void; onTest: (template: EmailTemplate) => void; onCopy: (value: string) => void }) {
  const presentation = templatePresentation[template.key];
  const TemplateIcon = presentation.Icon;
  const variables = template.variables.length ? template.variables : presentation.variables;
  return <Collapsible><Card><CollapsibleTrigger className="flex w-full items-center gap-3 px-6 text-left"><TemplateIcon className={`size-5 ${presentation.iconClass}`} /><p className="min-w-0 flex-1 font-medium">{template.name}</p><Badge variant="secondary">Αυτόματο</Badge><ChevronDown className="size-4 text-muted-foreground transition-transform [[data-state=open]_&]:rotate-180" /></CollapsibleTrigger><CollapsibleContent><CardContent className="pt-6"><Separator /><div className="space-y-2 pt-3"><Label htmlFor={`${template.key}-subject`}>Θέμα</Label><Input id={`${template.key}-subject`} value={template.subject} onChange={(event) => onChange(template.key, { subject: event.target.value })} /></div><div className="space-y-2"><Label htmlFor={`${template.key}-body`}>Περιεχόμενο</Label><Textarea id={`${template.key}-body`} rows={8} className="font-mono text-sm" value={template.body} onChange={(event) => onChange(template.key, { body: event.target.value })} /></div><div className="space-y-2"><Label>Διαθέσιμες μεταβλητές</Label><div className="flex flex-wrap gap-2">{variables.map((variable) => <Button key={variable} type="button" variant="outline" size="xs" onClick={() => onCopy(variable)}>{variable}</Button>)}</div></div><div className="flex flex-col gap-2 border-t pt-4 sm:flex-row"><Input type="email" placeholder="test@email.com" value={testEmail} onChange={(event) => onTestEmailChange(event.target.value)} /><Button type="button" variant="outline" onClick={() => onTest(template)} disabled={testing}>{testing ? "Αποστολή..." : "Αποστολή test"}</Button></div><div><Button type="button" onClick={() => onSave(template)} disabled={saving}>{saving ? "Αποθήκευση..." : "Αποθήκευση"}</Button></div></CardContent></CollapsibleContent></Card></Collapsible>;
}

function SkeletonList({ count, height }: { count: number; height: string }) { return <div className="space-y-4">{Array.from({ length: count }, (_, index) => <Skeleton key={index} className={`${height} w-full`} />)}</div>; }

function CoachAutomationsContent() {
  const { user, logout } = useAuth();
  return <CoachShell title="Emails & Αυτοματισμοί" user={user} logout={logout}><main className="mx-auto max-w-4xl pb-8"><Tabs defaultValue="automations"><TabsList className="mb-6"><TabsTrigger value="automations">Αυτοματισμοί</TabsTrigger><TabsTrigger value="emails">Emails &amp; Templates</TabsTrigger></TabsList><TabsContent value="automations"><AutomationsTab /></TabsContent><TabsContent value="emails"><EmailsTab /></TabsContent></Tabs></main></CoachShell>;
}

export default function CoachAutomationsPage() { return <ProtectedRoute allow="coach"><CoachAutomationsContent /></ProtectedRoute>; }
