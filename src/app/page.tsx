"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ProductWithStock } from "@/types";

export default function HomePage() {
  const router = useRouter();
  const [products, setProducts]   = useState<ProductWithStock[]>([]);
  const [loading, setLoading]     = useState(true);
  // Track which reserve button is mid-request so we can disable it
  const [reserving, setReserving] = useState<string | null>(null);

  useEffect(() => {
    loadProducts();
  }, []);

async function loadProducts() {
  try {
    const res = await fetch("/api/products");
    const data = await res.json();

    // DEBUG
    console.log("API DATA:", data);

    // Ensure array
    if (Array.isArray(data)) {
      setProducts(data);
    } else {
      console.error("Expected array but got:", data);
      toast.error(data.error || "Failed to load products");
      setProducts([]);
    }

  } catch (err) {
    console.error(err);
    toast.error("Couldn't load products — check your connection.");
    setProducts([]);
  } finally {
    setLoading(false);
  }
}

  async function handleReserve(productId: string, warehouseId: string) {
    const key = `${productId}:${warehouseId}`;
    setReserving(key);

    try {
      const res = await fetch("/api/reservations", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ productId, warehouseId, quantity: 1 }),
      });

      const data = await res.json();

      if (res.status === 409) {
        toast.error("Someone just grabbed the last unit. Refreshing stock...");
        await loadProducts(); // show updated (depleted) stock
        return;
      }

      if (!res.ok) {
        toast.error(data.error ?? "Reservation failed. Please try again.");
        return;
      }

      toast.success("Unit reserved! You have 10 minutes to complete checkout.");
      router.push(`/reservation/${data.id}`);

    } catch {
      toast.error("Network error — please try again.");
    } finally {
      setReserving(null);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground animate-pulse text-sm">Loading products…</p>
      </div>
    );
  }

  return (
    <main className="max-w-5xl mx-auto px-4 py-10">

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Allo Store</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Reserve a unit — you'll have 10 minutes to complete checkout before it's released.
        </p>
      </div>

      {/* Product grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {products.map((product) => {

          const totalActive = product.inventory.reduce(
            (sum, inv) => sum + inv.reservedUnits,
            0
          );

          return (
            <Card key={product.id} className="flex flex-col">

              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base leading-snug">{product.name}</CardTitle>
                  <span className="text-base font-semibold whitespace-nowrap shrink-0">
                    ₹{product.price.toLocaleString("en-IN")}
                  </span>
                </div>
                <CardDescription className="font-mono text-xs">
                  SKU: {product.sku}
                </CardDescription>
                {product.description && (
                  <p className="text-sm text-muted-foreground">{product.description}</p>
                )}
              </CardHeader>

              <CardContent className="flex-1 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Stock by Warehouse
                </p>

                {product.inventory.map((inv) => {
                  const key       = `${product.id}:${inv.warehouseId}`;
                  const isLoading = reserving === key;
                  const outOfStock = inv.availableUnits === 0;
                  const low       = inv.availableUnits > 0 && inv.availableUnits <= 3;

                  return (
                    <div
                      key={inv.warehouseId}
                      className="flex items-center justify-between text-sm"
                    >
                      {/* Warehouse name + location */}
                      <div className="min-w-0">
                        <span className="font-medium truncate">{inv.warehouseName}</span>
                        <span className="text-muted-foreground text-xs ml-1">
                          ({inv.warehouseLocation})
                        </span>
                      </div>

                      {/* Stock badge + reserve button */}
                      <div className="flex items-center gap-2 ml-2 shrink-0">
                        <Badge
                          variant={
                            outOfStock ? "destructive" : low ? "outline" : "secondary"
                          }
                          className="text-xs"
                        >
                          {outOfStock
                            ? "Out of stock"
                            : low
                            ? `Only ${inv.availableUnits} left`
                            : `${inv.availableUnits} available`}
                        </Badge>

                        <Button
                          size="sm"
                          className="text-xs h-7"
                          disabled={outOfStock || isLoading}
                          onClick={() => handleReserve(product.id, inv.warehouseId)}
                        >
                          {isLoading ? "Reserving…" : "Reserve"}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </CardContent>

              {/* Show how many units are currently held by live reservations */}
              {totalActive > 0 && (
                <CardFooter className="pt-0">
                  <p className="text-xs text-orange-500">
                    {totalActive} unit{totalActive > 1 ? "s" : ""} currently held in active reservations
                  </p>
                </CardFooter>
              )}

            </Card>
          );
        })}
      </div>
    </main>
  );
}