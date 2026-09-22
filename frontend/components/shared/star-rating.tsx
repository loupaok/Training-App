"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export function StarRating({ value = 0, onChange, readOnly = false, className }: { value?: number; onChange?: (value: number) => void; readOnly?: boolean; className?: string }) {
  return (
    <div className={cn("flex items-center gap-1", className)} aria-label={`${value} στα 5`}>
      {Array.from({ length: 5 }, (_, index) => {
        const selected = index < value;
        return (
          <button
            key={index}
            type="button"
            disabled={readOnly}
            onClick={() => onChange?.(index + 1)}
            className={cn("rounded-sm", readOnly ? "cursor-default" : "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary")}
            aria-label={`${index + 1} αστέρια`}
          >
            <Star className={cn("h-5 w-5", selected ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40")} />
          </button>
        );
      })}
    </div>
  );
}
