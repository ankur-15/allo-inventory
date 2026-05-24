// What the /api/products endpoint returns per product
export interface ProductWithStock {
  id: string;
  name: string;
  sku: string;
  description: string | null;
  price: number;
  inventory: WarehouseStock[];
}

export interface WarehouseStock {
  warehouseId: string;
  warehouseName: string;
  warehouseLocation: string;
  totalUnits: number;
  reservedUnits: number;
  availableUnits: number; // totalUnits - reservedUnits, computed server-side
}

// What the /api/reservations endpoints return
export interface ReservationDetail {
  id: string;
  status: "PENDING" | "CONFIRMED" | "RELEASED";
  quantity: number;
  expiresAt: string; // ISO string
  createdAt: string;
  product: {
    id: string;
    name: string;
    sku: string;
    price: number;
    description: string | null;
  };
  warehouse: {
    id: string;
    name: string;
    location: string;
  };
}