# FinManager

Personal finance management web application.

## Stack

- **Frontend:** React 19 + TypeScript + Vite + Tailwind CSS
- **Backend:** Node.js + Express + TypeScript
- **Database:** PostgreSQL 16 + Prisma ORM
- **Auth:** JWT (email + password)

## Quick Start

### Prerequisites

- Node.js 20+
- Docker (for PostgreSQL)

### Setup

```bash
# Install dependencies
npm install

# Start PostgreSQL
docker compose up -d

# Copy env file and configure
cp .env.example .env

# Run database migrations
npm run db:migrate

# Seed database (optional)
npm run db:seed

# Start development servers
npm run dev
```

### URLs

- Frontend: http://localhost:5173
- Backend API: http://localhost:3000/api
- Prisma Studio: `npm run db:studio`

## Project Structure

```
src/
  client/     # React frontend (Vite)
  server/     # Express backend
  shared/     # Shared types and utilities
tests/
  unit/       # Unit tests
  integration/ # Integration tests
docs/         # Documentation
prisma/       # Database schema and migrations
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start both frontend and backend |
| `npm test` | Run tests |
| `npm run lint` | Run ESLint |
| `npm run db:migrate` | Run database migrations |
| `npm run db:studio` | Open Prisma Studio |
