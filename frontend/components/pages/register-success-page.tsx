"use client";

import Link from "next/link";
import { CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function RegisterSuccessPage() {
  return (
    <div className="grid min-h-screen place-items-center bg-[#f7f8fb] px-5 py-12 dark:bg-slate-950">
      <Card className="w-full max-w-md p-8 text-center">
        <CheckCircle className="mx-auto h-12 w-12 text-emerald-500" />
        <h1 className="mt-5 text-2xl font-bold text-slate-950 dark:text-slate-50">Η εγγραφή σου ολοκληρώθηκε!</h1>
        <p className="mt-3 text-sm font-semibold leading-6 text-slate-500 dark:text-slate-400">
          Ο coach θα επικοινωνήσει μαζί σου εντός 24 ωρών για να επιβεβαιώσει την πληρωμή σου και να ενεργοποιήσει τον λογαριασμό σου.
        </p>
        <Button type="button" className="mt-8 h-12 w-full font-bold" nativeButton={false} render={<Link href="/client-billing" />}>
          Προβολή Στοιχείων Πληρωμής
        </Button>
      </Card>
    </div>
  );
}
