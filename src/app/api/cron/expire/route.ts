import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  // Protect the cron endpoint
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Find all PENDING reservations past their expiry
    const expired = await prisma.reservation.findMany({
      where: {
        status: "PENDING",
        expiresAt: { lt: new Date() },
      },
    });

    if (expired.length === 0) {
      return NextResponse.json({ message: "No expired reservations", released: 0 });
    }

    // Release each one in individual transactions to avoid partial failures
    let releasedCount = 0;
    for (const r of expired) {
      try {
        await prisma.$transaction([
          prisma.reservation.update({
            where: { id: r.id },
            data: { status: "RELEASED" },
          }),
          prisma.inventory.update({
            where: {
              productId_warehouseId: {
                productId: r.productId,
                warehouseId: r.warehouseId,
              },
            },
            data: { reservedUnits: { decrement: r.quantity } },
          }),
        ]);
        releasedCount++;
      } catch (err) {
        console.error(`Failed to release reservation ${r.id}:`, err);
      }
    }

    console.log(`[CRON] Released ${releasedCount} expired reservations`);
    return NextResponse.json({ message: "Done", released: releasedCount });
  } catch (err) {
    console.error("[CRON /api/cron/expire]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}