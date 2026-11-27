"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { api } from "@/lib/api/client";

export type FontSize = "small" | "medium" | "large";

const FONT_SIZE_PX: Record<FontSize, string> = {
  small: "14px",
  medium: "16px",
  large: "18px",
};

interface FontSizeContextValue {
  fontSize: FontSize;
  setFontSize: (size: FontSize) => void;
}

const FontSizeContext = createContext<FontSizeContextValue | undefined>(undefined);

function applyFontSize(_size: FontSize) {
  // Tailwind's spacing and typography use rem. Changing the root font-size
  // therefore resized the entire navigation and every layout, including when
  // opening a menu. Keep the application chrome at its stable browser base.
  document.documentElement.style.removeProperty("font-size");
}

export function FontSizeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  // The preference is scoped per account so a client's choice cannot leak into
  // the coach interface on the same browser.
  const [fontSize, setFontSizeState] = useState<FontSize>("medium");

  useEffect(() => {
    if (!user?.id) {
      setFontSizeState("medium");
      applyFontSize("medium");
      return;
    }

    const storageKey = `fontSize:${user.id}`;
    const accountSize = user.fontSize && FONT_SIZE_PX[user.fontSize] ? user.fontSize : null;
    try {
      const stored = window.localStorage.getItem(storageKey) as FontSize | null;
      const next = accountSize || (stored && FONT_SIZE_PX[stored] ? stored : "medium");
      setFontSizeState(next);
      applyFontSize(next);
      window.localStorage.setItem(storageKey, next);
    } catch {
      const next = accountSize || "medium";
      setFontSizeState(next);
      applyFontSize(next);
    }
  }, [user?.id, user?.fontSize]);

  const setFontSize = (size: FontSize) => {
    setFontSizeState(size);
    applyFontSize(size);
    try {
      if (user?.id) window.localStorage.setItem(`fontSize:${user.id}`, size);
    } catch {
      // ignore
    }
    api.put("/auth/profile", { fontSize: size }).catch(() => {});
  };

  return <FontSizeContext.Provider value={{ fontSize, setFontSize }}>{children}</FontSizeContext.Provider>;
}

export function useFontSize() {
  const context = useContext(FontSizeContext);
  if (!context) throw new Error("useFontSize must be used within a FontSizeProvider");
  return context;
}
