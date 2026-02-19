import webpush from "web-push";
import { prisma } from "../prisma.js";
import { config } from "../config.js";

let vapidReady = false;

export function initVapid() {
  if (config.VAPID_PUBLIC_KEY && config.VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
      config.VAPID_SUBJECT,
      config.VAPID_PUBLIC_KEY,
      config.VAPID_PRIVATE_KEY,
    );
    vapidReady = true;
    console.log("[push] VAPID initialized");
  } else {
    console.log("[push] VAPID keys not configured, push notifications disabled");
  }
}

interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

export async function sendPushToUser(userId: string, payload: PushPayload) {
  if (!vapidReady) return;

  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  const staleIds: string[] = [];

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          JSON.stringify(payload),
        );
      } catch (err: any) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          staleIds.push(sub.id);
        } else {
          console.error(`[push] Failed to send to ${sub.endpoint.slice(0, 60)}:`, err.statusCode || err.message);
        }
      }
    }),
  );

  if (staleIds.length > 0) {
    await prisma.pushSubscription.deleteMany({ where: { id: { in: staleIds } } });
  }
}

export async function notifyUser(
  userId: string,
  opts: { type: string; title: string; body: string; url?: string },
) {
  await prisma.notification.create({
    data: { userId, type: opts.type, title: opts.title, body: opts.body },
  });
  await sendPushToUser(userId, { title: opts.title, body: opts.body, url: opts.url });
}

export async function notifyCompany(
  companyId: string,
  opts: { type: string; title: string; body: string; url?: string },
) {
  const users = await prisma.user.findMany({
    where: { companyId },
    select: { id: true },
  });

  await Promise.allSettled(
    users.map((u) => notifyUser(u.id, opts)),
  );
}
