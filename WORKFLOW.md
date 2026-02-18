# КАК РАБОТАЕТ WORKFLOW "НОВЫЙ ПРОЕКТ"

Пошаговое описание процесса создания проекта FinManager.

---

## ТРИГГЕРЫ (как запустить)

Скажи одну из фраз:
- "создай новый проект"
- "начать проект"
- "запускаем FinManager"

---

## ПОЛНЫЙ WORKFLOW (10 шагов)

---

## ШАГ 0: Инициализация

### Что происходит:

Claude задаёт 4 обязательных вопроса для настройки проекта.

### Диалог:

```
User: Начать проект

Claude:
Проект запущен!

Давай настроим:

1. Как назовём проект? (латиницей, без пробелов)
   Примеры: fin-manager, expense-tracker, budget-app

2. Какой тип проекта?
   - fullstack-web (фронт + бэк)
   - frontend-spa (только фронт)
   - backend-api (только API)
   - другое (опиши)

3. Основной стек?
   - Node.js + TypeScript + React
   - Node.js + TypeScript + Next.js
   - Node.js + TypeScript + Vue
   - другое (опиши)

4. База данных?
   - PostgreSQL
   - MongoDB
   - SQLite (для простых проектов)
   - решим потом
```

### Ответ пользователя:

```
User:
1. fin-manager
2. fullstack-web
3. Node.js + TypeScript + React
4. PostgreSQL
```

### Claude выполняет:

```
Claude:
Создаю структуру проекта локально в D:\FinManager...

[Инициализирует Git: git init]
[Создаёт структуру папок]
[Создаёт .gitignore, README.md, package.json]
[Устанавливает базовые зависимости]

Структура создана:
fin-manager/
├── src/
│   ├── client/          # React frontend
│   ├── server/          # Express/Node backend
│   └── shared/          # Общие типы и утилиты
├── tests/
│   ├── unit/
│   └── integration/
├── docs/
├── .project-meta/
│   └── structure.lock
├── .gitignore
├── .env.example
├── tsconfig.json
├── package.json
└── README.md

Git инициализирован.

Переходим к Step 1...
```

---

## ШАГ 1: Контекст

### Что происходит:

Claude собирает информацию о проекте через беседу.

### Диалог:

```
Claude:
Step 1: Сбор контекста

Расскажи о проекте FinManager:

- Что должно делать приложение?
- Кто будет пользователями?
- Какие основные функции нужны?
- Есть ли особые требования?
- Что определяет успех проекта?

Отвечай свободно, я задам уточняющие вопросы.
```

### Ответ пользователя:

```
User:
Веб-приложение для управления личными финансами.
Основные функции:
- Учёт доходов и расходов
- Категории трат
- Бюджеты на месяц
- Графики и аналитика
- Экспорт отчётов

Успех = удобнее чем Excel для ведения бюджета.
```

### Claude уточняет:

```
Claude:
Понял! Уточню детали:

1. Учёт операций:
   - Ручной ввод или импорт из банка?
   - Какие валюты поддерживать?

2. Категории:
   - Предустановленные или пользовательские?
   - Вложенные категории нужны?

3. Бюджеты:
   - Месячные или произвольные периоды?
   - Уведомления при превышении?

4. Аналитика:
   - Какие графики? (pie chart, bar chart, timeline)
   - Сравнение месяцев?

5. Экспорт:
   - Какие форматы? (CSV, PDF, Excel?)
```

### После обсуждения:

```
Claude:
Контекст собран!

Сохраняю в:
- .project-meta/00-context.md

Переходим к Step 2...
```

---

## ШАГ 2-3: Brainstorming

### Что происходит:

Claude проводит brainstorming для проработки концепции.

### Диалог:

```
Claude:
Step 2-3: Brainstorming

Давай проработаем концепцию глубже.

Вопросы для размышления:

1. Мотивация:
   - Почему пользователи выберут FinManager, а не YNAB/CoinKeeper?
   - Что сделает приложение "залипательным"?

2. Уникальность:
   - Чем отличается от существующих решений?
   - Какую конкретную боль решаем лучше всех?

3. Монетизация (если планируется):
   - Бесплатное / freemium / платное?
   - Подписка или разовый платёж?

4. Масштабирование:
   - Один пользователь или семейный аккаунт?
   - Мобильная версия в будущем?
```

### После проработки:

```
Claude:
Brainstorming завершён!

Ключевые решения:
- Фокус на простоте (минимум кликов для ввода)
- Автокатегоризация через паттерны
- Dashboard с ключевыми метриками
- PWA для мобильного доступа

Переходим к Step 4...
```

---

## ШАГ 4: User Spec (SMART)

### Что происходит:

Claude создаёт SMART спецификацию.

### Диалог:

```
Claude:
Step 4: User Spec (SMART формат)

Создаю понятийное ТЗ...

---

# User Spec: FinManager

## Specific (Конкретно)
Веб-приложение для управления личными финансами.
Функции:
- Ввод доходов и расходов (ручной, с автокатегоризацией)
- Категории трат (предустановленные + пользовательские)
- Бюджеты на месяц по категориям
- Dashboard с графиками (pie, bar, timeline)
- Экспорт отчётов (CSV, PDF)

## Measurable (Измеримо)
Критерии успеха:
- Ввод операции занимает < 10 секунд
- Dashboard загружается < 2 секунд
- Автокатегоризация угадывает > 80% категорий

## Achievable (Достижимо)
Ресурсы:
- Разработка: ты + Claude
- MVP: базовый CRUD + dashboard
- Стек: Node.js + TypeScript + React + PostgreSQL

## Relevant (Релевантно)
Решает проблему:
- Excel неудобен для учёта финансов
- Хочется видеть картину трат наглядно
- Нужна автоматизация рутины

## Time-bound (Сроки)
- Фаза 1: MVP (CRUD операций + категории)
- Фаза 2: Бюджеты + Dashboard
- Фаза 3: Экспорт + Polish
- Фаза 4: Тестирование, багфиксы

---

Сохраняю в:
- .project-meta/01-user-spec.md

Всё верно? Корректировки нужны?
```

---

## ШАГ 5: Tech Spec

### Что происходит:

Claude создаёт техническую спецификацию.

### Диалог:

```
Claude:
Step 5: Technical Specification

Проектирую архитектуру...

---

# Tech Spec: FinManager

## Technology Stack

**Frontend:**
- React 18 + TypeScript
- Vite (сборка)
- TanStack Query (серверное состояние)
- Zustand (клиентское состояние)
- Tailwind CSS (стили)
- Recharts (графики)

**Backend:**
- Node.js + TypeScript
- Express.js (HTTP сервер)
- Prisma ORM (работа с БД)
- Zod (валидация)

**Database:**
- PostgreSQL 16

**Tooling:**
- ESLint + Prettier (линтинг)
- Vitest (тесты)
- Docker Compose (локальная БД)

---

## Database Schema (Prisma)

model User {
  id        String   @id @default(uuid())
  email     String   @unique
  name      String
  accounts  Account[]
  createdAt DateTime @default(now())
}

model Account {
  id           String        @id @default(uuid())
  name         String
  userId       String
  user         User          @relation(fields: [userId])
  transactions Transaction[]
}

model Category {
  id           String        @id @default(uuid())
  name         String
  icon         String?
  color        String?
  parentId     String?
  parent       Category?     @relation("SubCategories", fields: [parentId])
  children     Category[]    @relation("SubCategories")
  transactions Transaction[]
}

model Transaction {
  id         String   @id @default(uuid())
  amount     Decimal
  type       TransactionType  // INCOME | EXPENSE
  note       String?
  date       DateTime
  categoryId String
  category   Category @relation(fields: [categoryId])
  accountId  String
  account    Account  @relation(fields: [accountId])
  createdAt  DateTime @default(now())
}

model Budget {
  id         String   @id @default(uuid())
  categoryId String
  amount     Decimal
  month      Int
  year       Int
  userId     String
}

---

## API Endpoints

POST   /api/auth/register
POST   /api/auth/login

GET    /api/transactions
POST   /api/transactions
PUT    /api/transactions/:id
DELETE /api/transactions/:id

GET    /api/categories
POST   /api/categories

GET    /api/budgets
POST   /api/budgets
PUT    /api/budgets/:id

GET    /api/analytics/summary
GET    /api/analytics/by-category
GET    /api/analytics/timeline

GET    /api/export/csv
GET    /api/export/pdf

---

## Architecture

Browser (React SPA)
    |
    v
Express API (Node.js)
    |
    v
Prisma ORM
    |
    v
PostgreSQL

---

## Security Measures

- Input validation через Zod (защита от injection)
- Rate limiting (express-rate-limit)
- Переменные окружения в .env (не в коде)
- Аутентификация через JWT
- CORS настроен только на разрешённые origins
- Helmet.js для HTTP security headers

---

## Testing Strategy

- Unit tests: Vitest
- Integration tests: Supertest (API endpoints)
- E2E tests: Playwright (при необходимости)
- Coverage target: > 80%

---

Сохраняю в:
- .project-meta/02-tech-spec.md

Всё ок? Вопросы по архитектуре?
```

---

## ШАГ 6: Декомпозиция

### Что происходит:

Claude разбивает проект на атомарные задачи.

### Диалог:

```
Claude:
Step 6: Декомпозиция на задачи

Разбиваю проект на задачи...

---

# Tasks: FinManager

## PHASE 1: Инфраструктура и Setup

### Task 1.1: Project Setup
- Инициализировать monorepo (client + server)
- Настроить TypeScript, ESLint, Prettier
- Создать docker-compose.yml для PostgreSQL

### Task 1.2: Database Setup
- Настроить Prisma + PostgreSQL
- Создать схему (models)
- Запустить миграции
- Seed с тестовыми данными

### Task 1.3: Auth Module
- Регистрация / логин
- JWT токены
- Middleware аутентификации

---

## PHASE 2: Core CRUD

### Task 2.1: Categories API + UI
### Task 2.2: Transactions API
### Task 2.3: Transactions UI (список + форма ввода)
### Task 2.4: Accounts API + UI

---

## PHASE 3: Бюджеты и аналитика

### Task 3.1: Budgets API + UI
### Task 3.2: Dashboard (summary карточки)
### Task 3.3: Charts (pie chart по категориям, timeline)
### Task 3.4: Budget vs Actual сравнение

---

## PHASE 4: Экспорт, Polish, Тесты

### Task 4.1: CSV Export
### Task 4.2: PDF Export
### Task 4.3: UI Polish (responsive, темы)
### Task 4.4: Финальное тестирование

---

Сохраняю в:
- .project-meta/03-tasks.md

Начинаем выполнение?
```

---

## ШАГ 7: Execution (TDD Step-by-Step)

### Что происходит:

Claude выполняет задачи по одной, используя TDD подход.

### Для КАЖДОЙ задачи выполняется 6 шагов:

```
1. RED:      Написать тесты (они падают)
2. GREEN:    Написать код (тесты проходят)
3. REFACTOR: Улучшить код (тесты всё ещё проходят)
4. DOC:      Документировать задачу
5. TEST:     Запустить тестовый цикл для этого уровня
6. GIT:      Commit + Push
```

### Диалог (Task 1.1 пример):

```
Claude:
Начинаю Task 1.1: Project Setup

---

### 1. RED - Пишу тесты

// tests/unit/config.test.ts
import { describe, it, expect } from 'vitest'

describe('Config', () => {
  it('should load environment variables', () => {
    expect(process.env.DATABASE_URL).toBeDefined()
    expect(process.env.JWT_SECRET).toBeDefined()
  })
})

Тесты написаны. Запускаю...
npx vitest run tests/unit/config.test.ts

FAILED - конфига ещё нет (RED фаза - это правильно!)

---

### 2. GREEN - Пишу код

Создаю:
- src/server/config.ts
- src/server/index.ts
- .env.example
- package.json (monorepo setup)
- tsconfig.json

Запускаю тесты...
npx vitest run tests/unit/config.test.ts

PASSED - тесты зелёные!

---

### 3. REFACTOR - Улучшаю код

Рекомендации:
- Добавить валидацию env через Zod
- Разделить конфиги dev/prod

Применяю...
Тесты всё ещё зелёные.

---

### 4. DOC - Документирую

docs/tasks/task-1.1-project-setup.md

---

### 5. TEST - Тестовый цикл

Уровень: Task

- Unit tests: PASS
- TypeScript compile: PASS
- Lint: PASS

Task 1.1 готова!

---

### 6. GIT - Коммичу

git add .
git commit -m "feat(setup): initialize project structure

- Add monorepo setup (client + server)
- Configure TypeScript, ESLint, Prettier
- Add docker-compose for PostgreSQL
- Create .env.example

Tests: All passing
Task: 1.1 Project Setup"

Закоммичено!

---

Task 1.1 ЗАВЕРШЕНА!

Переходим к Task 1.2: Database Setup?
```

### После каждой фазы:

```
Claude:
Feature: Core CRUD завершена!

Тестовый цикл FEATURE-уровня:

- Unit tests: PASS
- Integration tests: PASS
- TypeScript: PASS
- Lint: PASS
- Security scan: PASS

Генерирую ТЕСТ-ПЛАН для ручной проверки...

# Test Plan: Core CRUD

## Scenario 1: Добавление расхода
1. Открой http://localhost:5173
2. Нажми "Добавить операцию"
3. Введи сумму 500, категорию "Еда"
Ожидаемо: Операция появилась в списке

## Scenario 2: Редактирование операции
...

---

Пожалуйста, протестируй эти сценарии вручную.
Напиши "всё ок" или опиши проблемы.
```

---

## ШАГ 8: Deployment

### Что происходит:

Claude настраивает деплой (когда будет готово).

### Диалог:

```
Claude:
Step 8: Подготовка к деплою

Так как пока работаем локально, подготавливаю:

1. Dockerfile для backend...
   - Multi-stage build (build + production)
   - Node.js Alpine image

2. Dockerfile для frontend...
   - Build stage с Vite
   - Nginx для раздачи статики

3. docker-compose.production.yml...
   - Backend + Frontend + PostgreSQL
   - Volumes для данных
   - Environment variables

4. CI/CD pipeline (GitHub Actions)...
   - Build + Test на каждый PR
   - Deploy на push в main (когда настроим сервер)

5. Инструкция по деплою...
   - Шаги для разных платформ (VPS, Railway, Render)

Всё готово к деплою на любую платформу!
```

---

## ШАГ 9: Monitoring

### Что происходит:

Claude настраивает базовый мониторинг.

### Диалог:

```
Claude:
Step 9: Настройка мониторинга

1. Health check endpoint...
   GET /api/health -> { status: "ok", db: "connected", uptime: "..." }

2. Structured logging (pino)...
   - JSON формат
   - Уровни: error, warn, info, debug
   - Request ID tracking

3. Error tracking...
   - Global error handler в Express
   - Логирование необработанных ошибок
   - Graceful shutdown

4. Performance monitoring...
   - Response time middleware
   - Slow query logging (Prisma)

Мониторинг настроен!
```

---

## ШАГ 10: Documentation & Summary

### Что происходит:

Claude создаёт финальную документацию и подводит итоги.

### Диалог:

```
Claude:
Step 10: Финальная документация

1. README.md...
   - Описание проекта
   - Установка и запуск
   - Структура проекта
   - API документация

2. CONTRIBUTING.md...
   - Code style guide
   - Как добавлять фичи
   - Процесс PR

3. CHANGELOG.md...
   - История версий

4. API Documentation...
   - OpenAPI/Swagger spec
   - Примеры запросов

---

ПРОЕКТ FINMANAGER ЗАВЕРШЁН!

## Статистика:

Общее:
- Задачи выполнено: N/N
- Тесты написано: N
- Тесты проходят: N/N (100%)
- Строк кода: N

Качество:
- Test coverage: >80%
- TypeScript strict: No errors
- Lint: No warnings

Локальный запуск:
- Frontend: http://localhost:5173
- Backend API: http://localhost:3000
- PostgreSQL: localhost:5432

---

## Следующие шаги:

1. Протестировать приложение вручную
2. Выбрать платформу для деплоя
3. Настроить CI/CD
4. Собрать feedback от первых пользователей
```

---

## ИТОГО: КАК ЭТО РАБОТАЕТ

### Запускаешь фразой:

```
Начать проект / Создать новый проект
```

### Claude проводит через 10 шагов:

1. **Init** - Настройка проекта (4 вопроса)
2. **Context** - Сбор требований (беседа)
3. **Brainstorming** - Проработка концепции
4. **SMART Spec** - Понятийное ТЗ
5. **Tech Spec** - Техническая спека
6. **Tasks** - Декомпозиция на задачи
7. **Execution** - TDD выполнение (по задаче за раз)
8. **Deployment** - Подготовка деплоя (Docker + CI/CD)
9. **Monitoring** - Health checks, логирование
10. **Docs & Summary** - Документация и итоги

### В результате получаешь:

- Рабочий проект с полной структурой
- Тесты на каждую фичу (TDD)
- Полная документация
- Docker-конфиги для деплоя
- Мониторинг и логирование
- Git history с чистыми коммитами

### Автоматически на каждом шаге:

- Git commits после каждой задачи
- Документация после каждой задачи
- Тесты на каждом уровне (task -> feature -> phase)
- Ручные тест-планы после завершения фичи
- Сохранение контекста в .project-meta/

---

## ОСОБЫЕ ВОЗМОЖНОСТИ

### Параллельная разработка

Если задачи независимые:

```
User: Сделай Task 2.1, 2.3 и 2.4 параллельно

Claude:
Анализирую зависимости...

Task 2.1: Categories API + UI
Task 2.3: Transactions UI
Task 2.4: Accounts API + UI

Конфликтов нет, делаю параллельно!
[Запускает субагенты]

Все задачи готовы!
```

### Structure Lock

Защита от беспорядка в проекте:

```
User: Создай папку src/old/

Claude:
ЗАБЛОКИРОВАНО structure.lock

Паттерн "*/old/*" запрещён.
Никаких old/, backup/, temp/ папок!
Удали устаревший код через git или оставь если нужен.
```

### Контекст между сессиями

Всё сохраняется в `.project-meta/`:

```
.project-meta/
├── structure.lock      # Защита структуры
├── 00-context.md       # Контекст проекта
├── 01-user-spec.md     # SMART спецификация
├── 02-tech-spec.md     # Техническая спека
├── 03-tasks.md         # Декомпозиция задач
└── progress.md         # Прогресс выполнения
```

При новой сессии Claude читает `.project-meta/` и продолжает с того места, где остановились.
