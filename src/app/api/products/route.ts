import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const products = await prisma.product.findMany({
      include: {
        inventory: {
          include: { warehouse: true },
        },
      },
      orderBy: { name: "asc" },
    });

    // Compute availableUnits here rather than making the frontend do the math.
    const response = products.map((p) => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      description: p.description,
      price: p.price,
      inventory: p.inventory.map((inv) => ({
        warehouseId:       inv.warehouseId,
        warehouseName:     inv.warehouse.name,
        warehouseLocation: inv.warehouse.location,
        totalUnits:        inv.totalUnits,
        reservedUnits:     inv.reservedUnits,
        availableUnits:    inv.totalUnits - inv.reservedUnits,
      })),
    }));

    return NextResponse.json(response);
  } catch (err) {
    console.error("[GET /api/products]", err);
    return NextResponse.json({ error: "Could not fetch products" }, { status: 500 });
  }
}