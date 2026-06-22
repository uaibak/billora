# Architecture

Billora uses npm workspaces. The NestJS API owns authentication, authorization, business rules, and persistence. PostgreSQL is accessed only through Prisma. The Next.js and future Flutter clients consume the API; framework-neutral contracts begin in `packages/shared`.

Every tenant-owned query is constrained through `Business.userId`. Multi-record invoice and payment writes run inside Prisma transactions.
