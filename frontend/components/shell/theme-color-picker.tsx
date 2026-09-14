"use client";

import { useEffect, useState } from "react";
import { Check, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const ACCENT_STORAGE_KEY = "accentColor";

const accents = [
  { value: "red", label: "Κόκκινο", swatch: "#dc2626" },
  { value: "rose", label: "Ροζ", swatch: "#e11d48" },
  { value: "orange", label: "Πορτοκαλί", swatch: "#ea580c" },
  { value: "green", label: "Πράσινο", swatch: "#059669" },
  { value: "blue", label: "Μπλε", swatch: "#2563eb" },
  { value: "violet", label: "Βιολετί", swatch: "#7c3aed" },
] as const;

export function applyAccentColor(value: string) {
  if (value === "red") {
    document.documentElement.removeAttribute("data-accent");
  } else {
    document.documentElement.setAttribute("data-accent", value);
  }
  window.localStorage.setItem(ACCENT_STORAGE_KEY, value);
}

export function ThemeColorPicker() {
  const [accent, setAccent] = useState<string>("red");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setAccent(window.localStorage.getItem(ACCENT_STORAGE_KEY) || "red");
  }, []);

  const selectAccent = (value: string) => {
    setAccent(value);
    applyAccentColor(value);
  };

  const activeSwatch = accents.find((item) => item.value === accent) || accents[0];

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button variant="outline" size="icon-sm" aria-label="Αλλαγή χρώματος εφαρμογής" title="Χρώμα εφαρμογής">
            {mounted ? (
              <span className="h-4 w-4 rounded-full border border-black/10" style={{ backgroundColor: activeSwatch.swatch }} />
            ) : (
              <Palette className="h-5 w-5" />
            )}
          </Button>
        }
      />
      <PopoverContent align="end" className="w-56">
        <div className="mb-3 text-sm font-bold text-slate-700">Χρώμα Εφαρμογής</div>
        <div className="grid grid-cols-3 gap-2">
          {accents.map((item) => (
            <Button
              key={item.value}
              type="button"
              variant="outline"
              onClick={() => selectAccent(item.value)}
              title={item.label}
              className={cn(
                "h-auto flex-col gap-1.5 p-2 text-xs font-semibold",
                accent === item.value && "border-slate-900",
              )}
            >
              <span
                className="grid h-6 w-6 place-items-center rounded-full border border-black/10"
                style={{ backgroundColor: item.swatch }}
              >
                {accent === item.value && <Check className="h-3.5 w-3.5 text-white" />}
              </span>
              {item.label}
            </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
