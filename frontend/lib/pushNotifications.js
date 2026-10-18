import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { API_BASE_URL } from "@/lib/api/client";
import { getNativePreference, nativeStorageKeys } from "@/lib/native/preferences";

let registrationStarted = false;

export async function registerPushToken() {
  if (!Capacitor.isNativePlatform() || registrationStarted) return;
  registrationStarted = true;

  try {
    const current = await PushNotifications.checkPermissions();
    const permission = current.receive === "prompt" ? await PushNotifications.requestPermissions() : current;
    if (permission.receive !== "granted") return;

    await PushNotifications.addListener("registration", async ({ value: pushToken }) => {
      try {
        const token = await getNativePreference(nativeStorageKeys.accessToken);
        if (!token) return;
        const response = await fetch(`${API_BASE_URL}/users/push-token`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ pushToken }),
        });
        if (!response.ok) console.error("Could not save native push token.");
      } catch (error) {
        console.error("Native push token registration failed:", error);
      }
    });
    await PushNotifications.addListener("registrationError", (error) => console.error("Native push registration failed:", error));
    await PushNotifications.register();
  } catch (error) {
    console.error("Native push setup failed:", error);
  }
}
