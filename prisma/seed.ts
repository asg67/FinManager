import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // 1. Create test owner
  const passwordHash = await bcrypt.hash("password123", 10);

  const owner = await prisma.user.upsert({
    where: { email: "owner@finmanager.dev" },
    update: {},
    create: {
      email: "owner@finmanager.dev",
      passwordHash,
      name: "Тестовый Владелец",
      role: "owner",
      language: "ru",
      theme: "dark",
      permission: {
        create: {
          dds: true,
          pdfUpload: true,
          analytics: true,
          export: true,
        },
      },
    },
  });

  console.log(`  Owner: ${owner.email} (${owner.id})`);

  // 2. Create 3 entities (ИП) — as in the DDS bot
  const entities = await Promise.all(
    ["ИП Скобелев", "ИП Кубатова", "ИП Алексеев"].map((name) =>
      prisma.entity.create({
        data: { name, ownerId: owner.id },
      }),
    ),
  );

  const [skobelev, kubatova, alekseev] = entities;
  console.log(`  Entities: ${entities.map((e) => e.name).join(", ")}`);

  // 3. Create accounts for each entity — matching the bot config
  const accountsData: { entityId: string; name: string; type: string; bank?: string }[] = [
    // ИП Скобелев
    { entityId: skobelev.id, name: "р/с Тинькофф ИП Скобелев", type: "checking", bank: "tbank" },
    { entityId: skobelev.id, name: "р/с Модуль ИП Скобелев", type: "checking", bank: "module" },
    { entityId: skobelev.id, name: "Карта Тиньк ИП Скобелев", type: "card", bank: "tbank" },
    { entityId: skobelev.id, name: "Карта Сбер ИП Скобелев", type: "card", bank: "sber" },
    { entityId: skobelev.id, name: "Карта Александра", type: "card" },
    { entityId: skobelev.id, name: "Наличные Никита", type: "cash" },
    { entityId: skobelev.id, name: "Депозит Никита", type: "deposit", bank: "tbank" },
    // ИП Кубатова
    { entityId: kubatova.id, name: "р/с Тинькофф ИП Кубатова", type: "checking", bank: "tbank" },
    { entityId: kubatova.id, name: "р/с Модуль ИП Кубатова", type: "checking", bank: "module" },
    { entityId: kubatova.id, name: "Карта Тиньк ИП Кубатова", type: "card", bank: "tbank" },
    { entityId: kubatova.id, name: "Карта Сбер ИП Кубатова", type: "card", bank: "sber" },
    { entityId: kubatova.id, name: "Наличные Вика", type: "cash" },
    { entityId: kubatova.id, name: "Депозит Вика", type: "deposit", bank: "tbank" },
    // ИП Алексеев
    { entityId: alekseev.id, name: "р/с Модуль ИП Алексеев", type: "checking", bank: "module" },
    { entityId: alekseev.id, name: "р/с Тинькофф ИП Алексеев", type: "checking", bank: "tbank" },
    { entityId: alekseev.id, name: "Карта Тиньк ИП Алексеев", type: "card", bank: "tbank" },
    { entityId: alekseev.id, name: "Карта Сбер ИП Алексеев", type: "card", bank: "sber" },
    { entityId: alekseev.id, name: "Наличные Денис", type: "cash" },
    { entityId: alekseev.id, name: "Депозит Денис", type: "deposit", bank: "tbank" },
  ];

  const accounts = await Promise.all(
    accountsData.map((a) => prisma.account.create({ data: a })),
  );
  console.log(`  Accounts: ${accounts.length} created`);

  // 4. Create expense types and articles — matching the DDS bot
  const expenseTypesData: {
    name: string;
    sortOrder: number;
    articles: string[];
  }[] = [
    {
      name: "Закупка товаров",
      sortOrder: 0,
      articles: [], // uses orderNumber instead of articles
    },
    {
      name: "Накладные расходы",
      sortOrder: 1,
      articles: [
        "Доставка товаров",
        "Комиссия за закуп",
        "Упаковка",
        "Честный знак",
        "ОТК",
      ],
    },
    {
      name: "Маркетинг и реклама",
      sortOrder: 2,
      articles: [
        "Фотосессия // Видеосъемка",
        "Кэшбек за отзывы",
        "Самовыкупы",
        "Размещение рекламы у блогеров",
        "Заказ опытных образцов",
        "Другое",
      ],
    },
    {
      name: "Административные расходы",
      sortOrder: 3,
      articles: [
        "Аренда и коммунальные платежи",
        "ЗП оклад",
        "ЗП бонус",
        "Обучение",
        "Подбор персонала",
        "Программное обеспечение",
        "Кредит",
        "Бухгалтерские услуги",
        "Логистика до МП",
        "Другое",
      ],
    },
  ];

  // Create expense types for each entity
  for (const entity of entities) {
    for (const et of expenseTypesData) {
      const expenseType = await prisma.expenseType.create({
        data: {
          name: et.name,
          entityId: entity.id,
          sortOrder: et.sortOrder,
        },
      });

      if (et.articles.length > 0) {
        await Promise.all(
          et.articles.map((name, i) =>
            prisma.expenseArticle.create({
              data: {
                name,
                expenseTypeId: expenseType.id,
                sortOrder: i,
              },
            }),
          ),
        );
      }
    }
  }

  console.log(`  Expense types: 4 per entity (12 total)`);
  console.log(`  Expense articles: seeded for each type`);

  // 5. Create a test employee
  const employee = await prisma.user.upsert({
    where: { email: "employee@finmanager.dev" },
    update: {},
    create: {
      email: "employee@finmanager.dev",
      passwordHash,
      name: "Тестовый Сотрудник",
      role: "employee",
      language: "ru",
      theme: "dark",
      invitedById: owner.id,
      permission: {
        create: {
          dds: true,
          pdfUpload: true,
          analytics: false,
          export: false,
        },
      },
    },
  });

  // Give employee access to first entity
  await prisma.entityAccess.create({
    data: {
      userId: employee.id,
      entityId: skobelev.id,
    },
  });

  console.log(`  Employee: ${employee.email} → access to ${skobelev.name}`);

  console.log("\nSeed completed!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
