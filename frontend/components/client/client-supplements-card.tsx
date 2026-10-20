"use client";

import { useCallback, useEffect, useState } from "react";
import { Link2, Pill } from "lucide-react";
import { api } from "@/lib/api/client";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

type Supplement = {
  id: number;
  name: string;
  dose_amount: number | string | null;
  dose_unit: "ml" | "gr" | "mg";
  times_per_day: number | string | null;
  link: string | null;
};

export function ClientSupplementsCard() {
  const [supplements, setSupplements] = useState<Supplement[]>([]);
  const [generalNotes, setGeneralNotes] = useState("");

  const loadSupplements = useCallback(async () => {
    try {
      const result = await api.get<{ items: Supplement[]; generalNotes: string }>("/client/supplements", { cache: "no-store" });
      setSupplements(result.items);
      setGeneralNotes(result.generalNotes || "");
    } catch {
      // Keep the last valid list visible during a transient network error.
    }
  }, []);

  useEffect(() => {
    void loadSupplements();

    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void loadSupplements();
    };

    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    const refreshInterval = window.setInterval(loadSupplements, 60_000);

    return () => {
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      window.clearInterval(refreshInterval);
    };
  }, [loadSupplements]);

  if (supplements.length === 0) return null;

  return (
    <Accordion defaultValue={["supplements"]} className="overflow-hidden rounded-xl border border-border bg-card shadow-none">
      <AccordionItem value="supplements" className="border-0">
        <AccordionTrigger className="bg-[#E53935]/[0.08] px-5 py-4 hover:bg-[#E53935]/[0.12] hover:no-underline">
          <div className="flex items-center gap-2 text-sm font-bold text-[#E53935]">
            <Pill className="h-4 w-4" />
            Συμπληρώματα
          </div>
        </AccordionTrigger>
        <AccordionContent className="border-t border-[#E53935]/20">
          <div className="space-y-2 p-5">
            {supplements.map((supplement) => (
              <div key={supplement.id} className="rounded-lg bg-muted/60 px-3 py-3">
                {supplement.link ? (
                  <a
                    href={supplement.link}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 text-sm font-semibold text-[#E53935] hover:underline"
                  >
                    <Link2 className="h-3.5 w-3.5 shrink-0" />
                    {supplement.name}
                  </a>
                ) : (
                  <p className="text-sm font-semibold">{supplement.name}</p>
                )}
                <p className="mt-1 text-xs text-muted-foreground">
                  {supplement.dose_amount ? `${supplement.dose_amount} ${supplement.dose_unit}` : null}
                  {supplement.dose_amount && supplement.times_per_day ? " · " : null}
                  {supplement.times_per_day ? `${supplement.times_per_day}x / ημέρα` : null}
                </p>
              </div>
            ))}
            {generalNotes && (
              <div className="rounded-lg bg-muted/60 px-3 py-3 text-sm leading-6 text-muted-foreground">
                <strong className="mb-0.5 block text-xs text-foreground">Σημείωση από τον coach</strong>
                {generalNotes}
              </div>
            )}
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
