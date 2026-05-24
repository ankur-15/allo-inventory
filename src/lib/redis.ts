import { Redis } from "@upstash/redis";

// Upstash gives us a serverless-friendly Redis client.
// Regular ioredis doesn't work in Next.js edge/serverless functions.
export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// We don't actually need Redis for the core locking —
// Postgres SELECT FOR UPDATE handles that perfectly.
// Redis is here to schedule per-reservation expiry events
// as a belt-and-suspenders layer on top of the cron job.

export async function scheduleReservationExpiry(
  reservationId: string,
  expiresInMs: number
) {
  // Just store a marker key that expires automatically.
  // If you ever add a Redis keyspace notifications listener,
  // this is where you'd hook the auto-release logic.
  await redis.set(`reservation:${reservationId}`, "pending", { px: expiresInMs });
}