import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { scheduleReservationExpiry } from "@/lib/redis";
import { CreateReservationSchema } from "@/lib/schemas";

// How long a customer has to complete checkout after reserving.
const RESERVATION_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Validate the shape of the incoming request
    const parsed = CreateReservationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { productId, warehouseId, quantity } = parsed.data;

    // ── IDEMPOTENCY (bonus) ──────────────────────────────────────────────
    // If the client sends an Idempotency-Key header, check whether we've
    // already processed this exact request. If yes, replay the original
    // response without touching inventory again.
    const idempotencyKey = req.headers.get("Idempotency-Key");
    if (idempotencyKey) {
      const cached = await prisma.idempotencyRecord.findUnique({
        where: { key: idempotencyKey },
      });
      if (cached) {
        return NextResponse.json(cached.body, { status: cached.statusCode });
      }
    }
    // ────────────────────────────────────────────────────────────────────

    let reservation;

    try {
      // ── THE CORE CONCURRENCY FIX ─────────────────────────────────────
      //
      // Problem: two customers click "Reserve" at the same millisecond for
      // the last unit. Without locking, both read availableUnits = 1, both
      // pass the check, both decrement — now reservedUnits = 2 > totalUnits.
      //
      // Fix: SELECT FOR UPDATE.
      // Inside a Postgres transaction, locking the inventory row means the
      // second request can't even read it until the first one commits.
      // Postgres serialises the two requests automatically. One wins, one
      // gets a 409. No race condition. No oversell.
      //
      // ────────────────────────────────────────────────────────────────
      reservation = await prisma.$transaction(async (tx) => {
        // Step 1 — lock this specific product+warehouse row
        const rows = await tx.$queryRaw<
  Array<{
    id: string;
    totalUnits: number;
    reservedUnits: number;
  }>
>`
  SELECT id, "totalUnits", "reservedUnits"
  FROM "Inventory"
  WHERE "productId" = ${productId}
    AND "warehouseId" = ${warehouseId}
  FOR UPDATE
`;

        if (rows.length === 0) {
          throw new Error("INVENTORY_NOT_FOUND");
        }

        const inv = rows[0];
        const available = inv.totalUnits - inv.reservedUnits;

        // Step 2 — check if there's enough stock
        if (available < quantity) {
          throw new Error("INSUFFICIENT_STOCK");
        }

        // Step 3 — hold the units
        await tx.inventory.update({
          where: { productId_warehouseId: { productId, warehouseId } },
          data: { reservedUnits: { increment: quantity } },
        });

        // Step 4 — record the reservation
        return tx.reservation.create({
          data: {
            productId,
            warehouseId,
            quantity,
            status:    "PENDING",
            expiresAt: new Date(Date.now() + RESERVATION_WINDOW_MS),
          },
          include: {
            product:   true,
            warehouse: true,
          },
        });
      });

    } catch (txErr: unknown) {
      const msg = txErr instanceof Error ? txErr.message : "";

      if (msg === "INSUFFICIENT_STOCK") {
        const body = { error: "Not enough stock available for this product at this warehouse." };
        if (idempotencyKey) {
          await prisma.idempotencyRecord.create({
            data: { key: idempotencyKey, statusCode: 409, body },
          });
        }
        return NextResponse.json(body, { status: 409 });
      }

      if (msg === "INVENTORY_NOT_FOUND") {
        return NextResponse.json(
          { error: "No inventory record found for this product and warehouse combination." },
          { status: 404 }
        );
      }

      throw txErr; // unexpected — let the outer catch handle it
    }

    // Schedule expiry marker in Redis (belt-and-suspenders alongside the cron)
    await scheduleReservationExpiry(reservation.id, RESERVATION_WINDOW_MS);

    const responseBody = {
      id:       reservation.id,
      status:   reservation.status,
      quantity: reservation.quantity,
      expiresAt: reservation.expiresAt.toISOString(),
      createdAt: reservation.createdAt.toISOString(),
      product: {
        id:    reservation.product.id,
        name:  reservation.product.name,
        sku:   reservation.product.sku,
        price: reservation.product.price,
      },
      warehouse: {
        id:       reservation.warehouse.id,
        name:     reservation.warehouse.name,
        location: reservation.warehouse.location,
      },
    };

    if (idempotencyKey) {
      await prisma.idempotencyRecord.create({
        data: { key: idempotencyKey, statusCode: 201, body: responseBody },
      });
    }

    return NextResponse.json(responseBody, { status: 201 });

  } catch (err) {
    console.error("[POST /api/reservations]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}