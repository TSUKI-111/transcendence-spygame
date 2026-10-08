# ft_transcendence — Spy Game

Current foundation of our `ft_transcendence` project.

## Stack

- React + Vite
- NestJS
- PostgreSQL
- Prisma
- Nginx
- Docker Compose

---

## Start the Project

Create your environment file:

```bash
cp .env.example .env
```

Then start everything:

```bash
docker compose up --build
```

Or in background:

```bash
docker compose up --build -d
```

Check containers:

```bash
docker compose ps
```

Expected:

```text
db        Up (healthy)
backend   Up (healthy)
frontend  Up
nginx     Up
```

---

## Architecture

```text
Client
  |
  v
Nginx :8080
  |
  +------------------+
  |                  |
  v                  v
Frontend :5173   Backend :3000
                      |
                      v
                   Prisma
                      |
                      v
               PostgreSQL :5432
```

Inside Docker, the backend connects to PostgreSQL using:

```text
db:5432
```

---

## Prisma and Database

Prisma is used by the backend to communicate with PostgreSQL.

Prisma files are located in:

```text
backend/prisma/
```

When the backend image is built:

```text
npm ci
   ↓
prisma generate
   ↓
npm run build
```

When the backend container starts:

```text
prisma migrate deploy
        ↓
NestJS starts
```

This means database migrations are applied automatically before the backend starts.

The migration system was also tested with a completely empty PostgreSQL database.

---

## Health Checks

### Backend health

```bash
curl http://localhost:3000/health
```

Expected:

```json
{"status":"ok"}
```

Through Nginx:

```bash
curl http://localhost:8080/api/health
```

### Backend readiness

```bash
curl http://localhost:3000/ready
```

Expected:

```json
{"status":"ready","database":"connected"}
```

Through Nginx:

```bash
curl http://localhost:8080/api/ready
```

The `/ready` endpoint also checks that PostgreSQL can be reached through Prisma.

---

## Startup Order

```text
PostgreSQL starts
        ↓
Database becomes healthy
        ↓
Backend starts
        ↓
Prisma migrations run
        ↓
NestJS starts
        ↓
Backend becomes healthy
        ↓
Nginx starts
```

---

## Database Volume

PostgreSQL data is stored in a Docker volume.

Stop containers without deleting data:

```bash
docker compose down
```

Delete containers and database data:

```bash
docker compose down -v
```

Be careful: `-v` deletes the PostgreSQL volume.

---

## Useful Commands

Start:

```bash
docker compose up --build
```

Check status:

```bash
docker compose ps
```

Backend logs:

```bash
docker compose logs -f backend
```

Database logs:

```bash
docker compose logs -f db
```

Stop:

```bash
docker compose down
```

---

## Current Progress

Completed and tested:

- Docker Compose setup
- React frontend container
- NestJS backend container
- PostgreSQL container
- Nginx reverse proxy
- PostgreSQL persistent volume
- Prisma connection to PostgreSQL
- Automatic Prisma Client generation
- Automatic database migrations
- PostgreSQL healthcheck
- Backend health endpoint
- Backend readiness endpoint
- Backend Docker healthcheck
- Nginx waits for backend health