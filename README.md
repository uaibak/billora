# Billora

Billora is a SaaS invoicing foundation for business profiles, customers, invoices, and manual payment tracking. It contains a working NestJS API, a Next.js web app, shared TypeScript contracts, and a reserved Flutter workspace.

## Stack

- NestJS, TypeScript, JWT/Passport, bcrypt
- PostgreSQL (`billora_db`) and Prisma
- Next.js and React
- Flutter workspace
- npm workspaces

## Structure

```text
apps/api       NestJS API and Prisma schema
apps/web       Next.js web application
apps/mobile    Flutter application workspace
packages/shared Shared TypeScript contracts
docs           Architecture notes
```

## Setup

Prerequisites: Node.js 20+, npm, and PostgreSQL.

```bash
npm install
cp apps/api/.env.example apps/api/.env
```

Create the development role and database as a PostgreSQL administrator:

```sql
CREATE USER billora_user WITH PASSWORD 'YOUR_PASSWORD';
CREATE DATABASE billora_db OWNER billora_user;
```

Set a real password and JWT secret in `apps/api/.env`:

```env
DATABASE_URL="postgresql://billora_user:YOUR_PASSWORD@localhost:5432/billora_db"
JWT_SECRET="replace_with_strong_secret"
JWT_EXPIRES_IN="7d"
PORT=3001
# Optional for background jobs:
# REDIS_URL="redis://localhost:6379"
# Optional for invoice PDF/email delivery:
INVOICE_STORAGE_DIR="storage/invoices"
WEB_APP_URL="http://localhost:3000"
# SMTP_HOST="smtp.example.com"
# SMTP_PORT=587
# SMTP_SECURE=false
# SMTP_USER="user"
# SMTP_PASS="password"
# MAIL_FROM="billing@billora.app"
```

Initialize and seed the database:

```bash
npm run prisma:generate -w @billora/api
npm run prisma:migrate -w @billora/api -- --name init
npm run seed -w @billora/api
```

Test credentials: `demo@billora.app` / `Password123!`.

## Run

```bash
npm run dev:api   # http://localhost:3001
npm run dev:web   # http://localhost:3000
```

Build everything with `npm run build`. Prisma Studio is available with `npm run prisma:studio -w @billora/api`.
Background jobs use BullMQ. Configure `REDIS_URL` to enable queueing; without it, queue requests are skipped gracefully for local development. Invoice PDF artifacts are written to `INVOICE_STORAGE_DIR`; email delivery uses SMTP settings when configured and simulates success locally when SMTP is omitted.

Run tests:

```bash
npm run test:e2e -w @billora/api
npm run test -w @billora/web
```

Health and lightweight API docs:

```text
GET /health
GET /docs
GET /docs/openapi.json
```

The API also applies basic security headers, request IDs, request logging, and configurable rate limiting:

```env
RATE_LIMIT_MAX=240
RATE_LIMIT_WINDOW_MS=60000
```

## API

All endpoints except registration and login require `Authorization: Bearer <token>`.
List endpoints for businesses, customers, invoices, and invoice payments support pagination and filtering:

```text
?page=1&limit=20&search=acme&organizationId=...&businessId=...
```

Invoices also support `status` and `customerId`; invoice payments also support `status` and `provider`.
Audit logs require `organizationId` and support `action`, `entityType`, `entityId`, `search`, `dateFrom`, and `dateTo`. CSV export is available at `/audit-logs/export`.
Paginated responses use:

```ts
{ data: [], meta: { page, limit, total, totalPages } }
```

| Method | Endpoint |
| --- | --- |
| POST | `/auth/register` |
| POST | `/auth/login` |
| POST | `/auth/logout` |
| GET | `/auth/me`, `/users/me` |
| POST, GET | `/organizations` |
| PUT | `/organizations/:id` |
| GET | `/organizations/:id/members` |
| POST, GET | `/organizations/:id/invites` |
| POST | `/organizations/:id/invites/:inviteId/resend` |
| DELETE | `/organizations/:id/invites/:inviteId` |
| POST | `/organizations/invites/accept` |
| GET | `/dashboard/summary` |
| GET | `/audit-logs`, `/audit-logs/export` |
| POST, GET | `/businesses` |
| GET, PUT, DELETE | `/businesses/:id` |
| POST | `/businesses/:id/logo` |
| POST, GET | `/customers` |
| GET, PUT, DELETE | `/customers/:id` |
| POST, GET | `/invoices` |
| GET, PUT, DELETE | `/invoices/:id` |
| POST | `/invoices/:id/send` |
| POST, GET | `/invoices/:id/pdf` |
| POST | `/invoices/:id/mark-paid` |
| POST | `/payments/manual` |
| GET | `/payments/invoice/:invoiceId` |

Register and log in:

```bash
curl -X POST http://localhost:3001/auth/register -H 'Content-Type: application/json' -d '{"fullName":"Umar","email":"umar@example.com","password":"Password123!"}'
curl -X POST http://localhost:3001/auth/login -H 'Content-Type: application/json' -d '{"email":"umar@example.com","password":"Password123!"}'
curl http://localhost:3001/auth/me -H 'Authorization: Bearer YOUR_TOKEN'
```

## Roadmap

1. Expand role management and invite acceptance UX.
2. Add full web test coverage and broader API e2e coverage.
3. Improve PDF rendering and document templates.
4. Add dashboard charts and deeper analytics.
5. Add production deployment assets when ready.
6. Initialize the Flutter client and reuse versioned API contracts.
