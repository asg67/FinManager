import { prisma } from "../prisma.js";
import { notifyUser } from "../utils/pushNotify.js";

/**
 * Weekday expense reminder — runs Mon-Fri at 18:30 MSK (15:30 UTC).
 * Sends "Все ли расходы внесены?" to all non-manager users.
 */
export async function sendExpenseReminder() {
  const users = await prisma.user.findMany({
    where: { role: { not: "manager" } },
    select: { id: true },
  });

  console.log(`[cron] Sending expense reminder to ${users.length} users`);

  await Promise.allSettled(
    users.map((u) =>
      notifyUser(u.id, {
        type: "reminder",
        title: "Напоминание",
        body: "Все ли расходы внесены в меня?",
        url: "/dds",
      }),
    ),
  );
}
