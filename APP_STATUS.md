# FinManager — Application Status

> Updated: 2026-03-26

---

## Feature Checklist

### Auth & Users
| Feature | Status | Notes |
|---------|--------|-------|
| Registration (email + password) | DONE | Auto-creates personal entity "ИП {lastName}" |
| Login (JWT access 15min + refresh 7d) | DONE | |
| Profile editing (name, avatar, password) | DONE | |
| Invite links (owner creates, member joins) | DONE | Auto-creates entity in company |
| Roles (owner / member) | DONE | |
| Permissions (per-user module toggles) | DONE | dds, pdfUpload, analytics, export |
| Per-user bank toggles (disabledBanks) | DONE | Admin UI, filters in forms & uploads |
| Per-user mode override (full / dds_only) | DONE | |

### Entities & Accounts
| Feature | Status | Notes |
|---------|--------|-------|
| Entity CRUD | DONE | Personal + company entities |
| EntityAccess (explicit user-entity binding) | DONE | Replaces lastName fallback |
| Unified access helpers (buildEntityFilter, checkEntityAccess) | DONE | Used in 8+ route files |
| Account CRUD (checking / card / cash / deposit) | DONE | |
| Account auto-seed (standard banks) | DONE | tbank, module, tochka, sber, ozon |
| Account enable/disable (admin toggle) | DONE | Disabled accounts hidden from DDS forms |
| Initial balances (amount + date) | DONE | Members can edit own, owner can edit all |

### DDS (Cash Flow)
| Feature | Status | Notes |
|---------|--------|-------|
| Operation CRUD (income / expense / transfer) | DONE | |
| QuickAddForm (inline, mobile-friendly) | DONE | |
| OperationWizard (modal, full form) | DONE | Create + Edit modes |
| Templates (save & apply presets) | DONE | |
| Expense types & articles (company-wide) | DONE | Sortable, admin CRUD |
| Income types & articles (per-entity) | DONE | |
| Custom fields (text / number / select) | DONE | Conditional visibility (showWhen) |
| Cross-entity transfers | DONE | FROM own accounts, TO own + cash of other ИП |
| DDS-only mode (Company.mode) | DONE | Hides bank/PDF features |
| Operations table with filters & pagination | DONE | |

### Bank Integrations (API)
| Feature | Status | Notes |
|---------|--------|-------|
| Т-Банк adapter | DONE | Bearer token |
| Модульбанк adapter | DONE | Bearer token |
| Точка adapter | DONE | Bearer token |
| Сбер adapter | PLANNED | OAuth 2.0 flow, see sber_api_integration.json |
| Connection test | DONE | |
| Account fetch | DONE | |
| Transaction sync | DONE | |
| Auto-sync (cron) | NOT DONE | Manual sync only |

### PDF Statements
| Feature | Status | Notes |
|---------|--------|-------|
| Sber parser (hybrid: tables + text) | DONE | Personal + business formats |
| T-Bank parser (hybrid: headers + text) | DONE | |
| T-Bank Deposit parser (table-based) | DONE | |
| Ozon parser (table + text fallback) | DONE | |
| Upload & confirm flow | DONE | |
| Transaction editing | DONE | |
| Bulk delete | DONE | |

### Analytics & Dashboard
| Feature | Status | Notes |
|---------|--------|-------|
| Summary (income / expense / balance) | DONE | |
| By-category breakdown | DONE | |
| Timeline charts (Recharts) | DONE | |
| Account balances widget | DONE | |
| Recent operations | DONE | |

### Reconciliation
| Feature | Status | Notes |
|---------|--------|-------|
| Auto-match (DDS ↔ BankTransaction) | DONE | By amount + date range |
| Manual link / unlink | DONE | |
| Status overview | DONE | |
| Analytics exclude linked duplicates | DONE | |

### Export
| Feature | Status | Notes |
|---------|--------|-------|
| DDS → CSV | DONE | |
| DDS → Excel | DONE | ExcelJS |
| PDF statements → Excel | DONE | |
| Bank API transactions → Excel | DONE | |

### Notifications
| Feature | Status | Notes |
|---------|--------|-------|
| In-app notifications | DONE | |
| Unread count | DONE | |
| Web Push (VAPID) | DONE | |
| Owner broadcast | DONE | |

### Admin Panel
| Feature | Status | Notes |
|---------|--------|-------|
| Dashboard stats | DONE | |
| Company management | DONE | Create, edit, invite |
| Entity management (per company) | DONE | Inline add/rename/delete |
| User management | DONE | Mode, disabledBanks, entity access |
| Expense/Income types CRUD | DONE | Company-wide + per-entity |
| Custom fields CRUD | DONE | Collapsible sections, badges |
| Account toggle (enable/disable) | DONE | |
| Operation delete (any) | DONE | |

### PWA & Mobile
| Feature | Status | Notes |
|---------|--------|-------|
| manifest.json (standalone) | DONE | Icons 192/512 |
| Service worker (cache + push) | DONE | Cache-first assets, network-first API |
| Share Target (PDF) | DONE | |
| Bottom nav (mobile) | DONE | FAB center button for quick DDS add |
| Safe area handling (iOS) | DONE | black-translucent, viewport-fit=cover |
| Responsive layout | DONE | Mobile-first with breakpoints |

### i18n
| Feature | Status | Notes |
|---------|--------|-------|
| Russian (ru) | DONE | Primary |
| English (en) | DONE | |

---

## Temporary / Debug Files

Files in project root that are NOT committed (listed in .gitignore or untracked):

| File | Purpose | VPS Equivalent |
|------|---------|---------------|
| `debug_out.txt` | SSH debug output during deployment | — (local only) |
| `deploy_out.txt` | Deployment script output log | — (local only) |
| `finmanager_overview.json` | Project structure snapshot for AI context | — (local only) |
| `nginx_conf.txt` | Copy of nginx config for reference | `/etc/nginx/sites-available/finmanager` |
| `sber_api_integration.json` | Sber API research & implementation plan | — (local only) |
| `schema_check.txt` | Prisma schema validation output | — (local only) |
| `ssh_out.txt` | SSH session output log | — (local only) |

### VPS Key Paths

| What | Path |
|------|------|
| Project root | `/root/finmanager` |
| Client build | `/root/finmanager/src/client/dist` |
| Prisma schema | `/root/finmanager/prisma/schema.prisma` |
| PM2 config | `/root/finmanager/ecosystem.config.cjs` |
| PM2 logs | `/root/finmanager/logs/` |
| PDF service | `/root/finmanager/pdf-service/` |
| Nginx config | `/etc/nginx/sites-available/finmanager` |
| DB backup | `/root/finmanager_backup_*.sql` |
| Latest backup | `/root/finmanager_backup_20260326_100342.sql` |

---

## Infrastructure Status

| Component | Status | Details |
|-----------|--------|---------|
| VPS (Beget) | RUNNING | 155.212.225.7 |
| Domain | ACTIVE | fm.zinchukfinance.ru |
| nginx | RUNNING | Static + reverse proxy |
| PM2: finmanager-api | RUNNING | Cluster mode, tsx, port 3000 |
| PM2: finmanager-pdf | RUNNING | Fork mode, uvicorn, port 8080 |
| PostgreSQL | RUNNING | User: finmanager, DB: finmanager |
| SSL/HTTPS | ACTIVE | Let's Encrypt |

---

## Database

- **Models**: 20
- **Migrations**: 13 applied
- **Latest migration**: `20260326_add_reconciliation`
