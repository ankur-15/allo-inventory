import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Wipe everything so we can re-seed cleanly
  await prisma.reservation.deleteMany();
  await prisma.inventory.deleteMany();
  await prisma.product.deleteMany();
  await prisma.warehouse.deleteMany();

  // --- Warehouses ---
  const [delhi, mumbai, bangalore] = await Promise.all([
    prisma.warehouse.create({ data: { name: "Delhi Hub",     location: "New Delhi, India"  } }),
    prisma.warehouse.create({ data: { name: "Mumbai Hub",    location: "Mumbai, India"     } }),
    prisma.warehouse.create({ data: { name: "Bangalore Hub", location: "Bangalore, India"  } }),
  ]);

  // --- Products ---
  const [headphones, keyboard, hub, mouse] = await Promise.all([
    prisma.product.create({
      data: {
        name: "Wireless Noise-Cancelling Headphones",
        sku: "WNC-HDPH-001",
        description: "Premium over-ear headphones with 30-hour battery life.",
        price: 4999,
      },
    }),
    prisma.product.create({
      data: {
        name: "Mechanical Keyboard TKL",
        sku: "MKT-KBRD-001",
        description: "Tenkeyless layout with tactile brown switches.",
        price: 3499,
      },
    }),
    prisma.product.create({
      data: {
        name: "USB-C 4-Port Hub",
        sku: "4PT-HUBC-001",
        description: "Compact hub with 100W PD passthrough.",
        price: 1299,
      },
    }),
    prisma.product.create({
      data: {
        name: "Ergonomic Vertical Mouse",
        sku: "ERG-MOUS-001",
        description: "Wireless vertical mouse, 90-day battery.",
        price: 1999,
      },
    }),
  ]);

  // --- Inventory ---
  // Some slots have tight stock intentionally so you can demo the 409 race condition.
  // Bangalore headphones = 1 unit, Mumbai mouse = 1 unit — great for the demo.
  await prisma.inventory.createMany({
    data: [
      { productId: headphones.id, warehouseId: delhi.id,     totalUnits: 5  },
      { productId: headphones.id, warehouseId: mumbai.id,    totalUnits: 3  },
      { productId: headphones.id, warehouseId: bangalore.id, totalUnits: 1  }, // ← tight
      { productId: keyboard.id,   warehouseId: delhi.id,     totalUnits: 10 },
      { productId: keyboard.id,   warehouseId: mumbai.id,    totalUnits: 8  },
      { productId: keyboard.id,   warehouseId: bangalore.id, totalUnits: 2  },
      { productId: hub.id,        warehouseId: delhi.id,     totalUnits: 20 },
      { productId: hub.id,        warehouseId: mumbai.id,    totalUnits: 15 },
      { productId: hub.id,        warehouseId: bangalore.id, totalUnits: 0  }, // ← out of stock
      { productId: mouse.id,      warehouseId: delhi.id,     totalUnits: 4  },
      { productId: mouse.id,      warehouseId: mumbai.id,    totalUnits: 1  }, // ← tight
      { productId: mouse.id,      warehouseId: bangalore.id, totalUnits: 6  },
    ],
  });

  console.log("✅ Database seeded");
  console.log("   4 products · 3 warehouses · 12 inventory rows");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());