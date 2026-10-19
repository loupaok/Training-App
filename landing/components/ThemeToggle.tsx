"use client";

import { Moon, Sun } from "./icons";
import { useTheme } from "./ThemeProvider";

export function ThemeToggle({ className = "", inverted = false }: { className?: string; inverted?: boolean }) {
  const { theme, toggle } = useTheme();

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Εναλλαγή θέματος"
      className={`grid h-10 w-10 place-items-center rounded-full border transition-colors hover:border-lime ${
        inverted
          ? "border-white/30 text-white"
          : "border-navy-200 text-navy-800 hover:text-navy-900 dark:border-white/15 dark:text-white"
      } ${className}`}
    >
      {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
