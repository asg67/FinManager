import { prisma } from "../prisma.js";
import { notifyUser } from "../utils/pushNotify.js";

/**
 * Cash balance reminder for owners.
 * - Every Monday 09:30 MSK: "Зафиксируйте остатки по наличке"
 * - 1st of each month: "Зайдите в настройки и внесите остатки"
 */
export async function sendBalanceReminder(type: "weekly" | "monthly") {
  const owners = await prisma.user.findMany({
    where: { role: "owner" },
    select: { id: true },
  });

  const body =
    type === "weekly"
      ? "Зафиксируйте остатки по наличке"
      : "Зайдите в настройки и внесите остатки";

  console.log(`[cron] Sending ${type} balance reminder to ${owners.length} owners: "${body}"`);

  await Promise.allSettled(
    owners.map((u) =>
      notifyUser(u.id, {
        type: "reminder",
        title: "Напоминание",
        body,
        url: "/settings",
      }),
    ),
  );
}
