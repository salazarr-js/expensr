import { z } from "zod";

/** Row shape returned by the categories API. */
export interface Category {
  id: number;
  name: string;
  color: string | null;
  icon: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Category with an inline count of its tags. */
export interface CategoryWithTagCount extends Category {
  tagCount: number;
}

/** Category with its full list of tags. */
export interface CategoryWithTags extends Category {
  tags: Tag[];
}

/** Row shape returned by the tags API. Tags inherit color from their parent category. */
export interface Tag {
  id: number;
  name: string;
  categoryId: number | null;
  icon: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Tag with parent category info attached. */
export interface TagWithCategory extends Tag {
  categoryName: string | null;
}

/** Validation schema for creating a category. Used by both frontend forms and API. */
export const createCategorySchema = z.object({
  name: z.string().min(2, "Must be at least 2 characters").max(50, "Must be at most 50 characters"),
  color: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
});

/** All fields optional — only send what changed. */
export const updateCategorySchema = createCategorySchema.partial();

/** Validation schema for creating a tag. Used by both frontend forms and API. */
export const createTagSchema = z.object({
  name: z.string().min(2, "Must be at least 2 characters").max(50, "Must be at most 50 characters"),
  categoryId: z.number({ message: "Required" }),
  icon: z.string().nullable().optional(),
});

/** All fields optional — only send what changed. */
export const updateTagSchema = createTagSchema.partial();

export type CreateCategory = z.infer<typeof createCategorySchema>;
export type UpdateCategory = z.infer<typeof updateCategorySchema>;
export type CreateTag = z.infer<typeof createTagSchema>;
export type UpdateTag = z.infer<typeof updateTagSchema>;
