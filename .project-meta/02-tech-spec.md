# Tech Spec: FinManager

## Technology Stack

### Frontend
- **React 19** + TypeScript
- **Vite 6** — сборка, HMR
- **Tailwind CSS 4** — стили, glassmorphism
- **React Router 7** — маршрутизация
- **TanStack Query** — серверное состояние, кэширование
- **Zustand** — клиентское состояние (тема, язык, sidebar)
- **react-i18next** — интернационализация (ru/en)
- **Recharts** — графики (line, bar, pie)
- **react-hook-form + Zod** — формы и валидация
- **react-dropzone** — drag & drop для PDF
- **lucide-react** — иконки
- **clsx + tailwind-merge** — утилиты для className

### Backend (Node.js)
- **Express 4** + TypeScript
- **Prisma 6** — ORM, миграции, генерация типов
- **Zod** — валидация входящих данных
- **jsonwebtoken** — JWT auth
- **bcryptjs** — хэширование паролей
- **helmet** — HTTP security headers
- **cors** — CORS policy
- **express-rate-limit** — rate limiting
- **multer** — загрузка файлов (PDF)
- **pino** — structured logging
- **node-cron** — планировщик уведомлений

### PDF Microservice (Python)
- **FastAPI** — HTTP API
- **pdfplumber** — извлечение данных из PDF
- **pandas** — обработка таблиц
- **uvicorn** — ASGI сервер
- Общение с Node.js через HTTP (JSON)

### Database
- **PostgreSQL 16** (Docker)
- **Prisma** — миграции, типизированные запросы

### Tooling
- **Vitest** — unit/integration тесты
- **Supertest** — тесты API
- **Playwright** — E2E тесты (в будущем)
- **ESLint 9** — линтинг
- **Prettier** — форматирование
- **Docker Compose** — PostgreSQL + PDF-сервис

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Browser                           │
│  React SPA (Vite)                                    │
│  ┌──────────┐ ┌──────────┐ ┌───────────┐            │
│  │ Dashboard │ │   ДДС    │ │ PDF Upload│  ...       │
│  └──────────┘ └──────────┘ └───────────┘            │
└────────────────────┬────────────────────────────────┘
                     │ HTTP (REST API)
                     ▼
┌─────────────────────────────────────────────────────┐
│              Node.js (Express)                       │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌──────────┐     │
│  │  Auth  │ │  DDS   │ │  PDF   │ │ Analytics│     │
│  │ routes │ │ routes │ │ routes │ │  routes  │     │
│  └───┬────┘ └───┬────┘ └───┬────┘ └────┬─────┘     │
│      │          │          │            │            │
│  ┌───┴──────────┴──────────┴────────────┴─────┐     │
│  │           Prisma ORM                        │     │
│  └─────────────────┬──────────────────────────┘     │
└────────────────────┼────────────────────────────────┘
                     │                    │
                     ▼                    ▼ HTTP
          ┌──────────────────┐  ┌──────────────────┐
          │   PostgreSQL 16  │  │  Python FastAPI   │
          │   (Docker)       │  │  PDF Parser       │
          │                  │  │  (Docker)         │
          └──────────────────┘  └──────────────────┘
```

### Потоки данных

**ДДС операция:**
```
React Form → POST /api/dds/operations → Zod validation → Prisma → PostgreSQL
```

**PDF загрузка:**
```
React Dropzone → POST /api/pdf/upload (multer)
  → Node.js → POST http://pdf-service:8080/parse (file + bank_code)
  → Python парсит PDF → возвращает JSON с транзакциями
  → Node.js возвращает preview клиенту
  → Пользователь подтверждает
  → POST /api/pdf/confirm → Prisma dedupe + insert → PostgreSQL
```

**Dashboard:**
```
React → GET /api/analytics/summary → Prisma aggregations → PostgreSQL
React → GET /api/analytics/by-category → Prisma groupBy → PostgreSQL
```

---

## Database Schema (Prisma)

```prisma
// ============ AUTH & USERS ============

model User {
  id            String   @id @default(uuid())
  email         String   @unique
  passwordHash  String
  name          String
  language      String   @default("ru")    // "ru" | "en"
  theme         String   @default("dark")  // "dark" | "light"
  role          String   @default("owner") // "owner" | "employee"
  invitedById   String?
  invitedBy     User?    @relation("Invitations", fields: [invitedById], references: [id])
  invitees      User[]   @relation("Invitations")
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  // Relations
  permissions      Permission[]
  entities         Entity[]          // ИП, которые создал владелец
  entityAccess     EntityAccess[]    // к каким ИП имеет доступ (для сотрудников)
  ddsOperations    DdsOperation[]
  pdfUploads       PdfUpload[]
  notifications    Notification[]
  ddsTemplates     DdsTemplate[]
}

model Permission {
  id        String  @id @default(uuid())
  userId    String
  user      User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  dds       Boolean @default(false)
  pdfUpload Boolean @default(false)
  analytics Boolean @default(false)
  export    Boolean @default(false)

  @@unique([userId])
}

// ============ BUSINESS ENTITIES ============

model Entity {
  id        String   @id @default(uuid())
  name      String                        // "ИП Скобелев"
  ownerId   String
  owner     User     @relation(fields: [ownerId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  accounts       Account[]
  expenseTypes   ExpenseType[]
  ddsOperations  DdsOperation[]
  ddsTemplates   DdsTemplate[]
  entityAccess   EntityAccess[]
}

model EntityAccess {
  id        String @id @default(uuid())
  userId    String
  user      User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  entityId  String
  entity    Entity @relation(fields: [entityId], references: [id], onDelete: Cascade)

  @@unique([userId, entityId])
}

model Account {
  id             String  @id @default(uuid())
  name           String                      // "р/с Тинькофф ИП Скобелев"
  type           String                      // "checking" | "card" | "cash" | "deposit"
  bank           String?                     // "sber" | "tbank" | "module" | ...
  accountNumber  String?                     // номер счёта (для PDF-валидации)
  contractNumber String?                     // номер договора (для Т-Банк PDF)
  entityId       String
  entity         Entity  @relation(fields: [entityId], references: [id], onDelete: Cascade)
  createdAt      DateTime @default(now())

  transactionsFrom DdsOperation[] @relation("FromAccount")
  transactionsTo   DdsOperation[] @relation("ToAccount")
  bankStatements   BankTransaction[]
}

// ============ EXPENSE CATEGORIES ============

model ExpenseType {
  id        String   @id @default(uuid())
  name      String                         // "Закупка товаров"
  entityId  String
  entity    Entity   @relation(fields: [entityId], references: [id], onDelete: Cascade)
  sortOrder Int      @default(0)
  createdAt DateTime @default(now())

  articles      ExpenseArticle[]
  ddsOperations DdsOperation[]
  ddsTemplates  DdsTemplate[]
}

model ExpenseArticle {
  id            String      @id @default(uuid())
  name          String                       // "Доставка товаров"
  expenseTypeId String
  expenseType   ExpenseType @relation(fields: [expenseTypeId], references: [id], onDelete: Cascade)
  sortOrder     Int         @default(0)

  ddsOperations DdsOperation[]
  ddsTemplates  DdsTemplate[]
}

// ============ DDS OPERATIONS ============

model DdsOperation {
  id              String   @id @default(uuid())
  operationType   String                     // "income" | "expense" | "transfer"
  amount          Decimal  @db.Decimal(15, 2)
  fromAccountId   String?
  fromAccount     Account? @relation("FromAccount", fields: [fromAccountId], references: [id])
  toAccountId     String?
  toAccount       Account? @relation("ToAccount", fields: [toAccountId], references: [id])
  expenseTypeId   String?
  expenseType     ExpenseType? @relation(fields: [expenseTypeId], references: [id])
  expenseArticleId String?
  expenseArticle  ExpenseArticle? @relation(fields: [expenseArticleId], references: [id])
  orderNumber     String?
  comment         String?
  entityId        String
  entity          Entity   @relation(fields: [entityId], references: [id])
  userId          String
  user            User     @relation(fields: [userId], references: [id])
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

// ============ DDS TEMPLATES ============

model DdsTemplate {
  id              String  @id @default(uuid())
  name            String                      // "Закупка Алексеев Тиньк"
  operationType   String                      // "income" | "expense" | "transfer"
  entityId        String
  entity          Entity  @relation(fields: [entityId], references: [id], onDelete: Cascade)
  fromAccountId   String?
  toAccountId     String?
  expenseTypeId   String?
  expenseType     ExpenseType? @relation(fields: [expenseTypeId], references: [id])
  expenseArticleId String?
  expenseArticle  ExpenseArticle? @relation(fields: [expenseArticleId], references: [id])
  userId          String
  user            User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  createdAt       DateTime @default(now())
}

// ============ PDF / BANK TRANSACTIONS ============

model PdfUpload {
  id          String   @id @default(uuid())
  fileName    String
  bankCode    String                        // "sber" | "tbank" | "tbank_dep"
  accountId   String
  status      String   @default("pending")  // "pending" | "confirmed" | "rejected"
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  createdAt   DateTime @default(now())

  transactions BankTransaction[]
}

model BankTransaction {
  id            String   @id @default(uuid())
  date          DateTime @db.Date
  time          String?                     // "14:23:05"
  amount        Decimal  @db.Decimal(15, 2)
  direction     String                      // "income" | "expense"
  counterparty  String?
  purpose       String?                     // назначение платежа
  balance       Decimal? @db.Decimal(15, 2) // остаток средств
  ddsArticle    String?                     // статья ДДС
  accountId     String
  account       Account  @relation(fields: [accountId], references: [id])
  pdfUploadId   String?
  pdfUpload     PdfUpload? @relation(fields: [pdfUploadId], references: [id])
  dedupeKey     String?                     // для дедупликации
  createdAt     DateTime @default(now())

  @@index([accountId, date])
  @@index([dedupeKey])
}

// ============ NOTIFICATIONS ============

model Notification {
  id        String   @id @default(uuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  type      String                         // "reminder" | "employee_action" | "system"
  title     String
  body      String
  read      Boolean  @default(false)
  createdAt DateTime @default(now())

  @@index([userId, read])
}
```

---

## API Endpoints

### Auth
```
POST   /api/auth/register        { email, password, name }
POST   /api/auth/login            { email, password }
POST   /api/auth/refresh          { refreshToken }
GET    /api/auth/me               → текущий пользователь
PUT    /api/auth/me               { name, language, theme }
```

### Entities (ИП)
```
GET    /api/entities              → список ИП текущего пользователя
POST   /api/entities              { name }
PUT    /api/entities/:id          { name }
DELETE /api/entities/:id
```

### Accounts (счета/карты)
```
GET    /api/entities/:entityId/accounts
POST   /api/entities/:entityId/accounts    { name, type, bank, accountNumber, contractNumber }
PUT    /api/accounts/:id
DELETE /api/accounts/:id
```

### Expense Types & Articles
```
GET    /api/entities/:entityId/expense-types
POST   /api/entities/:entityId/expense-types     { name }
PUT    /api/expense-types/:id                    { name, sortOrder }
DELETE /api/expense-types/:id

GET    /api/expense-types/:typeId/articles
POST   /api/expense-types/:typeId/articles       { name }
PUT    /api/expense-articles/:id                 { name, sortOrder }
DELETE /api/expense-articles/:id
```

### DDS Operations
```
GET    /api/dds/operations        ?entityId=&accountId=&type=&dateFrom=&dateTo=&search=&page=&limit=
POST   /api/dds/operations        { operationType, amount, fromAccountId, toAccountId, ... }
PUT    /api/dds/operations/:id
DELETE /api/dds/operations/:id
```

### DDS Templates
```
GET    /api/dds/templates         ?entityId=
POST   /api/dds/templates         { name, operationType, entityId, ... }
PUT    /api/dds/templates/:id
DELETE /api/dds/templates/:id
```

### PDF Upload
```
POST   /api/pdf/upload            multipart: file + bankCode + accountId → returns parsed preview
POST   /api/pdf/confirm           { uploadId, transactions[] }  → saves to DB
GET    /api/pdf/uploads           → history
```

### Bank Transactions
```
GET    /api/bank-transactions     ?accountId=&dateFrom=&dateTo=&direction=&page=&limit=
DELETE /api/bank-transactions/:id
```

### Analytics
```
GET    /api/analytics/summary          ?entityId=&dateFrom=&dateTo=
GET    /api/analytics/by-category      ?entityId=&dateFrom=&dateTo=
GET    /api/analytics/timeline         ?accountId=&period=7d|30d|90d|1y
GET    /api/analytics/account-balances ?entityId=
```

### Employees
```
POST   /api/employees/invite      { email, entityIds[], permissions }
GET    /api/employees             → список сотрудников
PUT    /api/employees/:id         { permissions, entityIds[] }
DELETE /api/employees/:id
```

### Notifications
```
GET    /api/notifications         ?unreadOnly=true&page=&limit=
PUT    /api/notifications/:id/read
PUT    /api/notifications/read-all
GET    /api/notifications/count   → { unread: 5 }
```

### Export
```
GET    /api/export/csv            ?entityId=&accountId=&dateFrom=&dateTo=&source=dds|bank|all
```

---

## Project Structure

```
fin-manager/
├── src/
│   ├── client/                   # React SPA
│   │   ├── components/
│   │   │   ├── ui/               # Button, Input, Card, Modal, Select...
│   │   │   ├── layout/           # Sidebar, Header, ThemeToggle
│   │   │   ├── dashboard/        # Summary cards, Charts
│   │   │   ├── dds/              # DDS wizard, Templates, Operations table
│   │   │   ├── pdf/              # Upload zone, Preview table
│   │   │   ├── settings/         # Entities, Accounts, Categories
│   │   │   ├── employees/        # Invite, Permissions
│   │   │   └── notifications/    # Bell, Dropdown, Page
│   │   ├── pages/                # Route pages
│   │   ├── hooks/                # Custom hooks (useAuth, useDDS, ...)
│   │   ├── api/                  # API client (fetch wrappers)
│   │   ├── store/                # Zustand stores (theme, sidebar, ...)
│   │   ├── i18n/                 # Translations (ru.json, en.json)
│   │   ├── lib/                  # Utilities (formatAmount, cn, ...)
│   │   ├── types/                # Client-specific types
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   ├── index.html
│   │   └── vite.config.ts
│   │
│   ├── server/                   # Express API
│   │   ├── routes/
│   │   │   ├── auth.ts
│   │   │   ├── entities.ts
│   │   │   ├── accounts.ts
│   │   │   ├── expenseTypes.ts
│   │   │   ├── ddsOperations.ts
│   │   │   ├── ddsTemplates.ts
│   │   │   ├── pdfUpload.ts
│   │   │   ├── bankTransactions.ts
│   │   │   ├── analytics.ts
│   │   │   ├── employees.ts
│   │   │   ├── notifications.ts
│   │   │   └── export.ts
│   │   ├── middleware/
│   │   │   ├── auth.ts           # JWT verification
│   │   │   ├── permissions.ts    # Role/permission checks
│   │   │   ├── validate.ts       # Zod schema validation
│   │   │   └── errorHandler.ts   # Global error handler
│   │   ├── services/
│   │   │   ├── pdfService.ts     # Communication with Python service
│   │   │   ├── dedupeService.ts  # Transaction deduplication
│   │   │   ├── notificationService.ts
│   │   │   └── analyticsService.ts
│   │   ├── schemas/              # Zod validation schemas
│   │   ├── config.ts
│   │   ├── prisma.ts             # Prisma client singleton
│   │   └── index.ts
│   │
│   └── shared/                   # Shared types (client + server)
│       └── types.ts
│
├── pdf-service/                  # Python microservice
│   ├── app/
│   │   ├── main.py               # FastAPI app
│   │   ├── parsers/
│   │   │   ├── sber.py
│   │   │   ├── tbank.py
│   │   │   └── tbank_deposit.py
│   │   ├── models.py             # Pydantic response models
│   │   └── utils.py              # Shared parsing utilities
│   ├── requirements.txt
│   └── Dockerfile
│
├── prisma/
│   ├── schema.prisma
│   ├── seed.ts                   # Seed data
│   └── migrations/
│
├── tests/
│   ├── unit/
│   ├── integration/
│   └── fixtures/                 # Test PDF files, mock data
│
├── docker-compose.yml            # PostgreSQL + PDF service
├── package.json
├── tsconfig.json
└── .env.example
```

---

## Security

- **Passwords**: bcrypt (10 rounds)
- **Auth**: JWT access token (15min) + refresh token (7d)
- **Input validation**: Zod на каждом endpoint
- **SQL injection**: Prisma parametrized queries
- **XSS**: React auto-escaping + helmet CSP headers
- **CORS**: whitelist origins only
- **Rate limiting**: 100 req/min per IP (auth endpoints: 10 req/min)
- **File upload**: max 10MB, только .pdf по MIME type
- **Secrets**: .env (никогда в коде)
- **Permissions**: middleware проверяет роль + права на каждом защищённом route

---

## Testing Strategy

| Уровень | Инструмент | Что тестируем |
|---------|------------|---------------|
| Unit | Vitest | Утилиты, сервисы, валидация, хуки |
| Integration | Vitest + Supertest | API endpoints с тестовой БД |
| Component | Vitest + Testing Library | React-компоненты |
| E2E | Playwright (позже) | Полные сценарии |
| PDF parsing | pytest | Python-парсеры на реальных PDF |

Coverage target: > 80%
