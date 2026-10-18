import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";

export const nativeStorageKeys = {
  accessToken: "token",
  refreshToken: "refreshToken",
  user: "user",
  pushToken: "pushToken",
} as const;

export function isNativePlatform() {
  return Capacitor.isNativePlatform();
}

export async function getNativePreference(key: string) {
  if (!isNativePlatform()) return typeof window === "undefined" ? null : window.localStorage.getItem(key);
  return (await Preferences.get({ key })).value;
}

export async function setNativePreference(key: string, value: string) {
  if (!isNativePlatform()) {
    window.localStorage.setItem(key, value);
    return;
  }
  await Preferences.set({ key, value });
}

export async function removeNativePreference(key: string) {
  if (!isNativePlatform()) {
    window.localStorage.removeItem(key);
    return;
  }
  await Preferences.remove({ key });
}
