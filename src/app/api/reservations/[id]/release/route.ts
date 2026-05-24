import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Called when the customer cancels, or payment explicitly fails.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const reservation = await prisma.reservation.findUnique({ where: { id } });

    if (!reservation) {
      return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
    }

    // Only PENDING reservations can be released manually
    if (reservation.status !== "PENDING") {
      return NextResponse.json(
        { error: `Cannot release a reservation that is already ${reservation.status.toLowerCase()}.` },
        { status: 400 }
      );
    }

    // Free the units back to available stock
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

    return NextResponse.json({ message: "Reservation released. Units are back in stock.", id });

  } catch (err) {
    console.error("[POST /api/reservations/:id/release]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}