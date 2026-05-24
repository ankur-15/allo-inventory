"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ReservationDetail {
  id: string;
  status: "PENDING" | "CONFIRMED" | "RELEASED";
  quantity: number;
  expiresAt: string;
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

function useCountdown(expiresAt: string | null) {
  const [secondsLeft, setSecondsLeft] = useState<number>(0);

  useEffect(() => {
    if (!expiresAt) return;

    function calc() {
      const diff = Math.max(0, Math.floor((new Date(expiresAt!).getTime() - Date.now()) / 1000));
      setSecondsLeft(diff);
    }

    calc();
    const interval = setInterval(calc, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  return { secondsLeft, display: `${minutes}:${seconds.toString().padStart(2, "0")}` };
}

export default function ReservationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const [id, setId] = useState<string | null>(null);
  const [reservation, setReservation] = useState<ReservationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const { secondsLeft, display } = useCountdown(reservation?.expiresAt ?? null);

  useEffect(() => {
    params.then((p) => setId(p.id));
  }, [params]);

  const fetchReservation = useCallback(async () => {
    if (!id) return;
    try {
      const res = await fetch(`/api/reservations/${id}`);
      if (!res.ok) {
        toast.error("Reservation not found");
        router.push("/");
        return;
      }
      const data = await res.json();
      setReservation(data);
    } catch {
      toast.error("Failed to load reservation");
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    fetchReservation();
  }, [fetchReservation]);

  // Auto-refresh state when timer hits zero
  useEffect(() => {
    if (secondsLeft === 0 && reservation?.status === "PENDING") {
      setTimeout(fetchReservation, 1500);
    }
  }, [secondsLeft, reservation?.status, fetchReservation]);

  async function handleConfirm() {
    if (!id) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/reservations/${id}/confirm`, { method: "POST" });
      const data = await res.json();

      if (res.status === 410) {
        toast.error("Your reservation expired before payment could be confirmed.");
        await fetchReservation();
        return;
      }

      if (!res.ok) {
        toast.error(data.error ?? "Confirmation failed");
        return;
      }

      toast.success("Purchase confirmed! 🎉");
      await fetchReservation();
    } catch {
      toast.error("Network error — please try again");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCancel() {
    if (!id) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/reservations/${id}/release`, { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error ?? "Cancel failed");
        return;
      }

      toast.info("Reservation cancelled. Stock has been returned.");
      await fetchReservation();
    } catch {
      toast.error("Network error — please try again");
    } finally {
      setActionLoading(false);
    }
  }

  if (loading || !reservation) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground animate-pulse">Loading reservation...</p>
      </div>
    );
  }

  const isExpired = new Date() > new Date(reservation.expiresAt);
  const isPending = reservation.status === "PENDING";
  const isConfirmed = reservation.status === "CONFIRMED";
  const isReleased = reservation.status === "RELEASED";

  return (
    <main className="max-w-xl mx-auto px-4 py-10">
      <div className="mb-6">
        <button
          onClick={() => router.push("/")}
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Back to products
        </button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-xl">Reservation Checkout</CardTitle>
            <Badge
              variant={
                isConfirmed ? "default" : isReleased || isExpired ? "destructive" : "secondary"
              }
            >
              {isConfirmed
                ? "Confirmed"
                : isReleased
                ? "Cancelled"
                : isExpired
                ? "Expired"
                : "Pending"}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground font-mono">ID: {reservation.id}</p>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Product */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
              Product
            </p>
            <p className="font-medium">{reservation.product.name}</p>
            <p className="text-sm text-muted-foreground">{reservation.product.description}</p>
            <p className="text-xs text-muted-foreground font-mono mt-1">
              SKU: {reservation.product.sku}
            </p>
          </div>

          {/* Warehouse */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
              Ship from
            </p>
            <p className="font-medium">{reservation.warehouse.name}</p>
            <p className="text-sm text-muted-foreground">{reservation.warehouse.location}</p>
          </div>

          {/* Order summary */}
          <div className="rounded-lg bg-muted/40 p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Quantity</span>
              <span>{reservation.quantity}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Unit price</span>
              <span>₹{reservation.product.price.toLocaleString("en-IN")}</span>
            </div>
            <div className="flex justify-between font-semibold border-t pt-2 mt-2">
              <span>Total</span>
              <span>
                ₹{(reservation.product.price * reservation.quantity).toLocaleString("en-IN")}
              </span>
            </div>
          </div>

          {/* Timer — shown only while PENDING and not expired */}
          {isPending && !isExpired && (
            <div
              className={`rounded-lg border p-4 text-center ${
                secondsLeft < 60
                  ? "border-red-300 bg-red-50 dark:bg-red-950/20"
                  : "border-orange-200 bg-orange-50 dark:bg-orange-950/20"
              }`}
            >
              <p className="text-xs text-muted-foreground mb-1">Time remaining to checkout</p>
              <p
                className={`text-4xl font-mono font-bold ${
                  secondsLeft < 60 ? "text-red-600" : "text-orange-600"
                }`}
              >
                {display}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Unit released automatically if not confirmed
              </p>
            </div>
          )}

          {/* Status messages for terminal states */}
          {(isExpired || isReleased) && (
            <div className="rounded-lg border border-red-300 bg-red-50 dark:bg-red-950/20 p-4 text-center">
              <p className="text-sm font-medium text-red-700 dark:text-red-400">
                {isExpired && reservation.status === "PENDING"
                  ? "This reservation has expired. The unit has been returned to stock."
                  : "This reservation was cancelled."}
              </p>
              <Button
                variant="outline"
                className="mt-3"
                onClick={() => router.push("/")}
              >
                Back to products
              </Button>
            </div>
          )}

          {isConfirmed && (
            <div className="rounded-lg border border-green-300 bg-green-50 dark:bg-green-950/20 p-4 text-center">
              <p className="text-lg font-bold text-green-700 dark:text-green-400">
                ✓ Purchase Complete
              </p>
              <p className="text-sm text-green-600 dark:text-green-500 mt-1">
                Thank you for your order!
              </p>
              <Button
                variant="outline"
                className="mt-3"
                onClick={() => router.push("/")}
              >
                Continue shopping
              </Button>
            </div>
          )}

          {/* Action buttons — only for PENDING + not expired */}
          {isPending && !isExpired && (
            <div className="flex gap-3">
              <Button
                className="flex-1"
                onClick={handleConfirm}
                disabled={actionLoading}
              >
                {actionLoading ? "Processing..." : "Confirm Purchase"}
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleCancel}
                disabled={actionLoading}
              >
                Cancel
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}