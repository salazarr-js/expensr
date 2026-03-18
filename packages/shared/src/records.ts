import { z } from "zod";

/** Supported record types — expense and income for now, more later (shared, transfer, exchange, fee). */
export const RECORD_TYPES = ["expense", "income"] as const;

export type RecordType = (typeof RECORD_TYPES)[number];

/** Row shape returned by the records API. */
export interface FinancialRecord {
  id: number;
  type: RecordType;
  amount: number;
  date: string;
  accountId: number;
  tagId: number | null;
  categoryId: number | null;
  personId: number | null;
  linkedRecordId: number | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Record with joined relation names for list display. */
export interface RecordWithRelations extends FinancialRecord {
  accountName: string;
  accountCurrency: string;
  categoryName: string | null;
  categoryColor: string | null;
  categoryIcon: string | null;
  tagName: string | null;
}

/** Validation schema for creating a record. Used by both frontend forms and API. */
export const createRecordSchema = z.object({
  type: z.enum(RECORD_TYPES, { message: "Select one" }),
  amount: z.number({ message: "Must be a number" }).positive("Must be positive"),
  date: z.string().min(1, "Required"),
  accountId: z.number({ message: "Required" }),
  tagId: z.number().nullable().optional(),
  categoryId: z.number().nullable().optional(),
  personId: z.number().nullable().optional(),
  note: z.string().max(500, "Too long").nullable().optional(),
});

/** All fields optional — only send what changed. */
export const updateRecordSchema = createRecordSchema.partial();

/** Schema for reordering a record relative to another. */
export const reorderRecordSchema = z.object({
  id: z.number(),
  afterId: z.number().optional(),
  beforeId: z.number().optional(),
});

export type CreateRecord = z.infer<typeof createRecordSchema>;
export type UpdateRecord = z.infer<typeof updateRecordSchema>;
export type ReorderRecord = z.infer<typeof reorderRecordSchema>;
