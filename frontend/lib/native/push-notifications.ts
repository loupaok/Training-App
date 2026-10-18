import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { nativeStorageKeys, setNativePreference } from "@/lib/native/preferences";

/** Registers the device with APNs/FCM. Persisting the token is frontend-only until an API endpoint is available. */
export async function registerNativePushNotifications() {
  if (!Capacitor.isNativePlatform()) return null;

  const permission = await PushNotifications.checkPermissions();
  const status = permission.receive === "prompt" ? await PushNotifications.requestPermissions() : permission;
  if (status.receive !== "granted") return null;

  await PushNotifications.register();
  return new Promise<string | null>((resolve) => {
    const timeout = window.setTimeout(() => resolve(null), 10000);
    void PushNotifications.addListener("registration", async (token) => {
      window.clearTimeout(timeout);
      await setNativePreference(nativeStorageKeys.pushToken, token.value);
      resolve(token.value);
    });
    void PushNotifications.addListener("registrationError", () => {
      window.clearTimeout(timeout);
      resolve(null);
    });
  });
}
