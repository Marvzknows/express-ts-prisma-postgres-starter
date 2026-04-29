# express-ts-prisma-starter

Boilerplate for an Express 5 + TypeScript backend with Prisma 7 (using the new `prisma-client` generator and the `PrismaPg` driver adapter) and PostgreSQL via Docker Compose.

## Stack

- **Runtime:** Node.js (ESM)
- **Web framework:** Express 5
- **ORM:** Prisma 7 (`prisma-client` generator + `@prisma/adapter-pg` driver adapter)
- **Database:** PostgreSQL 16 (Docker)
- **Language:** TypeScript 6 (strict, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`)
- **Dev runner:** tsx (watch mode)

---

## Quick start (using this repo as a template)

### 1. Prerequisites

- Node.js 20+ (tested on Node 24)
- Docker Desktop (for the Postgres container)
- npm

### 2. Clone and install

```bash
git clone <your-repo-url> my-new-project
cd my-new-project
npm install
```

### 3. Create `.env`

Copy the example values:

```env
DATABASE_URL="postgresql://myuser:mypassword@localhost:5432/mydatabase"
PORT=3000
```

> The credentials must match `docker-compose.yml`. Change both files together if you want different values.

### 4. Start Postgres

```bash
docker compose up -d
```

Verify the container is healthy:

```bash
docker ps
docker exec my-express-postgres pg_isready -U myuser -d mydatabase
```

### 5. Apply migrations and generate the Prisma client

```bash
npx prisma migrate dev
```

This will:
- Apply existing migrations under `prisma/migrations/`
- Generate the type-safe client into `src/generated/prisma/`

### 6. Run the dev server

```bash
npm run dev
```

You should see:

```
Server listening on http://localhost:3000
```

### 7. Smoke test the routes

```bash
curl http://localhost:3000/health
# → {"status":"ok"}

curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{"email":"a@b.com","username":"alice","password":"<pre-hashed-value>"}'

curl http://localhost:3000/users
```

---

## How this codebase was built (step by step)

If you want to recreate this setup from scratch (or understand each piece), follow these steps in order.

### Step 1 — Initialize the project

```bash
mkdir my-project && cd my-project
npm init -y
```

Then in `package.json`, add:

```json
"type": "module"
```

This makes the project ESM (required by Prisma 7's `prisma-client` generator output).

### Step 2 — Install TypeScript and tsx

```bash
npm i -D typescript tsx @types/node
```

Initialize a `tsconfig.json`:

```bash
npx tsc --init
```

Then edit it to look like this (key options for this project):

```jsonc
{
  "compilerOptions": {
    "rootDir": ".",
    "outDir": "./dist",
    "module": "esnext",
    "target": "es2023",
    "lib": ["esnext"],
    "types": ["node"],
    "sourceMap": true,
    "declaration": true,
    "declarationMap": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "strict": true,
    "jsx": "react-jsx",
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "noUncheckedSideEffectImports": true,
    "moduleDetection": "force",
    "skipLibCheck": true
  },
  "include": ["src/**/*", "prisma.config.ts"],
  "exclude": ["node_modules", "dist"]
}
```

**Things to check:**
- `rootDir` is `.` (not `./src`) so the root-level `prisma.config.ts` can be included without a "not under rootDir" error.
- `include` lists `prisma.config.ts` explicitly so the IDE type-checks it.
- `types: ["node"]` is required for `process.env` and other Node globals to resolve.

### Step 3 — Install Express

```bash
npm i express
npm i -D @types/express
```

### Step 4 — Install Prisma 7 and the Postgres driver adapter

```bash
npm i @prisma/client @prisma/adapter-pg pg dotenv
npm i -D prisma @types/pg
```

> Prisma 7's new `prisma-client` generator (different from the older `prisma-client-js`) requires a **driver adapter** instead of a built-in engine. `@prisma/adapter-pg` wraps `pg` for Postgres.

### Step 5 — Set up Postgres via Docker Compose

Create `docker-compose.yml` in the project root:

```yaml
services:
  postgres:
    image: postgres:16-alpine
    container_name: my-express-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: myuser
      POSTGRES_PASSWORD: mypassword
      POSTGRES_DB: mydatabase
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U myuser -d mydatabase"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
```

Then start it:

```bash
docker compose up -d
```

**Things to check:**
- `docker ps` shows the container as `healthy`
- Port `5432` is not already in use by a local Postgres install (`netstat -ano | findstr :5432` on Windows)

### Step 6 — Initialize Prisma

```bash
npx prisma init
```

This creates:
- `prisma/schema.prisma`
- `.env` with a placeholder `DATABASE_URL`

Replace `.env` contents:

```env
DATABASE_URL="postgresql://myuser:mypassword@localhost:5432/mydatabase"
PORT=3000
```

### Step 7 — Configure `prisma.config.ts`

Create `prisma.config.ts` at the project root:

```ts
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
```

> Prisma 7 uses `prisma.config.ts` (TypeScript-based config) instead of relying on environment variable resolution from inside `schema.prisma`. The `dotenv/config` import loads `.env`.

### Step 8 — Edit `prisma/schema.prisma`

```prisma
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}

datasource db {
  provider = "postgresql"
}

model User {
  id        String   @id @default(cuid())
  email     String   @unique
  username  String   @unique
  // Hashed password. Hashing is performed by the application before insert.
  password  String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  refreshTokens RefreshToken[]
}

model RefreshToken {
  id         String    @id @default(cuid())
  userId     String
  user       User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  tokenHash  String    @unique
  expiresAt  DateTime
  revokedAt  DateTime?
  replacedBy String?
  createdAt  DateTime  @default(now())

  @@index([userId])
  @@index([expiresAt])
}
```

**Things to note:**
- `provider = "prisma-client"` (new generator, NOT `prisma-client-js`) — outputs ESM TypeScript directly into your source tree.
- `output = "../src/generated/prisma"` — committed to the repo so the IDE always has types; add this path to `.gitignore` instead if you'd rather regenerate on each install.
- The schema has no `url` on the datasource — that comes from `prisma.config.ts`.

### Step 9 — Run the first migration

```bash
npx prisma migrate dev --name initial_migration
```

This creates `prisma/migrations/<timestamp>_initial_migration/migration.sql`, applies it, and generates the client.

**Things to check:**
- A new directory exists under `prisma/migrations/`
- `src/generated/prisma/` is populated with TypeScript files
- `docker exec my-express-postgres psql -U myuser -d mydatabase -c "\dt"` shows the `User` and `RefreshToken` tables

### Step 10 — Create the Prisma client wrapper

`src/lib/prisma.ts`:

```ts
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";

const connectionString = `${process.env.DATABASE_URL}`;

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

export { prisma };
```

**Things to check:**
- The relative import ends with `.js` (NOT `.ts`). Node's ESM loader requires the `.js` extension at runtime; tsx tolerates either, but `node dist/...` will fail without it.
- `PrismaPg` is constructed with a `connectionString`, then passed as `adapter` to `PrismaClient`.

### Step 11 — Create the Express app

`src/index.ts`:

```ts
import "dotenv/config";
import express from "express";
import type { Request, Response } from "express";
import { Prisma } from "./generated/prisma/client.js";
import { prisma } from "./lib/prisma.js";

const app = express();
const port = Number(process.env["PORT"]) || 3000;

app.use(express.json());

app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok" });
});

app.get("/users", async (_req: Request, res: Response) => {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, username: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  res.json(users);
});

app.get("/users/:id", async (req: Request, res: Response) => {
  const { id } = req.params;
  if (typeof id !== "string") {
    res.status(400).json({ error: "Missing user id" });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, username: true, createdAt: true },
  });

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json(user);
});

app.post("/users", async (req: Request, res: Response) => {
  const { email, username, password } = req.body ?? {};

  if (!email || !username || !password) {
    res
      .status(400)
      .json({ error: "email, username, and password are required" });
    return;
  }

  try {
    const user = await prisma.user.create({
      data: { email, username, password },
      select: { id: true, email: true, username: true, createdAt: true },
    });
    res.status(201).json(user);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const target = (err.meta?.["target"] as string[] | undefined)?.join(", ") ?? "field";
      res.status(409).json({ error: `A user with that ${target} already exists` });
      return;
    }
    throw err;
  }
});

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
```

**Things to note:**
- Express 5 types `req.params.id` as `string | string[]` (because of optional regex routing) — narrow it with `typeof id !== "string"`.
- The `/users` POST route stores the `password` field as-is. Hash it (bcrypt, argon2, etc.) before sending it to this endpoint, or move the hashing here.
- P2002 is Prisma's unique-constraint code. Returning 409 makes duplicate emails a clean client error instead of a 500.

### Step 12 — Add npm scripts

In `package.json`:

```json
"scripts": {
  "dev": "tsx watch src/index.ts",
  "start": "node dist/src/index.js",
  "build": "tsc",
  "test": "echo \"Error: no test specified\" && exit 1"
}
```

### Step 13 — Run

```bash
npm run dev      # development with auto-reload
npm run build    # compile TypeScript → dist/
npm run start    # run the compiled output
```

---

## Project structure

```
.
├── docker-compose.yml          # Postgres container
├── package.json
├── prisma/
│   ├── schema.prisma           # data model
│   └── migrations/             # versioned SQL migrations
├── prisma.config.ts            # Prisma 7 config (loads DATABASE_URL)
├── src/
│   ├── index.ts                # Express app entry
│   ├── lib/
│   │   └── prisma.ts           # Prisma client singleton
│   └── generated/
│       └── prisma/             # generated client (committed)
├── tsconfig.json
└── .env                        # NOT committed; copy from .env.example
```

---

## Common workflows

### Modify the data model

1. Edit `prisma/schema.prisma`
2. Run `npx prisma migrate dev --name <description>`
3. Prisma generates a SQL migration, applies it, and regenerates the client

If you rename a column and the table already has rows, Prisma can't auto-detect a rename — it sees it as drop + add. To preserve data, create the migration with `--create-only` and manually edit the SQL to use `ALTER TABLE ... RENAME COLUMN ...`, then run `npx prisma migrate dev` to apply it.

### Reset the database (dev only — destroys data)

```bash
npx prisma migrate reset
```

### Inspect the database directly

```bash
docker exec -it my-express-postgres psql -U myuser -d mydatabase
```

Useful psql commands: `\dt` (list tables), `\d "User"` (describe), `\q` (quit).

### Stop / remove the database container

```bash
docker compose down          # stop, keep data volume
docker compose down -v       # stop AND wipe data volume
```

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `Cannot find name 'process'` | `@types/node` not installed or not in `tsconfig.json` `types` array | Ensure `"types": ["node"]` in tsconfig and `@types/node` in devDependencies |
| `process.env.DATABASE_URL undefined` | `.env` not loaded | The first import in entry files should be `import "dotenv/config"` |
| `ERR_MODULE_NOT_FOUND` when running `npm run start` | Missing `.js` extension on a relative import in source | Always end relative imports with `.js` (TypeScript leaves them alone; Node's ESM loader requires them) |
| `column "X" does not exist` at runtime | Schema and DB drifted | Re-run `npx prisma migrate dev` |
| `Object literal may only specify known properties, and 'X' does not exist...` | Generated client is stale | Run `npx prisma generate`, then restart the TS Server in your IDE |
| `Unique constraint failed` (P2002) | Duplicate value on a `@unique` field | Use a different value, or handle the error in the route (the POST `/users` route already returns 409) |
| Prisma migrate fails with "rows in this table" | New required column added with no default | Either reset (dev) or `--create-only` and write a backfill in the migration |
