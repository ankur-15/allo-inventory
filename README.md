# Allo Inventory Reservation System

A Next.js application that solves the checkout race condition for multi-warehouse
retail: units are held for 10 minutes during payment, then either confirmed or
automatically returned to stock.

---

## Running locally

**1. Install dependencies**
```bash
npm install
```

**2. Set environment variables**

Copy `.env.example` to `.env` and fill in the values:

| Variable | Where to get it |
|---|---|
| `DATABASE_URL` | neon.tech — free project → Connection String |
| `UPSTASH_REDIS_REST_URL` | upstash.com — free Redis → REST API |
| `UPSTASH_REDIS_REST_TOKEN` | same page as above |
| `CRON_SECRET` | make up any random string |

**3. Run migrations and seed**
```bash
npx prisma migrate dev
npx prisma db seed
```

**4. Start the dev server**
```bash
npm run dev
```
Open http://localhost:3000

---

## How the race condition is prevented

When two customers click "Reserve" simultaneously for the last unit,
the reservation endpoint uses **Postgres `SELECT FOR UPDATE`** inside
a transaction: