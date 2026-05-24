import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    // Optional idempotency support
    const idempotencyKey = req.headers.get("Idempotency-Key");

    if (idempotencyKey) {
      const cached = await prisma.idempotencyRecord.findUnique({
        where: { key: idempotencyKey },
      });

      if (cached) {
        return NextResponse.json(cached.body, {
          status: cached.statusCode,
        });
      }
    }

    // Find reservation
    const reservation = await prisma.reservation.findUnique({
      where: { id },
      include: {
        product: true,
        warehouse: true,
      },
    });

    if (!reservation) {
      return NextResponse.json(
        { error: "Reservation not found" },
        { status: 404 }
      );
    }

    // Already confirmed
    if (reservation.status === "CONFIRMED") {
      return NextResponse.json({
        message: "Reservation already confirmed",
        id,
      });
    }

    // Already released
    if (reservation.status === "RELEASED") {
      return NextResponse.json(
        {
          error:
            "Reservation already released and cannot be confirmed",
        },
        { status: 410 }
      );
    }

    // Expired reservation
    const expired = new Date() > reservation.expiresAt;

    if (expired) {
      await prisma.$transaction([
        prisma.reservation.update({
          where: { id },
          data: { status: "RELEASED" },
        }),

        prisma.inventory.update({
          where: {
            productId_warehouseId: {
              productId: reservation.productId,
              warehouseId: reservation.warehouseId,
            },
          },
          data: {
            reservedUnits: {
              decrement: reservation.quantity,
            },
          },
        }),
      ]);

      return NextResponse.json(
        {
          error:
            "Reservation expired. Units returned to inventory.",
        },
        { status: 410 }
      );
    }

    // Confirm reservation + reduce inventory permanently
    const confirmed = await prisma.$transaction(async (tx) => {
      const updatedReservation = await tx.reservation.update({
        where: { id },
        data: {
          status: "CONFIRMED",
        },
        include: {
          product: true,
          warehouse: true,
        },
      });

      await tx.inventory.update({
        where: {
          productId_warehouseId: {
            productId: reservation.productId,
            warehouseId: reservation.warehouseId,
          },
        },
        data: {
          totalUnits: {
            decrement: reservation.quantity,
          },
          reservedUnits: {
            decrement: reservation.quantity,
          },
        },
      });

      return updatedReservation;
    });

    const responseBody = {
      success: true,
      reservation: {
        id: confirmed.id,
        status: confirmed.status,
        quantity: confirmed.quantity,
      },
      product: {
        name: confirmed.product.name,
        price: confirmed.product.price,
      },
      warehouse: {
        name: confirmed.warehouse.name,
      },
    };

    // Save idempotent response
    if (idempotencyKey) {
      await prisma.idempotencyRecord.create({
        data: {
          key: idempotencyKey,
          statusCode: 200,
          body: responseBody,
        },
      });
    }

    return NextResponse.json(responseBody);

  } catch (error) {
    console.error(
      "[POST /api/reservations/[id]/confirm]",
      error
    );

    return NextResponse.json(
      {
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}