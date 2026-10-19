"use client";

import Lenis from "lenis";
import { useEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";

// Keystatic's admin UI manages its own internal scrolling as a fixed-position
// SPA shell — it never scrolls the document — so Lenis hijacking the wheel
// event there blocks scrolling inside it entirely. Only run Lenis on the
// public marketing pages.
const EXCLUDED_PREFIXES = ["/keystatic", "/login"];

export function SmoothScrollProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const disabled = EXCLUDED_PREFIXES.some((prefix) => pathname?.startsWith(prefix));

  useEffect(() => {
    if (disabled) return;

    const lenis = new Lenis({
      duration: 1.1,
      smoothWheel: true,
    });

    function raf(time: number) {
      lenis.raf(time);
      frame = requestAnimationFrame(raf);
    }
    let frame = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(frame);
      lenis.destroy();
    };
  }, [disabled]);

  return <>{children}</>;
}
