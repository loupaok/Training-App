import { api } from "@/lib/api/client";

export interface PushSubscriptionRow {
  id: number | string;
  endpoint: string;
  user_agent?: string | null;
  created_at?: string;
}

export function isPushSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function subscribeToPush(): Promise<void> {
  if (!isPushSupported()) {
    throw new Error("Ο browser δεν υποστηρίζει push notifications.");
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Δεν δόθηκε άδεια για ειδοποιήσεις.");
  }

  const { publicKey } = await api.get<{ publicKey: string }>("/clients/push/vapid-public-key");

  const registration = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
  });

  const json = subscription.toJSON();
  await api.post("/clients/push/subscribe", {
    endpoint: json.endpoint,
    keys: json.keys,
    userAgent: navigator.userAgent,
  });
}

export async function unsubscribeFromPush(): Promise<void> {
  if (!isPushSupported()) return;

  const registration = await navigator.serviceWorker.getRegistration("/sw.js");
  const subscription = await registration?.pushManager.getSubscription();

  if (subscription) {
    await api.post("/clients/push/unsubscribe", { endpoint: subscription.endpoint });
    await subscription.unsubscribe();
  }
}

export function listPushSubscriptions(): Promise<PushSubscriptionRow[]> {
  return api.get<PushSubscriptionRow[]>("/clients/push/subscriptions");
}

export function deletePushSubscription(id: number | string): Promise<{ message: string }> {
  return api.delete<{ message: string }>(`/clients/push/subscriptions/${id}`);
}
