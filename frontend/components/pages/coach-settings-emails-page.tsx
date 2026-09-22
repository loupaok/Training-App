"use client";

import { useEffect, useState } from "react";
import { Bell, ChevronDown, ClipboardList, CreditCard, Mail, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { CoachShell } from "@/components/shell/coach-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth/auth-context";
import { api } from "@/lib/api/client";

type TemplateKey = "update_reminder" | "registration" | "subscription_expiry" | "update_notification";
type EmailTemplate = { key: TemplateKey; name: string; subject: string; body: string; variables: string[] };

const templatePresentation = {
  update_reminder: { Icon: Bell, iconClass: "text-blue-600", variables: ["{{clientName}}", "{{submitUrl}}"] },
  registration: { Icon: UserCheck, iconClass: "text-green-600", variables: ["{{clientName}}", "{{planName}}"] },
  subscription_expiry: { Icon: CreditCard, iconClass: "text-amber-600", variables: ["{{clientName}}", "{{daysLeft}}", "{{renewUrl}}"] },
  update_notification: { Icon: ClipboardList, iconClass: "text-purple-600", variables: ["{{clientName}}", "{{weight}}", "{{trainingScore}}", "{{nutritionScore}}", "{{updateUrl}}"] },
} as const;

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Σφάλμα φόρτωσης.";
}

function EmailsContent() {
  const { user, logout } = useAuth();
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [testEmails, setTestEmails] = useState<Record<string, string>>({});

  useEffect(() => {
    api.get<EmailTemplate[]>("/settings/email-templates")
      .then(setTemplates)
      .catch((requestError) => setError(getErrorMessage(requestError)))
      .finally(() => setLoading(false));
  }, []);

  const updateTemplate = (templateKey: TemplateKey, changes: Partial<EmailTemplate>) => {
    setTemplates((current) => current.map((template) => template.key === templateKey ? { ...template, ...changes } : template));
  };

  const saveTemplate = async (template: EmailTemplate) => {
    setSaving(template.key);
    try {
      const saved = await api.put<EmailTemplate>(`/settings/email-templates/${template.key}`, { subject: template.subject, body: template.body });
      updateTemplate(template.key, saved);
      toast.success("Template αποθηκεύτηκε");
    } catch (requestError) {
      toast.error(getErrorMessage(requestError));
    } finally {
      setSaving(null);
    }
  };

  const sendTest = async (template: EmailTemplate) => {
    const testEmail = testEmails[template.key]?.trim();
    if (!testEmail) {
      toast.error("Συμπλήρωσε email για το test.");
      return;
    }
    setTesting(template.key);
    try {
      await api.post("/settings/email-templates/test", { templateKey: template.key, testEmail });
      toast.success("Test email εστάλη!");
    } catch (requestError) {
      toast.error(getErrorMessage(requestError));
    } finally {
      setTesting(null);
    }
  };

  const copyVariable = async (variable: string) => {
    try {
      await navigator.clipboard.writeText(variable);
      toast.success("Αντιγράφηκε!");
    } catch {
      toast.error("Δεν έγινε η αντιγραφή.");
    }
  };

  return (
    <CoachShell title="Emails & Templates" user={user} logout={logout}>
      <main className="mx-auto max-w-4xl space-y-6 pb-8">
        <header>
          <h1 className="text-3xl font-bold">Emails &amp; Templates</h1>
          <p className="mt-2 text-sm text-muted-foreground">Διαχείριση αυτόματων email της εφαρμογής.</p>
        </header>

        <Card className="bg-muted/60">
          <CardContent className="gap-3">
            <div className="flex items-center gap-2 font-medium"><Mail className="size-4" /> Ρύθμιση SMTP</div>
            <p className="text-sm text-muted-foreground">Για να αποστέλλονται τα emails, συμπλήρωσε τα παρακάτω στο αρχείο <code>backend/.env</code>:</p>
            <pre className="overflow-x-auto rounded-md border bg-background p-3 font-mono text-xs leading-6">SMTP_HOST=smtp.office365.com{"\n"}SMTP_PORT=587{"\n"}SMTP_USER=your@email.com{"\n"}SMTP_PASS=your_password{"\n"}EMAIL_FROM=your@email.com</pre>
          </CardContent>
        </Card>

        {loading && <EmailSkeleton />}
        {error && <Card><CardContent className="text-destructive">Δεν φορτώθηκαν τα templates: {error}</CardContent></Card>}

        <div className="space-y-4">
          {templates.map((template) => {
            const presentation = templatePresentation[template.key];
            const TemplateIcon = presentation.Icon;
            return (
              <Collapsible key={template.key}>
                <Card>
                  <CollapsibleTrigger className="flex w-full items-center gap-3 px-6 text-left">
                    <TemplateIcon className={`size-5 ${presentation.iconClass}`} />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{template.name}</p>
                    </div>
                    <Badge variant="secondary">Αυτόματο</Badge>
                    <ChevronDown className="size-4 text-muted-foreground transition-transform [[data-state=open]_&]:rotate-180" />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="pt-6">
                      <Separator />
                      <div className="space-y-2 pt-3"><Label htmlFor={`${template.key}-subject`}>Θέμα</Label><Input id={`${template.key}-subject`} value={template.subject} onChange={(event) => updateTemplate(template.key, { subject: event.target.value })} /></div>
                      <div className="space-y-2"><Label htmlFor={`${template.key}-body`}>Περιεχόμενο</Label><Textarea id={`${template.key}-body`} rows={8} className="font-mono text-sm" value={template.body} onChange={(event) => updateTemplate(template.key, { body: event.target.value })} /></div>
                      <div className="space-y-2"><Label>Διαθέσιμες μεταβλητές</Label><div className="flex flex-wrap gap-2">{(template.variables.length ? template.variables : presentation.variables).map((variable) => <Button key={variable} type="button" variant="outline" size="xs" onClick={() => copyVariable(variable)}>{variable}</Button>)}</div></div>
                      <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row"><Input type="email" placeholder="test@email.com" value={testEmails[template.key] || ""} onChange={(event) => setTestEmails((current) => ({ ...current, [template.key]: event.target.value }))} /><Button type="button" variant="outline" onClick={() => sendTest(template)} disabled={testing === template.key}>{testing === template.key ? "Αποστολή..." : "Αποστολή test"}</Button></div>
                      <div><Button type="button" onClick={() => saveTemplate(template)} disabled={saving === template.key}>{saving === template.key ? "Αποθήκευση..." : "Αποθήκευση"}</Button></div>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            );
          })}
        </div>
      </main>
    </CoachShell>
  );
}

function EmailSkeleton() {
  return <div className="space-y-4">{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-20 w-full" />)}</div>;
}

export default function CoachSettingsEmailsPage() {
  return <ProtectedRoute allow="coach"><EmailsContent /></ProtectedRoute>;
}
