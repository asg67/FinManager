# FinManager — Technical Specification

> Updated: 2026-03-26

---

## Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js + TypeScript + Express.js + tsx (no compile) |
| ORM | Prisma (PostgreSQL) |
| Frontend | React 19 + Vite + Zustand + React Router v7 |
| PDF Service | Python + FastAPI + pdfplumber (microservice, port 8080) |
| Process Mgmt | PM2 (cluster mode for API, fork for PDF) |
| Auth | JWT (access 15min + refresh 7d) |
| Validation | Zod (server), HTML5 (client) |
| Notifications | Web Push (VAPID) |
| i18n | i18next (ru, en) |
| Charts | Recharts |
| Export | ExcelJS |
| Logging | Pino |

---

## Infrastructure

```
Browser (React SPA)
    |
    ├── Static: nginx → /root/finmanager/src/client/dist
    │
    └── /api/* → nginx proxy → PM2 (tsx src/server/index.ts :3000)
                                    |
                                    ├── Prisma → PostgreSQL :5432
                                    └── /parse → PDF service (uvicorn :8080)
```

**VPS**: Beget, root@155.212.225.7
**Domain**: fm.zinchukfinance.ru
**DB**: PostgreSQL (user: finmanager, db: finmanager)
**PM2 apps**: `finmanager-api` (cluster), `finmanager-pdf` (fork)

---

## Database Schema (20 models, 13 migrations)

### Organization

| Model | Key Fields | Description |
|-------|-----------|-------------|
| Company | name (unique), mode ("full"/"dds_only"), onboardingDone | Компания |
| User | email, name, role, mode?, companyId?, disabledBanks (via Permission) | Пользователь |
| Permission | userId (unique), dds, pdfUpload, analytics, export, disabledBanks[] | Права доступа |
| Invite | token (unique), companyId, expiresAt | Инвайт-ссылка |

### Business Entities

| Model | Key Fields | Description |
|-------|-----------|-------------|
| Entity | name, ownerId, companyId? | Юр.лицо (ИП Фамилия) |
| EntityAccess | userId + entityId (unique) | Доступ пользователя к юр.лицу |
| Account | name, type, bank?, enabled, initialBalance?, entityId | Счёт (checking/card/cash/deposit) |

### DDS (Cash Flow)

| Model | Key Fields | Description |
|-------|-----------|-------------|
| DdsOperation | operationType, amount, entityId, from/toAccountId, expense/incomeType/Article, linkedBankTxId? | Операция ДДС |
| DdsTemplate | name, operationType, entityId, preset accounts/types | Шаблон операции |
| ExpenseType | name, entityId, sortOrder | Категория расходов |
| ExpenseArticle | name, expenseTypeId, sortOrder | Статья расходов |
| IncomeType | name, entityId, sortOrder | Категория приходов |
| IncomeArticle | name, incomeTypeId, sortOrder | Статья приходов |
| CustomField | name, fieldType, options?, showWhen?, companyId | Кастомное поле ДДС |
| CustomFieldValue | customFieldId, ddsOperationId, value | Значение кастомного поля |

### Bank Data

| Model | Key Fields | Description |
|-------|-----------|-------------|
| BankConnection | entityId, bankCode, token, lastSyncAt | Подключение к банку (API) |
| BankTransaction | date, amount, direction, accountId, pdfUploadId?, dedupeKey? | Банковская транзакция |
| PdfUpload | fileName, bankCode, accountId, status, userId | Загрузка выписки PDF |

### Notifications

| Model | Key Fields | Description |
|-------|-----------|-------------|
| Notification | userId, type, title, body, read | Уведомление |
| PushSubscription | userId, endpoint, p256dh, auth | Web Push подписка |

---

## API Routes (90+ endpoints)

### Auth `/api/auth`
| Method | Path | Description |
|--------|------|-------------|
| POST | /register | Регистрация + авто-ИП |
| POST | /login | Вход |
| POST | /refresh | Обновление токена |
| GET | /me | Текущий пользователь |
| PUT | /me | Обновить профиль |
| PUT | /password | Сменить пароль |
| POST | /avatar | Загрузить аватар |

### Entities `/api/entities`
| Method | Path | Description |
|--------|------|-------------|
| GET | / | Список юр.лиц (по EntityAccess) |
| GET | /:id | Юр.лицо с счетами и категориями |
| POST | / | Создать юр.лицо |
| PUT | /:id | Переименовать (owner) |
| DELETE | /:id | Удалить (owner) |

### Accounts `/api/entities/:entityId/accounts`
| Method | Path | Description |
|--------|------|-------------|
| GET | / | Список счетов (фильтр source, enabled, disabledBanks) |
| POST | / | Создать счёт |
| PUT | /:id | Обновить счёт |
| DELETE | /:id | Удалить счёт |

### DDS `/api/dds`
| Method | Path | Description |
|--------|------|-------------|
| POST | /operations | Создать операцию |
| GET | /operations | Список с фильтрами и пагинацией |
| PUT | /operations/:id | Обновить |
| DELETE | /operations/:id | Удалить |
| GET | /templates | Шаблоны пользователя |
| POST | /templates | Создать шаблон |
| PUT | /templates/:id | Обновить шаблон |
| DELETE | /templates/:id | Удалить шаблон |
| GET | /company-cash | Наличные всех ИП компании (для перемещений) |

### PDF/Statements `/api/pdf`
| Method | Path | Description |
|--------|------|-------------|
| POST | /upload | Загрузить PDF → парсинг |
| POST | /confirm | Подтвердить транзакции |
| GET | /uploads | История загрузок |
| GET | /transactions | Транзакции из PDF |
| PUT | /transactions/:id | Редактировать транзакцию |
| DELETE | /transactions/:id | Удалить транзакцию |
| DELETE | /transactions/all | Удалить все (по bankCode) |

### Analytics `/api/analytics`
| Method | Path | Description |
|--------|------|-------------|
| GET | /summary | Итоги: приход/расход/баланс |
| GET | /by-category | Расходы по категориям |
| GET | /timeline | Графики по дням |
| GET | /account-balances | Остатки на счетах |
| GET | /recent | Последние операции |

### Bank Connections `/api/bank-connections`
| Method | Path | Description |
|--------|------|-------------|
| GET | / | Список подключений |
| POST | / | Подключить банк |
| PUT | /:id | Обновить токен |
| DELETE | /:id | Удалить |
| POST | /:id/test | Тест соединения |
| GET | /:id/accounts | Счета из API банка |
| GET | /:id/transactions | Транзакции |
| POST | /:id/sync | Синхронизация |

### Reconciliation `/api/reconciliation`
| Method | Path | Description |
|--------|------|-------------|
| POST | /auto-match | Авто-сверка ДДС ↔ банк |
| POST | /link | Ручная привязка |
| POST | /unlink | Отвязать |
| GET | /status | Статистика сверки |

### Company `/api/company`
| Method | Path | Description |
|--------|------|-------------|
| GET | /invite/:token | Проверить инвайт (public) |
| POST | /register-invite | Регистрация по инвайту (public) |
| POST | /join | Присоединиться к компании |
| POST | / | Создать компанию |
| GET | / | Текущая компания |
| PUT | / | Переименовать |
| POST | /invites | Создать инвайт |
| GET | /members | Участники |

### Export `/api/export`
| Method | Path | Description |
|--------|------|-------------|
| GET | /dds | ДДС → CSV |
| GET | /dds-excel | ДДС → Excel |
| GET | /statements-excel | Выписки PDF → Excel |
| GET | /bank-tx-excel | Банк API транзакции → Excel |

### Admin `/api/admin` (owner only)
| Method | Path | Description |
|--------|------|-------------|
| GET | /stats | Статистика |
| GET | /users | Все пользователи |
| PUT | /users/:id/mode | Режим пользователя |
| PUT | /users/:id/disabled-banks | Отключённые банки |
| PUT | /users/:id/entity-access | Доступ к юр.лицам |
| GET | /companies | Все компании |
| GET | /companies/:id | Детали компании |
| POST | /companies/:id/entities | Создать юр.лицо |
| PUT | /companies/:id/mode | Режим компании |
| POST | /companies/:id/invites | Инвайт |
| CRUD | /expense-types, /articles | Категории/статьи расходов |
| CRUD | /income-types, /income-articles | Категории/статьи приходов |
| CRUD | /custom-fields | Кастомные поля |
| DELETE | /operations/:id | Удалить любую операцию |
| PUT | /accounts/:id/toggle | Вкл/выкл счёт |

### Notifications `/api/notifications`
| Method | Path | Description |
|--------|------|-------------|
| GET | / | Список уведомлений |
| GET | /count | Непрочитанные |
| PUT | /:id/read | Прочитать |
| POST | /subscribe | Подписка на push |
| POST | /broadcast | Рассылка (owner) |

---

## Frontend Architecture

### Pages (11)
| Page | Route | Description |
|------|-------|-------------|
| Login | /login | Вход |
| Register | /register | Регистрация (+invite) |
| Dashboard | / | Дашборд с графиками |
| DdsOperations | /dds | Таблица/карточки ДДС |
| Statements | /pdf | Загрузка выписок |
| StatementDetail | /pdf/:bankCode | Детали выписки |
| BankAccounts | /bank-accounts | Подключения к банкам |
| BankConnectionDetail | /bank-accounts/:id | Детали подключения |
| Settings | /settings | Настройки (8 табов) |
| Admin | /admin | Админ-панель (owner) |
| ShareTarget | /share-target | PWA Share Target для PDF |

### Stores (Zustand)
- **auth** — пользователь, токены, login/logout
- **theme** — тема (dark/light)
- **toast** — уведомления UI

### API Clients (16 модулей)
auth, company, entities, accounts, expenses, incomes, dds, pdf, employees, notifications, bankConnections, analytics, reconciliation, export, admin, customFields

### PDF Parsers (Python)
| Parser | Bank | Strategy |
|--------|------|----------|
| sber.py | Сбер | Hybrid: tables + text fallback |
| tbank.py | Т-Банк | Hybrid: headers + text fallback |
| tbank_deposit.py | Т-Банк Депозит | Table-based |
| ozon.py | Озон | Table + lines→text fallback |

### PWA
- manifest.json: standalone, icons 192/512
- sw.js: cache-first assets, network-first API, share target, push notifications

---

## Entity Access Control

```
Personal entity (companyId=null) → only owner
Company entity + role=owner → all entities
Company entity + role=member → ownerId match OR EntityAccess record
```

**Transfer exception**: при перемещении "Куда" показывает наличные ВСЕХ ИП компании (endpoint `/api/dds/company-cash`), не зависит от EntityAccess.

**Helpers**: `src/server/helpers/entityAccess.ts`
- `buildEntityFilter(userId)` — Prisma where для списков
- `checkEntityAccess(entityId, userId)` — проверка доступа к конкретному юр.лицу

Used in: entities, accounts, dds, analytics, pdf, export, reconciliation, bankConnections
