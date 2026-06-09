const { z } = require('zod');

const itemSchema = z.object({
  quantity: z.number().int().positive().default(1),
  lengthCm: z.number().positive(),
  widthCm: z.number().positive(),
  heightCm: z.number().positive(),
  weightKg: z.number().positive(),
});

const createShipmentSchema = z.object({
  originCountry: z.string().length(2),
  destinationCountry: z.string().length(2).default('SA'),
  mode: z.enum(['Express', 'Eco', 'DangerousGoods']),
  dangerousGoods: z.boolean().default(false),
  dgSubtype: z.string().nullable().optional(),
  remoteArea: z.boolean().default(false),
  nonConveyableIrregular: z.boolean().default(false),
  nonStackable: z.boolean().default(false),
  selectedSurcharges: z.array(z.string()).default([]),
  declaredValue: z.number().nonnegative().default(0),
  currency: z.string().default('SAR'),
  items: z.array(itemSchema).min(1, 'At least one item is required.'),
});

const quoteSchema = createShipmentSchema;

const approvalSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED']),
  reason: z.string().optional(),
});

module.exports = { createShipmentSchema, quoteSchema, approvalSchema };
