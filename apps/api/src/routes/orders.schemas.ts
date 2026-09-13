import { z } from 'zod';
import { OrderStatus } from '@airbus-tools/shared';

// ── Shared sub-schemas ───────────────────────────────────────────────────────

export const shippingAddressSchema = z.object({
  street:     z.string().trim().min(1).max(200),
  city:       z.string().trim().min(1).max(100),
  state:      z.string().trim().max(100).optional(),
  postalCode: z.string().trim().min(1).max(20),
  country:    z.string().trim().min(2).max(100),
});

export const orderItemInputSchema = z.object({
  productId: z.string().trim().min(1, 'productId is required'),
  quantity:  z.number().int().min(1, 'Quantity must be at least 1'),
});

// ── POST /orders ─────────────────────────────────────────────────────────────

export const createOrderSchema = z.object({
  items:           z.array(orderItemInputSchema).min(1, 'At least one item is required'),
  shippingAddress: shippingAddressSchema,
  notes:           z.string().trim().max(2000).optional(),
});

export type CreateOrderBody = z.infer<typeof createOrderSchema>;

// ── PATCH /orders/:id/status ─────────────────────────────────────────────────

export const transitionOrderSchema = z.object({
  status:          z.nativeEnum(OrderStatus),
  rejectionReason: z.string().trim().min(1).max(1000).optional(),
});

export type TransitionOrderBody = z.infer<typeof transitionOrderSchema>;

// ── GET /orders query params ─────────────────────────────────────────────────

export const listOrdersQuerySchema = z.object({
  status:    z.nativeEnum(OrderStatus).optional(),
  page:      z.coerce.number().int().min(1).default(1),
  limit:     z.coerce.number().int().min(1).max(100).default(20),
  startDate: z.coerce.date().optional(),
  endDate:   z.coerce.date().optional(),
});

export type ListOrdersQuery = z.infer<typeof listOrdersQuerySchema>;

// ── Params ───────────────────────────────────────────────────────────────────

export const orderIdParamSchema = z.object({
  id: z
    .string()
    .trim()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid order ID — must be a 24-character hex ObjectId'),
});
