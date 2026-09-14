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

function applyFontSize(size: FontSize) {
  document.documentElement.style.fontSize = FONT_SIZE_PX[size];
}

export function FontSizeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  // Starts at "medium" for SSR-safe hydration; reconciles from localStorage then /auth/me.
  const [fontSize, setFontSizeState] = useState<FontSize>("medium");

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("fontSize") as FontSize | null;
      if (stored && FONT_SIZE_PX[stored]) {
        setFontSizeState(stored);
        applyFontSize(stored);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (user?.fontSize && FONT_SIZE_PX[user.fontSize]) {
      setFontSizeState(user.fontSize);
      applyFontSize(user.fontSize);
      try {
        window.localStorage.setItem("fontSize", user.fontSize);
      } catch {
        // ignore
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.fontSize]);

  const setFontSize = (size: FontSize) => {
    setFontSizeState(size);
    applyFontSize(size);
    try {
      window.localStorage.setItem("fontSize", size);
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
