/** Checks the error and its nested causes for a UNIQUE constraint violation. */
export function isUniqueViolation(e: unknown): boolean {
  let current: unknown = e;
  while (current instanceof Error) {
    if (current.message.includes("UNIQUE")) return true;
    current = (current as Error & { cause?: unknown }).cause;
  }
  return false;
}

/** Parses a route param as an integer. Returns NaN if invalid. */
export function parseId(param: string): number {
  const id = Number(param);
  return Number.isInteger(id) && id > 0 ? id : NaN;
}
