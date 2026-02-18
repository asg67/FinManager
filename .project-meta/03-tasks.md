# Tasks: FinManager — Декомпозиция

---

## PHASE 1: Фундамент (Auth + Settings + Layout + i18n)

### Task 1.1: Project Setup — Dev Tooling
- Настроить ESLint 9 + Prettier (единый конфиг)
- Настроить Vitest (unit + integration)
- Обновить docker-compose: PostgreSQL + pdf-service (заглушка)
- Настроить .env с валидацией (Zod)
- Проверить что `npm run dev` запускает клиент и сервер

### Task 1.2: Prisma Schema + Migrations
- Перенести полную Prisma-схему из tech spec (12 моделей)
- Запустить `prisma migrate dev`
- Создать seed.ts: тестовый владелец + 1 ИП + 3 счёта + категории/статьи из бота
- Проверить `prisma studio`

### Task 1.3: Auth — Backend
- POST /api/auth/register (bcrypt, создание User + default Permission)
- POST /api/auth/login (JWT access 15min + refresh 7d)
- POST /api/auth/refresh
- GET /api/auth/me
- PUT /api/auth/me (name, language, theme)
- Middleware: authMiddleware (JWT verify)
- Zod-схемы валидации
- Тесты: unit + integration

### Task 1.4: Auth — Frontend
- Страницы: Login, Register
- AuthContext / useAuth hook
- Хранение токенов (localStorage access + httpOnly refresh)
- Перенаправление неавторизованных на /login
- Форма логина, форма регистрации
- API-клиент с interceptor (auto-refresh)

### Task 1.5: Layout — Shell
- Sidebar (вертикальная навигация с иконками):
  - Dashboard, ДДС, Выписки, Аналитика, Настройки
  - Collapse/expand на десктопе
  - Bottom tab bar на мобилке (< 768px)
- Header:
  - Название текущей страницы
  - Поиск (заглушка)
  - Колокольчик уведомлений (заглушка, счётчик)
  - Theme toggle (dark/light)
  - Language toggle (ru/en)
  - Аватар + dropdown (профиль, выход)
- Responsive breakpoints: mobile (< 768), tablet (768-1024), desktop (> 1024)

### Task 1.6: Theme System (Dark / Light)
- Tailwind dark mode (class strategy)
- CSS-переменные для glassmorphism:
  - card background (полупрозрачный)
  - backdrop-blur
  - border (subtle)
  - shadow
- Zustand store: theme (persisted в localStorage + User.theme)
- Плавный transition при переключении
- Accent color: teal (--accent: #14b8a6)

### Task 1.7: i18n Setup
- react-i18next конфигурация
- Файлы переводов: src/client/i18n/ru.json, en.json
- Namespace-ы: common, auth, dds, pdf, settings, dashboard, notifications
- Zustand store: language (persisted + User.language)
- Все строки интерфейса через t()
- Начать с auth + layout + common

### Task 1.8: UI Kit — Base Components
- Button (variants: primary, secondary, ghost, danger; sizes: sm, md, lg)
- Input (text, password, number)
- Select (single, with search)
- Modal (overlay + glassmorphism card, close on escape/overlay)
- Card (glassmorphism: blur, border, shadow)
- Badge (count, dot)
- Table (sortable headers, pagination)
- Tabs (horizontal tab bar)
- Toggle (switch для boolean)
- Dropdown (menu)
- Toast / notification popup
- Skeleton (loading state)
- EmptyState (иллюстрация + текст)

---

## PHASE 2: ДДС (Движение денежных средств)

### Task 2.1: Settings — Entities CRUD (ИП)
- Backend: GET/POST/PUT/DELETE /api/entities
- Frontend: Страница "Настройки" → таб "ИП"
- Таблица ИП с кнопками Edit/Delete
- Модалка создания/редактирования ИП
- Тесты API

### Task 2.2: Settings — Accounts CRUD (Счета/Карты)
- Backend: CRUD /api/entities/:entityId/accounts
- Frontend: Настройки → таб "Счета и карты"
- Привязка к ИП (select)
- Тип: расчётный счёт / карта / наличные / депозит
- Банк: select (Сбер, Т-Банк, Модуль, другой)
- Номер счёта / договора (опционально)
- Тесты API

### Task 2.3: Settings — Expense Types + Articles CRUD
- Backend: CRUD expense-types, CRUD expense-articles
- Frontend: Настройки → таб "Категории и статьи"
- Двухуровневый список: тип → статьи (accordion или tree)
- Drag & drop сортировка (sortOrder)
- При первом входе: seed стандартных категорий из бота
- Тесты API

### Task 2.4: DDS — Operation Wizard (Modal)
- Модальное окно, 3 режима: Приход / Расход / Перемещение
- Step 1: Выбор ИП
- Step 2: Выбор типа операции (tabs: Приход / Расход / Перемещение)
- Step 3 (зависит от типа):
  - Приход: счёт "куда" → сумма → комментарий
  - Расход: счёт "откуда" → тип затрат → статья/номер заказа → сумма → комментарий
  - Перемещение: "откуда" → "куда" → сумма → комментарий
- Правила перемещений (наличные между ИП, карты только внутри)
- Step 4: Превью (сводка как в боте)
- Кнопки: Подтвердить / Изменить / Отмена
- Backend: POST /api/dds/operations
- react-hook-form + Zod валидация
- Тесты

### Task 2.5: DDS — Templates CRUD
- Backend: CRUD /api/dds/templates
- Frontend: Настройки → таб "Шаблоны ДДС"
- Создание шаблона: выбрать ИП, тип, счёт, тип затрат, статью — сохранить с названием
- В wizard: кнопка "Из шаблона" → выбрал → предзаполненная форма
- Тесты API

### Task 2.6: DDS — Operations Table (List)
- Backend: GET /api/dds/operations с фильтрами + пагинацией
- Frontend: Страница "ДДС"
- Таблица операций:
  - Колонки: Дата, ИП, Тип, Откуда, Куда, Тип затрат, Статья, Сумма, Комментарий
  - Цвет: зелёный (приход), красный (расход), синий (перемещение)
- Фильтры: ИП, счёт, тип операции, период, поиск текстом
- Пагинация
- Кнопки: редактировать, удалить (с подтверждением)
- Floating action button "+" → открывает wizard
- Тесты

### Task 2.7: DDS — Edit / Delete Operations
- Backend: PUT/DELETE /api/dds/operations/:id
- Frontend: Открыть wizard с предзаполненными данными
- Delete с модалкой подтверждения
- Тесты

---

## PHASE 3: PDF-загрузка выписок

### Task 3.1: Python PDF Service — Sber Parser
- FastAPI app (main.py)
- POST /parse endpoint (принимает file + bank_code)
- Портировать парсер Сбера из ZF_PM_*_PDF.py
- Pydantic response model (список транзакций)
- Dockerfile для сервиса
- docker-compose интеграция
- Тесты (pytest) на реальных PDF

### Task 3.2: Python PDF Service — TBank + TBank Deposit Parsers
- Портировать парсер Т-Банк (карта) из бота
- Портировать парсер Т-Банк (депозит) из бота
- Общие утилиты (normalize, parse_amount, etc.)
- Тесты (pytest)

### Task 3.3: PDF Upload — Backend (Node.js)
- POST /api/pdf/upload: multer (max 10MB, .pdf only)
- Отправка файла на Python-сервис (HTTP multipart)
- Получение JSON с транзакциями
- Сохранение PdfUpload (status: pending)
- Возврат preview клиенту
- POST /api/pdf/confirm: дедупликация + запись BankTransaction
- GET /api/pdf/uploads: история загрузок
- Тесты

### Task 3.4: PDF Upload — Frontend
- Страница "Выписки"
- Step 1: Выбрать ИП → Выбрать счёт/карту (фильтр по банку)
- Step 2: Drag & drop zone (react-dropzone) или кнопка
- Step 3: Loading state (пока Python парсит)
- Step 4: Превью-таблица:
  - Колонки: Дата, Время, Сумма, Приход/Расход, Контрагент, Назначение, Остаток
  - Подсветка дубликатов (жёлтый)
  - Чекбоксы для выбора строк
  - Кнопка "Удалить выбранные" (если мусор)
- Step 5: "Подтвердить и сохранить" → POST /api/pdf/confirm
- Success state: "Сохранено N записей, пропущено M дубликатов"

### Task 3.5: Bank Transactions — Table View
- Backend: GET /api/bank-transactions с фильтрами
- Frontend: Таблица распарсенных транзакций (отдельный таб на странице "Выписки")
- Фильтры: счёт, период, направление (приход/расход)
- Пагинация
- Удаление записей

---

## PHASE 4: Dashboard и аналитика

### Task 4.1: Analytics — Backend
- GET /api/analytics/summary: общий баланс, приход/расход за период, кол-во операций
- GET /api/analytics/by-category: расходы сгруппированные по типам затрат
- GET /api/analytics/timeline: данные для line chart (остатки по дням)
- GET /api/analytics/account-balances: остаток по каждому счёту
- Prisma aggregations (sum, groupBy)
- Тесты

### Task 4.2: Dashboard — Summary Cards
- 4 карточки сверху (glassmorphism):
  - Общий баланс (сумма остатков всех счетов)
  - Приход за месяц (зелёный)
  - Расход за месяц (красный)
  - Количество операций
- Фильтр периода: текущий месяц / прошлый / произвольный
- Skeleton loading

### Task 4.3: Dashboard — Charts
- Line chart: таймлайн баланса (Recharts)
  - Фильтр: 7D / 30D / 90D / 1Y
  - Tooltip с точным значением
- Bar chart: расходы по категориям за текущий месяц
- Pie chart: распределение расходов (% по категориям)
- Responsive: на мобилке графики в 1 колонку

### Task 4.4: Dashboard — Account Widgets + Recent Operations
- Виджеты счетов/карт:
  - Визуальная карточка (как банковская карта из референса)
  - Название, банк, остаток, последнее обновление
  - Горизонтальный скролл на мобилке
- Список последних 10 операций (ДДС + банковские)
  - Иконка типа, сумма, контрагент/комментарий, дата
  - Клик → переход к деталям

---

## PHASE 5: Сотрудники, уведомления, экспорт

### Task 5.1: Employees — Backend
- POST /api/employees/invite (создаёт User с role=employee + Permission + EntityAccess)
- GET /api/employees (список сотрудников владельца)
- PUT /api/employees/:id (обновить права, привязку к ИП)
- DELETE /api/employees/:id
- Middleware: permissionsMiddleware (проверка прав на действие)
- Тесты

### Task 5.2: Employees — Frontend
- Страница "Настройки" → таб "Сотрудники"
- Таблица сотрудников: имя, email, ИП, права, действия
- Модалка "Пригласить сотрудника": email, выбор ИП (multi-select), чекбоксы прав
- Редактирование прав (inline или модалка)
- Удаление с подтверждением

### Task 5.3: Permissions Middleware Integration
- На каждом защищённом route проверять:
  - Авторизован ли пользователь
  - Имеет ли доступ к запрашиваемому entity (EntityAccess)
  - Имеет ли нужное permission (dds / pdfUpload / analytics / export)
- Сотрудник видит только "свои" ИП и операции
- Тесты

### Task 5.4: Notifications — Backend
- CRUD notifications
- node-cron: генерация напоминаний 2/12/22 числа
- Триггеры: сотрудник создал операцию → уведомление владельцу
- GET /api/notifications/count (для бейджа)
- PUT /api/notifications/read-all
- Тесты

### Task 5.5: Notifications — Frontend
- Колокольчик в Header с бейджем (число непрочитанных)
- Dropdown: последние 5 уведомлений + "Показать все"
- Страница "Уведомления": полный список, mark as read
- Polling каждые 60 секунд (или WebSocket в будущем)

### Task 5.6: Export CSV
- Backend: GET /api/export/csv с фильтрами (период, ИП, счёт, источник)
- Генерация CSV на лету (stream)
- Frontend: кнопка "Экспорт" на страницах ДДС и Выписки
- Модалка с фильтрами экспорта → скачивание файла

---

## PHASE 6: Polish

### Task 6.1: Mobile Adaptive — Final Pass
- Проверить все страницы на 320px / 375px / 768px / 1024px / 1440px
- Sidebar → bottom tabs (мобилка)
- Таблицы → card list (мобилка)
- Модалки → fullscreen (мобилка)
- Touch-friendly: min 44px tap targets

### Task 6.2: Animations & Micro-interactions
- Page transitions (fade)
- Modal open/close (scale + fade)
- Sidebar collapse (slide)
- Card hover effects (subtle lift)
- Skeleton → content (fade in)
- Toast notifications (slide in from top-right)
- Number counters (animate on dashboard)

### Task 6.3: Performance Optimization
- Code splitting (React.lazy для страниц)
- TanStack Query: staleTime, cacheTime для аналитики
- Виртуализация длинных списков (если нужно)
- Image optimization (если будут)
- Bundle size analysis (vite-plugin-visualizer)

### Task 6.4: Final Testing & Bug Fixes
- Прогон всех тестов (unit + integration)
- Ручное тестирование по тест-плану (каждый модуль)
- Cross-browser: Chrome, Firefox, Safari, Edge
- Mobile: iOS Safari, Android Chrome
- Fix найденных багов
- Security review: OWASP checklist

---

## ИТОГО

| Фаза | Задачи | Описание |
|------|--------|----------|
| Phase 1 | 8 | Фундамент: tooling, DB, auth, layout, theme, i18n, UI kit |
| Phase 2 | 7 | ДДС: настройки, wizard, шаблоны, таблица операций |
| Phase 3 | 5 | PDF: Python-парсеры, upload, preview, банковские транзакции |
| Phase 4 | 4 | Dashboard: analytics API, cards, charts, виджеты |
| Phase 5 | 6 | Сотрудники, права, уведомления, экспорт |
| Phase 6 | 4 | Polish: адаптив, анимации, перформанс, тестирование |
| **Всего** | **34** | |
