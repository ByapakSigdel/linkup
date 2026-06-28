// Pure helpers for Circles DM (unit-tested directly; no DB / DI / NestJS).
//
// These live in their own file — separate from circle-dm.service.ts — so that
// circles.service.ts can import the mutual-gate helper WITHOUT creating a
// circular module import (circle-dm.service.ts imports CirclesService, so if
// circles.service.ts imported from circle-dm.service.ts the cycle would leave
// one class `undefined` at decorator time and break Nest DI).

/**
 * Order two circle ids into the canonical [lo, hi] pair so a single
 * `(circleLoId, circleHiId)` unique index makes find-or-create race-safe
 * regardless of which side initiates the conversation.
 */
export function orderPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

/** A single accepted follow edge (direction-bearing). */
export interface FollowEdgeRow {
  followerCircleId: string;
  followingCircleId: string;
}

/**
 * Pure mutual-gate decision: given the set of ACCEPTED follow edges that touch
 * the pair, return true iff there is an edge a->b AND an edge b->a. Caller is
 * responsible for only passing accepted edges. Self-pairs are never mutual.
 */
export function isMutualFromRows(
  circleAId: string,
  circleBId: string,
  rows: FollowEdgeRow[],
): boolean {
  if (circleAId === circleBId) return false;
  const aFollowsB = rows.some(
    (r) => r.followerCircleId === circleAId && r.followingCircleId === circleBId,
  );
  const bFollowsA = rows.some(
    (r) => r.followerCircleId === circleBId && r.followingCircleId === circleAId,
  );
  return aFollowsB && bFollowsA;
}
