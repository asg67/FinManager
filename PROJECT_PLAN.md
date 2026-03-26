# FinManager — Project Plan

> Updated: 2026-03-26

---

## Phase 1: Foundation (Auth + Layout + i18n) — DONE

- [x] Project setup: Node.js + TypeScript + Express + Prisma + Vite + React
- [x] Prisma schema & initial migrations (PostgreSQL)
- [x] Backend auth: register, login, refresh, JWT (access 15min, refresh 7d)
- [x] Frontend auth: Login/Register pages, auth store (Zustand), token handling
- [x] Layout shell: sidebar, header, responsive breakpoints
- [x] Theme system: dark/light mode, CSS variables
- [x] i18n: react-i18next (ru, en)
- [x] UI Kit: Button, Input, Select, Modal, Card, Table, DatePicker

## Phase 2: DDS (Cash Flow Operations) — DONE

- [x] Entity CRUD (personal + company entities)
- [x] Account CRUD (checking / card / cash / deposit)
- [x] Expense types & articles (company-wide, sortable)
- [x] Operation wizard (income / expense / transfer)
- [x] Templates (save & apply presets)
- [x] Operations table with filters, pagination, inline actions
- [x] Edit / delete operations

## Phase 3: PDF Statement Upload — DONE

- [x] Python microservice (FastAPI + pdfplumber, port 8080)
- [x] Sber parser (hybrid: tables + text fallback)
- [x] T-Bank parser (hybrid: headers + text fallback)
- [x] T-Bank Deposit parser (table-based)
- [x] Ozon parser (table + text fallback)
- [x] Upload flow: select bank → upload PDF → confirm transactions
- [x] Bank transaction view & editing

## Phase 4: Dashboard & Analytics — DONE

- [x] Analytics backend (summary, by-category, timeline, balances, recent)
- [x] Summary cards (income / expense / balance)
- [x] Charts (line, bar, pie — Recharts)
- [x] Account balances widget
- [x] Dashboard layout with responsive grid

## Phase 5: Employees, Notifications, Export — DONE

- [x] Company creation & invite system
- [x] Role-based permissions (owner / member)
- [x] Per-user permission toggles (dds, pdfUpload, analytics, export)
- [x] Notification system (in-app + Web Push via VAPID)
- [x] CSV export (DDS operations)
- [x] Excel export (DDS, PDF statements, bank API transactions — ExcelJS)

---

## Phase 6: Advanced Features (Roadmap v2) — DONE

All items from the v2 roadmap completed 2026-03-26:

- [x] **Per-user bank toggles**: Admin disables specific banks per user (disabledBanks in Permission model). Affects account visibility, PDF uploads, DDS forms.
- [x] **DDS customization**: Income types/articles (per-entity), custom fields (text/number/select) with conditional visibility (showWhen). Admin UI with collapsible sections, inline editing, badges.
- [x] **Entity-user binding**: Unified `checkEntityAccess` / `buildEntityFilter` helpers used across 8+ route files. Explicit EntityAccess records replacing fragile lastName fallback. Admin UI for toggling entity access per user. Backfill script run on prod.
- [x] **DDS ↔ Bank reconciliation**: Auto-match by amount + date range. Manual link/unlink. DdsOperation.linkedBankTxId (unique FK). Analytics exclude linked duplicates.
- [x] **DDS-only mode**: Company.mode (full / dds_only) + per-user override (User.mode). Conditional navigation hides bank/PDF features.
- [x] **Cross-entity transfers**: FROM any own enabled account → TO own accounts + cash of all other company ИП. Server endpoint `/api/dds/company-cash` bypasses EntityAccess.
- [x] **Per-user mode override**: Admin can set individual user mode independently of company mode.

---

## Phase 7: Bank API Expansion — PLANNED

### 7.1 Sber API Integration
**Priority**: High — most requested bank by users.

**Research complete** (see `sber_api_integration.json`):
- Official Sber API portal (developers.sber.ru), free since June 2024
- OAuth 2.0 Authorization Code Flow (recommended for MVP)
- Statement history: 5 years + current year
- Day-by-day pagination (one statementDate per request)

**Tasks**:
- [ ] Register app on developers.sber.ru, obtain client_id/secret
- [ ] Backend: OAuth flow (authorize → callback → token storage)
- [ ] Backend: Sber adapter implementing BankAdapter interface
- [ ] Handle token refresh (60-min lifetime, vs persistent for other banks)
- [ ] Handle day-by-day transaction fetching with pagination
- [ ] Frontend: Sber connection card with OAuth button
- [ ] Frontend: Sync UI, transaction view
- [ ] Test with real Sber account

### 7.2 Additional Banks (Future)
- [ ] Альфа-Банк (if API available)
- [ ] ВТБ (if API available)
- [ ] Райффайзен (if API available)

---

## Phase 8: Auto-sync & Scheduling — PLANNED

### 8.1 Automatic Bank Sync
- [ ] Cron job (node-cron or PM2 cron) for periodic transaction sync
- [ ] Configurable sync interval per connection (hourly / daily)
- [ ] Push notification on new transactions detected
- [ ] Error handling & retry logic for failed syncs
- [ ] Sync status dashboard in admin panel

### 8.2 Scheduled Reports
- [ ] Daily / weekly / monthly summary emails or push notifications
- [ ] Configurable per-user report preferences
- [ ] Auto-generated Excel reports attached to notifications

---

## Phase 9: UX Polish & Performance — PLANNED

### 9.1 Mobile Experience
- [ ] Swipe gestures on operation cards (edit / delete)
- [ ] Pull-to-refresh on main lists
- [ ] Haptic feedback on key actions (if supported)
- [ ] Offline mode: queue operations, sync when online

### 9.2 Performance
- [ ] Virtual scrolling for large operation lists
- [ ] Lazy loading for analytics charts
- [ ] API response caching (stale-while-revalidate)
- [ ] Image/avatar optimization (WebP, compression)

### 9.3 UX Improvements
- [ ] Onboarding wizard for new companies (guided setup)
- [ ] Keyboard shortcuts (desktop)
- [ ] Bulk operations (select multiple → delete / export)
- [ ] Search across all operations (full-text)
- [ ] Operation duplication (clone existing)
- [ ] Undo last action (soft delete with 10s timeout)

### 9.4 Testing & Monitoring
- [ ] Unit tests for critical business logic (access control, reconciliation)
- [ ] E2E tests for main flows (Playwright)
- [ ] Error tracking (Sentry or similar)
- [ ] Uptime monitoring & alerting
- [ ] PM2 log rotation & structured logging

---

## Summary

| Phase | Status | Items |
|-------|--------|-------|
| 1. Foundation | DONE | 8/8 |
| 2. DDS | DONE | 7/7 |
| 3. PDF Statements | DONE | 7/7 |
| 4. Analytics | DONE | 5/5 |
| 5. Employees & Export | DONE | 6/6 |
| 6. Advanced (v2) | DONE | 7/7 |
| 7. Bank Expansion | PLANNED | 0/8 |
| 8. Auto-sync | PLANNED | 0/6 |
| 9. UX Polish | PLANNED | 0/14 |

**Total**: 40/40 done, 28 planned
