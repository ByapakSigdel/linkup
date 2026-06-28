// Pure guard for auth — kept dependency-free (no DB / DI / NestJS) so it can be
// unit-tested directly and reused wherever a loaded user row must be checked for
// usability. Mirrors the circle-dm.helpers.ts pattern.

/**
 * A user may authenticate only if they are NOT tombstoned (deletedAt unset) and
 * still active (isActive not explicitly false). A tombstoned partner from the
 * Relationship Graveyard offboarding therefore can never resolve a token.
 */
export function isUsableAccount(u: {
  deletedAt: Date | null;
  isActive: boolean | null;
}): boolean {
  return u.deletedAt == null && u.isActive !== false;
}
