# Billora

Billora is a SaaS invoicing foundation for business profiles, customers, invoices, and manual payment tracking. This MVP contains a working NestJS API, a basic Next.js shell, shared TypeScript contracts, and a reserved Flutter workspace.

## Stack

- NestJS, TypeScript, JWT/Passport, bcrypt
- PostgreSQL (`billora_db`) and Prisma
- Next.js and React
- Flutter workspace placeholder
- npm workspaces

## Structure

```text
apps/api       NestJS API and Prisma schema
apps/web       Next.js placeholder application
apps/mobile    Future Flutter application
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
```

Initialize and seed the database:

```bash
npm run prisma:generate -w @billora/api
npm run prisma:migrate -w @billora/api -- --name init
npm run seed -w @billora/api
```

Demo credentials: `demo@billora.app` / `Password123!`.

## Run

```bash
npm run dev:api   # http://localhost:3001
npm run dev:web   # http://localhost:3000
```

Build everything with `npm run build`. Prisma Studio is available with `npm run prisma:studio -w @billora/api`.

## API

All endpoints except registration and login require `Authorization: Bearer <token>`.

| Method | Endpoint |
| --- | --- |
| POST | `/auth/register` |
| POST | `/auth/login` |
| GET | `/auth/me`, `/users/me` |
| POST, GET | `/businesses` |
| GET, PUT, DELETE | `/businesses/:id` |
| POST, GET | `/customers` |
| GET, PUT, DELETE | `/customers/:id` |
| POST, GET | `/invoices` |
| GET, PUT, DELETE | `/invoices/:id` |
| POST | `/invoices/:id/send` |
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

1. Add API integration and protected sessions to the web app.
2. Add email templates and queued invoice delivery.
3. Add PDF generation, recurring invoices, and audit history.
4. Integrate Stripe, PayPal, and regional payment providers with webhooks.
5. Add automated API tests, observability, rate limiting, and production deployment.
6. Initialize the Flutter client and reuse versioned API contracts.
