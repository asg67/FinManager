import { notificationsApi } from "../api/notifications.js";

export function isPushSupported(): boolean {
  return (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export async function subscribeToPush(): Promise<boolean> {
  if (!isPushSupported()) return false;

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return false;

    const { publicKey } = await notificationsApi.getVapidKey();
    if (!publicKey) return false;

    const reg = await navigator.serviceWorker.ready;

    // Check for existing subscription
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });
    }

    const json = sub.toJSON();
    if (!json.endpoint || !json.keys) return false;

    await notificationsApi.subscribe({
      endpoint: json.endpoint,
      keys: json.keys,
    });

    return true;
  } catch (err) {
    console.error("[push] Subscribe failed:", err);
    return false;
  }
}

export async function unsubscribeFromPush(): Promise<void> {
  if (!isPushSupported()) return;

  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await notificationsApi.unsubscribe(sub.endpoint);
      await sub.unsubscribe();
    }
  } catch (err) {
    console.error("[push] Unsubscribe failed:", err);
  }
}
