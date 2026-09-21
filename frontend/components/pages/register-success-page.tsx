"use client";

import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/lib/auth/auth-context";

const timelineSteps = [
  { emoji: "📧", text: "Λαμβάνεις email επιβεβαίωσης" },
  { emoji: "✅", text: "Ο coach επιβεβαιώνει την πληρωμή σου" },
  { emoji: "🚀", text: "Ξεκινάς το πρόγραμμά σου!" },
];

export default function RegisterSuccessPage() {
  const { user } = useAuth();

  return (
    <div className="grid min-h-screen place-items-center bg-[#f7f8fb] px-5 py-12 dark:bg-slate-950">
      <Card className="w-full max-w-md p-8 text-center">
        <CheckCircle2 className="mx-auto h-16 w-16 animate-in zoom-in text-emerald-500 duration-500" />
        <h1 className="mt-5 text-2xl font-bold text-slate-950 dark:text-slate-50">Η εγγραφή σου ολοκληρώθηκε! 🎉</h1>
        <p className="mx-auto mt-3 max-w-md text-sm font-semibold leading-6 text-slate-500 dark:text-slate-400">
          Ο coach θα επικοινωνήσει μαζί σου εντός 24 ωρών για να επιβεβαιώσει την πληρωμή και να ενεργοποιήσει τον λογαριασμό σου.
        </p>

        <Separator className="my-6" />

        <div className="rounded-lg bg-muted p-4 text-left text-sm font-semibold text-slate-700 dark:text-slate-200">
          <div>📧 Στείλαμε email επιβεβαίωσης</div>
          {user?.email && <div className="mt-1 font-normal text-slate-500 dark:text-slate-400">{user.email}</div>}
        </div>

        <div className="mt-6 text-left">
          <div className="text-sm font-bold text-slate-700 dark:text-slate-200">⏳ Τι γίνεται τώρα;</div>
          <div className="relative mt-4">
            <div className="absolute top-4 bottom-4 left-4 w-px -translate-x-1/2 bg-slate-200 dark:bg-slate-700" />
            <div className="space-y-5">
              {timelineSteps.map((step) => (
                <div key={step.text} className="relative flex items-start gap-3">
                  <span className="relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-100 text-base ring-4 ring-white dark:bg-slate-800 dark:ring-slate-900">
                    {step.emoji}
                  </span>
                  <span className="pt-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">{step.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <Button
          type="button"
          className="mt-8 h-12 w-full font-bold"
          nativeButton={false}
          render={<Link href="/client-billing" />}
        >
          Δες την κατάσταση πληρωμής →
        </Button>

        <Link
          href="/pricing-plans"
          className="mt-4 block text-center text-sm font-semibold text-slate-500 hover:underline dark:text-slate-400"
        >
          Επιστροφή στην αρχική
        </Link>
      </Card>
    </div>
  );
}
