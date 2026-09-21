"use client";

import { useEffect, useState } from "react";
import { BarChart } from "@tremor/react";
import Link from "next/link";
import { Apple, ArrowRight, BarChart3, ChevronDown, ChevronUp, ClipboardList, Download, Dumbbell, FilePlus2, Images, Palette, Users, UserCheck, Clock, UserX, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { CoachShell } from "@/components/shell/coach-shell";
import { UserAvatar } from "@/components/shared/user-avatar";
import { DateRangePicker } from "@/components/shared/date-range-picker";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { getInitials } from "@/lib/media";
import { useAuth } from "@/lib/auth/auth-context";
import { api } from "@/lib/api/client";

interface ClientRow {
  id: number | string;
  full_name?: string;
  email?: string;
  client_status_key?: string;
  latest_update_at?: string;
  latest_update_weight?: number | string;
}

interface PageEntry {
  href: string;
  label: string;
  icon: LucideIcon;
  public?: boolean;
  coachOnly?: boolean;
}

const pageGroups: Array<{ title: string; pages: PageEntry[] }> = [
  {
    title: "Πελάτες",
    pages: [
      { href: "/clients", label: "Λίστα Πελατών", icon: Users },
      { href: "/clients", label: "Καρτέλα Πελάτη", icon: ClipboardList },
    ],
  },
  {
    title: "Προπόνηση & Διατροφή",
    pages: [
      { href: "/exercises", label: "Βιβλιοθήκη Ασκήσεων", icon: Dumbbell },
      { href: "/coach/foods", label: "Βιβλιοθήκη Τροφίμων", icon: Apple, coachOnly: true },
      { href: "/coach/templates/training/new", label: "Νέο Πρότυπο Προπόνησης", icon: FilePlus2, coachOnly: true },
      { href: "/coach/templates/nutrition/new", label: "Νέο Πρότυπο Διατροφής", icon: FilePlus2, coachOnly: true },
    ],
  },
  {
    title: "Εγγραφές",
    pages: [
      { href: "/pricing-plans", label: "Τιμές (Public)", icon: BarChart3, public: true },
      { href: "/register", label: "Εγγραφή Πελάτη", icon: FilePlus2, public: true },
      { href: "/coach/pricing", label: "Διαχείριση Τιμών", icon: BarChart3, coachOnly: true },
      { href: "/coach/questionnaire", label: "Ερωτηματολόγιο", icon: ClipboardList, coachOnly: true },
    ],
  },
  {
    title: "Ρυθμίσεις",
    pages: [
      { href: "/coach/branding", label: "Branding", icon: Palette, coachOnly: true },
      { href: "/coach/media", label: "Media Library", icon: Images, coachOnly: true },
    ],
  },
  {
    title: "Analytics",
    pages: [{ href: "/analytics", label: "Analytics", icon: BarChart3 }],
  },
];

function CoachDashboardContent() {
  const { user, logout } = useAuth();
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [pagesOpen, setPagesOpen] = useState(false);

  useEffect(() => {
    api
      .get<ClientRow[]>("/clients")
      .then((rows) => setClients(Array.isArray(rows) ? rows : []))
      .catch(() => setClients([]));
  }, []);

  const totalClients = clients.length;
  const activeClients = clients.filter((client) => client.client_status_key === "active").length;
  const pendingClients = clients.filter((client) => client.client_status_key === "pending").length;
  const inactiveClients = clients.filter((client) => client.client_status_key === "inactive").length;
  const activePercentText = totalClients ? `${Math.round((activeClients / totalClients) * 100)}% του συνόλου` : "0% του συνόλου";

  const stats = [
    { label: "Σύνολο Πελατών", value: totalClients, note: "Πραγματικές εγγραφές", icon: Users },
    { label: "Ενεργοί Πελάτες", value: activeClients, note: activePercentText, icon: UserCheck },
    { label: "Εκκρεμείς Πληρωμές", value: pendingClients, note: "Αναμονή έγκρισης", icon: Clock },
    { label: "Ανενεργοί Πελάτες", value: inactiveClients, note: "Χωρίς ενεργή πληρωμή", icon: UserX },
  ];

  const overviewData = [
    { status: "Ενεργοί", Πελάτες: activeClients },
    { status: "Εκκρεμείς", Πελάτες: pendingClients },
    { status: "Ανενεργοί", Πελάτες: inactiveClients },
  ];

  const recentUpdates = clients
    .filter((client) => client.latest_update_at)
    .slice(0, 5)
    .map((client) => ({
      id: client.id,
      name: client.full_name || client.email || "Πελάτης",
      email: client.email || "",
      weight: client.latest_update_weight ? `${client.latest_update_weight} kg` : "-",
      initials: getInitials(client.full_name || client.email),
    }));

  return (
    <CoachShell title="Dashboard" user={user} logout={logout}>
      <div className="flex-1 space-y-4">
        <div className="flex items-center justify-between space-y-2">
          <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
          <div className="flex items-center space-x-2">
            <DateRangePicker />
            <Button variant="outline">
              <Download className="h-4 w-4" />
              Download
            </Button>
          </div>
        </div>

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="analytics" disabled>
              Analytics
            </TabsTrigger>
            <TabsTrigger value="reports" disabled>
              Reports
            </TabsTrigger>
            <TabsTrigger value="notifications" disabled>
              Notifications
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {stats.map((stat) => (
                <Card key={stat.label}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">{stat.label}</CardTitle>
                    <stat.icon className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stat.value}</div>
                    <p className="text-xs text-muted-foreground">{stat.note}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
              <Card className="lg:col-span-4">
                <CardHeader>
                  <CardTitle>Επισκόπηση</CardTitle>
                </CardHeader>
                <CardContent className="pl-2">
                  <BarChart
                    className="h-[300px]"
                    data={overviewData}
                    index="status"
                    categories={["Πελάτες"]}
                    colors={["blue"]}
                    showLegend={false}
                    showAnimation
                  />
                </CardContent>
              </Card>

              <Card className="lg:col-span-3">
                <CardHeader>
                  <CardTitle>Πρόσφατα Updates</CardTitle>
                  <CardDescription>
                    {recentUpdates.length
                      ? `${recentUpdates.length} πρόσφατες ενημερώσεις πελατών.`
                      : "Δεν υπάρχουν πραγματικά updates ακόμα."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {recentUpdates.map((update) => (
                    <div key={update.id} className="flex items-center gap-4">
                      <UserAvatar initials={update.initials} tone="bg-slate-900" />
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="truncate text-sm font-medium leading-none">{update.name}</p>
                        <p className="truncate text-sm text-muted-foreground">{update.email}</p>
                      </div>
                      <div className="font-medium">{update.weight}</div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            <Card>
              <Collapsible open={pagesOpen} onOpenChange={setPagesOpen}>
                <CardHeader className="p-0">
                  <CollapsibleTrigger
                    render={
                      <button type="button" className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left hover:bg-muted/50">
                        <div>
                          <CardTitle>Σελίδες</CardTitle>
                          <CardDescription className="mt-1">Όλες οι διαθέσιμες σελίδες</CardDescription>
                        </div>
                        <span className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground">
                          {pagesOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </span>
                      </button>
                    }
                  />
                </CardHeader>
                <CollapsibleContent>
                  <CardContent className="pt-0">
                    {pageGroups.map((group, groupIndex) => (
                      <div key={group.title}>
                        {groupIndex > 0 && <Separator className="my-5" />}
                        <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">{group.title}</h3>
                        <div className="space-y-1">
                          {group.pages.map((page) => {
                            const Icon = page.icon;
                            return (
                              <Button
                                key={`${group.title}-${page.label}`}
                                variant="ghost"
                                className="h-10 w-full justify-start px-3 text-left font-normal hover:bg-muted"
                                nativeButton={false}
                                render={<Link href={page.href} />}
                              >
                                <Icon className="mr-3 h-4 w-4 shrink-0 text-muted-foreground" />
                                <span className="flex-1">{page.label}</span>
                                {page.public && <Badge className="mr-2 bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300">Public</Badge>}
                                {page.coachOnly && <Badge className="mr-2 bg-blue-100 text-blue-700 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-300">Coach only</Badge>}
                                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                              </Button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </CoachShell>
  );
}

export default function CoachDashboardPage() {
  return (
    <ProtectedRoute allow="coach">
      <CoachDashboardContent />
    </ProtectedRoute>
  );
}
