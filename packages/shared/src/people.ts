import { z } from "zod";

/** Person you share expenses with. */
export interface Person {
  id: number;
  name: string;
  color: string | null;
  balance: number; // positive = they owe you, negative = you owe them
  recordCount: number;
  createdAt: string;
  updatedAt: string;
}

/** Validation for creating a person. */
export const createPersonSchema = z.object({
  name: z.string().min(2, "Too short").max(100, "Too long"),
  color: z.string().nullable().optional(),
});

/** Partial create schema for updates. */
export const updatePersonSchema = createPersonSchema.partial();

/** Inferred type from createPersonSchema. */
export type CreatePerson = z.infer<typeof createPersonSchema>;
/** Inferred type from updatePersonSchema. */
export type UpdatePerson = z.infer<typeof updatePersonSchema>;
