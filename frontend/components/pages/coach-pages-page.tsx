"use client";

import Link from "next/link";
import { Apple, ArrowRight, BarChart3, ClipboardList, Dumbbell, FilePlus2, Images, LayoutGrid, Palette, Users, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { CoachShell } from "@/components/shell/coach-shell";
import { useAuth } from "@/lib/auth/auth-context";

type Access = "public" | "coach" | "client";

interface AppPage {
  href: string;
  label: string;
  icon: LucideIcon;
  access: Access;
}

const pageGroups: Array<{ title: string; pages: AppPage[] }> = [
  {
    title: "Πελάτες",
    pages: [
      { href: "/clients", label: "Λίστα Πελατών", icon: Users, access: "coach" },
      { href: "/clients", label: "Καρτέλα Πελάτη", icon: ClipboardList, access: "coach" },
    ],
  },
  {
    title: "Προπόνηση & Διατροφή",
    pages: [
      { href: "/exercises", label: "Βιβλιοθήκη Ασκήσεων", icon: Dumbbell, access: "coach" },
      { href: "/coach/foods", label: "Βιβλιοθήκη Τροφίμων", icon: Apple, access: "coach" },
      { href: "/coach/templates/training/new", label: "Νέο Πρότυπο Προπόνησης", icon: FilePlus2, access: "coach" },
      { href: "/coach/templates/nutrition/new", label: "Νέο Πρότυπο Διατροφής", icon: FilePlus2, access: "coach" },
    ],
  },
  {
    title: "Εγγραφές",
    pages: [
      { href: "/pricing-plans", label: "Τιμές", icon: BarChart3, access: "public" },
      { href: "/register", label: "Εγγραφή Πελάτη", icon: FilePlus2, access: "public" },
      { href: "/coach/pricing", label: "Διαχείριση Τιμών", icon: BarChart3, access: "coach" },
      { href: "/coach/questionnaire", label: "Ερωτηματολόγιο", icon: ClipboardList, access: "coach" },
    ],
  },
  {
    title: "Ρυθμίσεις",
    pages: [
      { href: "/coach/branding", label: "Branding", icon: Palette, access: "coach" },
      { href: "/coach/media", label: "Media Library", icon: Images, access: "coach" },
    ],
  },
  {
    title: "Analytics",
    pages: [{ href: "/analytics", label: "Analytics", icon: BarChart3, access: "coach" }],
  },
];

const accessStyles: Record<Access, string> = {
  public: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300",
  coach: "bg-blue-100 text-blue-700 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-300",
  client: "bg-violet-100 text-violet-700 hover:bg-violet-100 dark:bg-violet-950 dark:text-violet-300",
};

const accessLabels: Record<Access, string> = { public: "Public", coach: "Coach", client: "Client" };

function CoachPagesContent() {
  const { user, logout } = useAuth();

  return (
    <CoachShell title="Σελίδες" user={user} logout={logout}>
      <div className="mx-auto max-w-4xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Σελίδες</h1>
          <p className="mt-2 text-sm text-muted-foreground">Όλες οι διαθέσιμες σελίδες της εφαρμογής</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><LayoutGrid className="h-5 w-5" />Κατάλογος Σελίδων</CardTitle>
            <CardDescription>Επίλεξε μια σελίδα για μετάβαση.</CardDescription>
          </CardHeader>
          <CardContent>
            {pageGroups.map((group, groupIndex) => (
              <div key={group.title}>
                {groupIndex > 0 && <Separator className="my-6" />}
                <h2 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">{group.title}</h2>
                <div className="space-y-1">
                  {group.pages.map((page) => {
                    const Icon = page.icon;
                    return (
                      <Button
                        key={`${group.title}-${page.label}`}
                        variant="ghost"
                        className="h-11 w-full justify-start px-3 text-left font-normal hover:bg-muted"
                        nativeButton={false}
                        render={<Link href={page.href} />}
                      >
                        <Icon className="mr-3 h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="flex-1">{page.label}</span>
                        <Badge className={`mr-2 ${accessStyles[page.access]}`}>{accessLabels[page.access]}</Badge>
                        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                      </Button>
                    );
                  })}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </CoachShell>
  );
}

export default function CoachPagesPage() {
  return (
    <ProtectedRoute allow="coach">
      <CoachPagesContent />
    </ProtectedRoute>
  );
}
