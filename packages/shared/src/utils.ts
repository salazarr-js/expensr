/** Converts a string to a URL-safe slug: `"Banco Galicia"` → `"banco-galicia"` */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
