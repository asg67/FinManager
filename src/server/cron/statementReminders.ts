import { prisma } from "../prisma.js";
import { notifyUser } from "../utils/pushNotify.js";

const MONTHS_RU = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];

/**
 * Statement upload reminders — runs daily at 10:00 MSK.
 * Sends notifications on the 2nd, 12th, and 22nd of each month.
 *
 * - 2nd: "Upload statements for 1–{lastDay} of previous month"
 * - 12th: "Upload statements for 1–10 of current month"
 * - 22nd: "Upload statements for 10–20 of current month"
 */
export async function checkStatementReminders() {
  // Use MSK time (UTC+3)
  const now = new Date();
  const msk = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  const day = msk.getUTCDate();

  if (![2, 12, 22].includes(day)) return;

  const currentMonth = msk.getUTCMonth(); // 0-based
  const currentYear = msk.getUTCFullYear();

  let body: string;

  if (day === 2) {
    // Previous month
    const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
    const lastDay = new Date(prevYear, prevMonth + 1, 0).getDate();
    const monthName = MONTHS_RU[prevMonth];
    body = `Загрузите выписки за 1–${lastDay} ${monthName}`;
  } else if (day === 12) {
    const monthName = MONTHS_RU[currentMonth];
    body = `Загрузите выписки за 1–10 ${monthName}`;
  } else {
    const monthName = MONTHS_RU[currentMonth];
    body = `Загрузите выписки за 10–20 ${monthName}`;
  }

  // Find all owner users (they manage statement uploads)
  const owners = await prisma.user.findMany({
    where: { role: "owner" },
    select: { id: true },
  });

  console.log(`[cron] Sending statement reminders to ${owners.length} owners: "${body}"`);

  await Promise.allSettled(
    owners.map((u) =>
      notifyUser(u.id, {
        type: "reminder",
        title: "Напоминание о выписках",
        body,
        url: "/statements",
      }),
    ),
  );
}
