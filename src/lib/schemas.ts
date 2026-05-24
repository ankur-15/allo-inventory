import { z } from "zod";

// Sharing these schemas between the API and the frontend means
// we validate the same rules in both places without duplicating logic.

export const CreateReservationSchema = z.object({
  productId:   z.string().min(1, "Product ID is required"),
  warehouseId: z.string().min(1, "Warehouse ID is required"),
  quantity:    z.number().int().min(1, "Need at least 1 unit"),
});

export type CreateReservationInput = z.infer<typeof CreateReservationSchema>;