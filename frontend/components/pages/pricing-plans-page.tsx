"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle, Shield, MessageCircle, TrendingUp, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { api } from "@/lib/api/client";

// Public marketing page — no auth, no ProtectedRoute. Fetches the same
// pricing_plans data the coach manages at /coach/pricing.

interface PlanFeature {
  text: string;
  included: boolean;
}

interface PricingPlan {
  id: number | string;
  name: string;
  badge?: string;
  description?: string;
  price: number | string;
  currency: string;
  period: string;
  features: PlanFeature[];
  isActive: boolean;
  isPopular: boolean;
  sortOrder: number;
}

const faqs = [
  {
    question: "Πότε ξεκινά το πρόγραμμά μου;",
    answer: "Μόλις επιβεβαιωθεί η πληρωμή σου, ο coach θα επικοινωνήσει μαζί σου εντός 24 ωρών για να ξεκινήσετε.",
  },
  {
    question: "Μπορώ να αλλάξω πλάνο;",
    answer: "Ναι, μπορείς να αναβαθμίσεις ή υποβαθμίσεις το πλάνο σου οποιαδήποτε στιγμή επικοινωνώντας με τον coach σου.",
  },
  {
    question: "Πώς γίνεται η πληρωμή;",
    answer: "Με τραπεζικό έμβασμα ή κάρτα μέσω Stripe (σύντομα).",
  },
  {
    question: "Υπάρχει δέσμευση συμβολαίου;",
    answer: "Όχι, μπορείς να ακυρώσεις οποιαδήποτε στιγμή χωρίς επιπλέον χρεώσεις.",
  },
];

function formatPeriodLabel(period: string): string {
  const normalized = (period || "").toLowerCase();
  if (normalized.includes("μηνια") || normalized.includes("monthly")) return "μήνα";
  return period;
}

export default function PricingPlansPage() {
  const [plans, setPlans] = useState<PricingPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get<PricingPlan[]>("/pricing-plans")
      .then((rows) => setPlans(rows.filter((plan) => plan.isActive).sort((a, b) => a.sortOrder - b.sortOrder)))
      .catch(() => setError("Δεν φορτώθηκαν τα πλάνα. Δοκίμασε ξανά αργότερα."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      <div className="mx-auto max-w-5xl px-6 py-16 sm:py-24">
        {/* Hero */}
        <div className="text-center">
          <Badge variant="outline" className="mx-auto mb-5 h-auto w-fit gap-1.5 rounded-full px-4 py-1.5 text-sm font-bold">
            💪 Online Personal Training
          </Badge>
          <h1 className="text-4xl font-bold text-slate-950 dark:text-slate-50">Ξεκίνα το Ταξίδι σου</h1>
          <p className="mx-auto mt-4 max-w-xl text-xl text-muted-foreground">
            Εξατομικευμένη προπόνηση και διατροφή για τους στόχους σου
          </p>
        </div>

        {/* Pricing cards */}
        <div className="mx-auto mt-14 max-w-4xl">
          <h2 className="text-center text-2xl font-bold text-slate-950 dark:text-slate-50">Επέλεξε το Πλάνο σου</h2>

          {loading && <p className="mt-8 text-center text-sm font-semibold text-slate-500 dark:text-slate-400">Φόρτωση πλάνων...</p>}
          {error && <p className="mt-8 text-center text-sm font-semibold text-red-600 dark:text-red-400">{error}</p>}

          {!loading && !error && (
            <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2">
              {plans.map((plan) => (
                <PlanCard key={plan.id} plan={plan} />
              ))}
              {!plans.length && (
                <p className="col-span-full text-center text-sm font-semibold text-slate-500 dark:text-slate-400">
                  Δεν υπάρχουν διαθέσιμα πλάνα αυτή τη στιγμή.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Trust signals */}
        <div className="mx-auto mt-16 grid max-w-3xl grid-cols-1 gap-6 sm:grid-cols-3">
          <TrustSignal icon={Shield} label="Ασφαλής Πληρωμή" />
          <TrustSignal icon={MessageCircle} label="Άμεση Επικοινωνία" />
          <TrustSignal icon={TrendingUp} label="Εβδομαδιαία Παρακολούθηση" />
        </div>

        {/* FAQ */}
        <div className="mx-auto mt-20 max-w-2xl">
          <h2 className="text-center text-2xl font-bold text-slate-950 dark:text-slate-50">Συχνές Ερωτήσεις</h2>
          <Accordion className="mt-8">
            {faqs.map((faq, index) => (
              <AccordionItem key={index} value={index}>
                <AccordionTrigger className="text-base font-bold text-slate-950 dark:text-slate-50">{faq.question}</AccordionTrigger>
                <AccordionContent className="text-slate-600 dark:text-slate-400">{faq.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </div>
  );
}

function TrustSignal({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <Icon className="h-6 w-6 text-slate-400 dark:text-slate-500" />
      <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">{label}</span>
    </div>
  );
}

function PlanCard({ plan }: { plan: PricingPlan }) {
  const isPopular = plan.isPopular;

  return (
    <Card className={isPopular ? "relative border-2 border-primary p-6 shadow-lg ring-2 ring-primary/20" : "relative p-6"}>
      {isPopular && (
        <Badge className="absolute -top-3 left-1/2 h-auto -translate-x-1/2 rounded-full bg-primary px-4 py-1 text-xs font-bold text-white hover:bg-primary">
          ⭐ Δημοφιλές
        </Badge>
      )}

      <h3 className="text-xl font-bold text-slate-950 dark:text-slate-50">{plan.name}</h3>
      <div className="mt-3">
        <span className="text-4xl font-bold text-slate-950 dark:text-slate-50">€{Number(plan.price).toFixed(0)}</span>
        <span className="ml-1 text-sm text-muted-foreground">/{formatPeriodLabel(plan.period)}</span>
      </div>

      <Separator className="my-5" />

      <ul className="space-y-3">
        {plan.features
          .filter((feature) => feature.included)
          .map((feature, index) => (
            <li key={index} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-200">
              <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              {feature.text}
            </li>
          ))}
      </ul>

      <Button
        type="button"
        variant={isPopular ? "default" : "outline"}
        className="mt-6 h-11 w-full font-bold"
        nativeButton={false}
        render={<Link href={`/register?plan=${plan.id}`} />}
      >
        {isPopular ? "Ξεκίνα Τώρα" : "Επέλεξε Πλάνο"}
      </Button>
    </Card>
  );
}
