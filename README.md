# FinManager

Personal finance management web application. Replaces 4 Telegram bots (3 PDF bank statement parsers + 1 cash flow tracker) with a single unified platform.

## Features

- **Cash Flow (DDS)** — income/expense/transfer operations with templates for quick entry
- **PDF Statements** — upload bank statements (Sber, T-Bank), auto-parse transactions with duplicate detection
- **Dashboard** — balance timeline, expense charts (bar + pie), account widgets, recent operations
- **Settings** — entities (companies/sole proprietors), accounts, expense categories/articles, DDS templates
- **Employees** — invite employees with granular permissions (DDS, PDF upload, analytics, export) and entity-level access control
- **Notifications** — in-app notification system with unread badge
- **Export** — CSV export of DDS operations with filters
- **PWA** — installable as a mobile app, offline shell caching
- **i18n** — Russian and English interface
- **Themes** — dark and light with glassmorphism design

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Vite 6 |
| State | Zustand |
| Routing | react-router-dom 7 |
| Charts | Recharts |
| i18n | react-i18next |
| Icons | lucide-react |
| Backend | Express 4, TypeScript |
| Database | PostgreSQL 16, Prisma 6 ORM |
| Auth | JWT (access 15m + refresh 7d), bcryptjs |
| Validation | Zod |
| PDF Service | Python, FastAPI, pdfplumber |
| Testing | Vitest, Supertest |
| Container | Docker, docker-compose |

## Project Structure

```
src/
  server/           # Express API
    routes/         # auth, entities, accounts, expenses, dds, pdf, analytics,
                    # employees, notifications, export
    schemas/        # Zod validation schemas
    middleware/     # auth, validation, error handler
  client/           # React SPA
    pages/          # Dashboard, DdsOperations, Statements, Settings
    components/     # layout, settings tabs, dds wizard, pdf upload, ui kit
    api/            # API client modules
    stores/         # Zustand stores (auth, theme, toast)
    styles/         # CSS (theme, layout, ui, settings, dds, pdf, dashboard)
    i18n/           # ru.ts, en.ts translations
    public/         # PWA manifest, service worker, icons
  shared/           # Shared TypeScript types
pdf-service/        # Python FastAPI PDF parser microservice
prisma/             # Schema, migrations, seed
tests/
  unit/             # Unit tests
  integration/      # API integration tests
```

## Prerequisites

- Node.js 20+
- Docker & Docker Compose
- PostgreSQL 16 (via Docker)

## Setup

```bash
# Install dependencies
npm install

# Start PostgreSQL + PDF service
docker-compose up -d

# Copy env file and configure
cp .env.example .env

# Run migrations
npx prisma migrate dev

# Seed database
npm run db:seed

# Start dev servers (client + API)
npm run dev
```

App runs at `http://localhost:5173`, API at `http://localhost:3000`.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start client + server in dev mode |
| `npm test` | Run all tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run build:client` | Production build (Vite) |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |
| `npm run db:migrate` | Run Prisma migrations |
| `npm run db:seed` | Seed database |
| `npm run db:studio` | Open Prisma Studio |

## API Endpoints

### Auth
- `POST /api/auth/register` — create owner account
- `POST /api/auth/login` — sign in
- `POST /api/auth/refresh` — refresh JWT
- `GET /api/auth/me` — current user
- `PUT /api/auth/me` — update profile

### Entities & Accounts
- `CRUD /api/entities` — companies / sole proprietors
- `CRUD /api/entities/:id/accounts` — bank accounts
- `CRUD /api/entities/:id/expense-types` — expense categories + articles

### DDS Operations
- `GET/POST /api/dds/operations` — list / create operations
- `PUT/DELETE /api/dds/operations/:id` — update / delete
- `CRUD /api/dds/templates` — operation templates

### PDF Statements
- `POST /api/pdf/upload` — upload and parse PDF
- `POST /api/pdf/confirm` — save parsed transactions
- `GET /api/pdf/uploads` — upload history
- `GET /api/pdf/transactions` — bank transactions

### Analytics
- `GET /api/analytics/summary` — balance, income, expense totals
- `GET /api/analytics/by-category` — expenses grouped by category
- `GET /api/analytics/timeline` — balance over time
- `GET /api/analytics/account-balances` — per-account balances
- `GET /api/analytics/recent` — recent operations

### Employees & Permissions
- `POST /api/employees/invite` — invite employee
- `GET /api/employees` — list employees
- `PUT /api/employees/:id` — update permissions
- `DELETE /api/employees/:id` — remove employee

### Notifications
- `GET /api/notifications` — list (paginated)
- `GET /api/notifications/count` — unread count
- `PUT /api/notifications/:id/read` — mark read
- `PUT /api/notifications/read-all` — mark all read

### Export
- `GET /api/export/dds` — download CSV

## Testing

152 tests across 15 test files:

```bash
npm test
```

```
 Test Files  15 passed (15)
      Tests  152 passed (152)
```

## Database Schema

12 Prisma models: User, Permission, Entity, EntityAccess, Account, ExpenseType, ExpenseArticle, DdsOperation, DdsTemplate, PdfUpload, BankTransaction, Notification.

## License

Private project.
