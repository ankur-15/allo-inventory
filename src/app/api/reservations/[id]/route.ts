import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// The checkout page fetches this to show reservation details.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const reservation = await prisma.reservation.findUnique({
      where: { id },
      include: { product: true, warehouse: true },
    });

    if (!reservation) {
      return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
    }

    return NextResponse.json({
      id:        reservation.id,
      status:    reservation.status,
      quantity:  reservation.quantity,
      expiresAt: reservation.expiresAt.toISOString(),
      createdAt: reservation.createdAt.toISOString(),
      product: {
        id:          reservation.product.id,
        name:        reservation.product.name,
        sku:         reservation.product.sku,
        price:       reservation.product.price,
        description: reservation.product.description,
      },
      warehouse: {
        id:       reservation.warehouse.id,
        name:     reservation.warehouse.name,
        location: reservation.warehouse.location,
      },
    });

  } catch (err) {
    console.error("[GET /api/reservations/:id]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}