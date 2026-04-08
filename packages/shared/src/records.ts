import { z } from "zod";

/** Supported record types. */
export const RECORD_TYPES = ["expense", "income", "settlement", "transfer"] as const;

/** Split modes for shared expenses. */
export const SPLIT_TYPES = ["equal", "weighted", "manual"] as const;
export type SplitType = (typeof SPLIT_TYPES)[number];

/** How the parse resolved the tag: deterministic (name/keyword) vs probabilistic (AI). */
export const RESOLVED_BY = ["name_match", "keyword", "ai", "none"] as const;
export type ResolvedBy = (typeof RESOLVED_BY)[number];

/** Union of RECORD_TYPES values. */
export type RecordType = (typeof RECORD_TYPES)[number];

/** Database row shape (no joins). */
export interface FinancialRecord {
  id: number;
  type: RecordType;
  amount: number;
  date: string;
  accountId: number;
  tagId: number | null;
  categoryId: number | null;
  linkedRecordId: number | null;
  note: string | null;
  myShares: number;
  splitType: SplitType;
  needsReview: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Record with joined relation names for display. */
export interface RecordWithRelations extends FinancialRecord {
  accountName: string;
  accountCurrency: string;
  categoryName: string | null;
  categoryColor: string | null;
  categoryIcon: string | null;
  tagName: string | null;
  people: { id: number; name: string; shareAmount: number }[];
  mySpend: number; // your actual spending portion (amount minus others' shares, 0 for settlements/transfers)
  linkedAccountName: string | null; // counterpart account for transfers
  linkedAccountCurrency: string | null;
}

/** Validation for creating a record. Shared by frontend forms and API. */
export const createRecordSchema = z.object({
  type: z.enum(RECORD_TYPES, { message: "Select one" }),
  amount: z.number({ message: "Must be a number" }).positive("Must be positive"),
  date: z.string().min(1, "Required"),
  accountId: z.number({ message: "Required" }),
  tagId: z.number().nullable().optional(),
  categoryId: z.number().nullable().optional(),
  personIds: z.array(z.number()).optional(),
  myShares: z.number().int().min(1).optional(), // how many shares the creator pays (default 1 = equal split)
  personShares: z.array(z.object({ personId: z.number(), amount: z.number().positive() })).optional(), // manual per-person amounts
  note: z.string().max(500, "Too long").nullable().optional(),
  needsReview: z.boolean().optional(),
});

/** Partial create schema for PATCH-style updates. */
export const updateRecordSchema = createRecordSchema.partial();

/** Transfer between accounts (same or different currency). */
export const createTransferSchema = z.object({
  fromAccountId: z.number({ message: "Required" }),
  toAccountId: z.number({ message: "Required" }),
  amount: z.number({ message: "Must be a number" }).positive("Must be positive"),
  // For exchanges: amount received in the target currency (different from amount sent)
  toAmount: z.number().positive().optional(),
  date: z.string().min(1, "Required"),
  note: z.string().max(500, "Too long").nullable().optional(),
  // Optional fee as a separate expense record
  feeAmount: z.number().positive().optional(),
  feeAccountId: z.number().optional(),
});
export type CreateTransfer = z.infer<typeof createTransferSchema>;

/** Reorder by placing a record before or after another. */
export const reorderRecordSchema = z.object({
  id: z.number(),
  afterId: z.number().optional(),
  beforeId: z.number().optional(),
});

/** Smart parse input — raw natural language text. */
export const parseRecordSchema = z.object({
  text: z.string().min(1, "Required"),
});

/** Result from POST /parse. All nullable — parse may not resolve everything. */
export interface ParsedRecord {
  amount: number | null;
  tagId: number | null;
  tagName: string | null;
  categoryId: number | null;
  categoryName: string | null;
  accountId: number | null;
  accountName: string | null;
  note: string | null;
  date: string | null;
  personIds: number[];
  personNames: string[];
  myShares: number;
  splitType: SplitType;
  type: RecordType;
  needsReview: boolean;
  resolvedBy: ResolvedBy; // which tier matched the tag
  parseLogId: number; // reference to parse_logs row for feedback
}

/** Parse feedback: references the log row and sends what the user actually saved. */
export const parseRecordFeedbackSchema = z.object({
  parseLogId: z.number(),
  finalResponse: z.record(z.string(), z.unknown()),
});

/** Inferred type from createRecordSchema. */
export type CreateRecord = z.infer<typeof createRecordSchema>;
/** Inferred type from updateRecordSchema. */
export type UpdateRecord = z.infer<typeof updateRecordSchema>;
/** Inferred type from reorderRecordSchema. */
export type ReorderRecord = z.infer<typeof reorderRecordSchema>;
