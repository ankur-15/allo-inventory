import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    // Idempotency: if this confirm was already processed, replay the result
    const idempotencyKey = req.headers.get("Idempotency-Key");
    if (idempotencyKey) {
      const cached = await prisma.idempotencyRecord.findUnique({
        where: { key: idempotencyKey },
      });
      if (cached) {
        return NextResponse.json(cached.body, { status: cached.statusCode });
      }
    }

    const reservation = await prisma.reservation.findUnique({ where: { id } });

    if (!reservation) {
      return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
    }

    // Already confirmed — just return success, nothing to do
    if (reservation.status === "CONFIRMED") {
      return NextResponse.json({ message: "Already confirmed", id });
    }

    // Can't confirm something that was cancelled or released
    if (reservation.status === "RELEASED") {
      return NextResponse.json(
        { error: "This reservation was already released and cannot be confirmed." },
        { status: 410 }
      );
    }

    // Check if the customer ran out of time
    if (new Date() > reservation.expiresAt) {
      // Lazy release — clean it up right now since we're here anyway
      await prisma.$transaction([
        prisma.reservation.update({
          where: { id },
          data: { status: "RELEASED" },
        }),
        prisma.inventory.update({
          where: {
            productId_warehouseId: {
              productId:   reservation.productId,
              warehouseId: reservation.warehouseId,
            },
          },
          data: { reservedUnits: { decrement: reservation.quantity } },
        }),
      ]);

      const body = { error: "This reservation expired before payment was confirmed. The unit has been returned to stock." };
      if (idempotencyKey) {
        await prisma.idempotencyRecord.create({
          data: { key: idempotencyKey, statusCode: 410, body },
        });
      }
      return NextResponse.json(body, { status: 410 });
    }

    // Payment succeeded — confirm the reservation and permanently reduce stock
    const confirmed = await prisma.$transaction(async (tx) => {
      const updated = await tx.reservation.update({
        where: { id },
        data: { status: "CONFIRMED" },
        include: { product: true, warehouse: true },
      });

      // The units are now sold. Decrement both total and reserved.
      await tx.inventory.update({
        where: {
          productId_warehouseId: {
            productId:   reservation.productId,
            warehouseId: reservation.warehouseId,
          },
        },
        data: {
          totalUnits:    { decrement: reservation.quantity },
          reservedUnits: { decrement: reservation.quantity },
        },
      });

      return updated;
    });

    const responseBody = {
      id:       confirmed.id,
      status:   confirmed.status,
      quantity: confirmed.quantity,
      product:  { name: confirmed.product.name, price: confirmed.product.price },
      warehouse:{ name: confirmed.warehouse.name },
    };

    if (idempotencyKey) {
      await prisma.idempotencyRecord.create({
        data: { key: idempotencyKey, statusCode: 200, body: responseBody },
      });
    }

    return NextResponse.json(responseBody);

  } catch (err) {
    console.error("[POST /api/reservations/:id/confirm]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}