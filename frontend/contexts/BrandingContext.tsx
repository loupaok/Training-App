"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api } from "@/lib/api/client";
import { resolveMediaUrl } from "@/lib/media";

export interface BrandingData {
  appName: string;
  primaryColor: string;
  logoUrl: string | null;
  faviconUrl: string | null;
}

const defaults: BrandingData = {
  appName: "CoachApp",
  primaryColor: "#e74c3c",
  logoUrl: null,
  faviconUrl: null,
};

interface BrandingContextValue {
  branding: BrandingData;
  refreshBranding: () => Promise<void>;
}

const BrandingContext = createContext<BrandingContextValue | null>(null);

function hexToHsl(hex: string): string {
  const normalized = /^#[0-9a-f]{6}$/i.test(hex) ? hex.slice(1) : defaults.primaryColor.slice(1);
  const red = Number.parseInt(normalized.slice(0, 2), 16) / 255;
  const green = Number.parseInt(normalized.slice(2, 4), 16) / 255;
  const blue = Number.parseInt(normalized.slice(4, 6), 16) / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;
  const delta = max - min;

  if (delta === 0) {
    return `0 0% ${Math.round(lightness * 100)}%`;
  }

  const saturation = delta / (1 - Math.abs(2 * lightness - 1));
  let hue = 0;

  if (max === red) hue = ((green - blue) / delta) % 6;
  else if (max === green) hue = (blue - red) / delta + 2;
  else hue = (red - green) / delta + 4;

  hue = Math.round(hue * 60);
  if (hue < 0) hue += 360;

  return `${hue} ${Math.round(saturation * 100)}% ${Math.round(lightness * 100)}%`;
}

function applyBranding(branding: BrandingData) {
  document.title = branding.appName;
  // The app uses --primary as a direct CSS color, so keep the converted HSL value valid in that context.
  document.documentElement.style.setProperty("--primary", `hsl(${hexToHsl(branding.primaryColor)})`);

  if (!branding.faviconUrl) return;

  let favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!favicon) {
    favicon = document.createElement("link");
    favicon.rel = "icon";
    document.head.appendChild(favicon);
  }

  favicon.href = resolveMediaUrl(branding.faviconUrl);
}

export function BrandingProvider({ children }: { children: ReactNode }) {
  const [branding, setBranding] = useState<BrandingData>(defaults);

  const refreshBranding = useCallback(async () => {
    const nextBranding = await api.get<BrandingData>("/branding");
    setBranding(nextBranding);
  }, []);

  useEffect(() => {
    void refreshBranding().catch(() => undefined);
  }, [refreshBranding]);

  useEffect(() => {
    applyBranding(branding);
  }, [branding]);

  const value = useMemo(() => ({ branding, refreshBranding }), [branding, refreshBranding]);

  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>;
}

export function useBranding() {
  const context = useContext(BrandingContext);

  if (!context) {
    throw new Error("useBranding must be used within a BrandingProvider");
  }

  return context;
}
