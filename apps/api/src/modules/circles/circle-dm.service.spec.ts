import { orderPair, isMutualFromRows, type FollowEdgeRow } from './circle-dm.service';

describe('orderPair', () => {
  it('returns ids as [lo, hi] regardless of argument order', () => {
    expect(orderPair('a', 'b')).toEqual(['a', 'b']);
    expect(orderPair('b', 'a')).toEqual(['a', 'b']);
  });

  it('is stable: both orderings produce the SAME pair (race-safe key)', () => {
    const x = 'f0000000-0000-0000-0000-000000000001';
    const y = 'a0000000-0000-0000-0000-000000000002';
    expect(orderPair(x, y)).toEqual(orderPair(y, x));
    const [lo, hi] = orderPair(x, y);
    expect(lo < hi).toBe(true);
  });

  it('handles equal ids by returning the same id twice', () => {
    expect(orderPair('a', 'a')).toEqual(['a', 'a']);
  });
});

describe('isMutualFromRows (mutual-follow gate)', () => {
  const A = 'circle-a';
  const B = 'circle-b';

  const edge = (follower: string, following: string): FollowEdgeRow => ({
    followerCircleId: follower,
    followingCircleId: following,
  });

  it('is mutual when accepted edges exist in BOTH directions', () => {
    expect(isMutualFromRows(A, B, [edge(A, B), edge(B, A)])).toBe(true);
  });

  it('order of the two circles does not change the result', () => {
    const rows = [edge(A, B), edge(B, A)];
    expect(isMutualFromRows(A, B, rows)).toBe(isMutualFromRows(B, A, rows));
    expect(isMutualFromRows(B, A, rows)).toBe(true);
  });

  it('is NOT mutual with only one direction (A->B)', () => {
    expect(isMutualFromRows(A, B, [edge(A, B)])).toBe(false);
  });

  it('is NOT mutual with only the reverse direction (B->A)', () => {
    expect(isMutualFromRows(A, B, [edge(B, A)])).toBe(false);
  });

  it('is NOT mutual with no edges', () => {
    expect(isMutualFromRows(A, B, [])).toBe(false);
  });

  it('ignores unrelated edges that touch only one side', () => {
    const C = 'circle-c';
    // A follows B and A follows C, but B does not follow A back.
    expect(isMutualFromRows(A, B, [edge(A, B), edge(A, C), edge(C, A)])).toBe(false);
  });

  it('a self-pair is never mutual', () => {
    expect(isMutualFromRows(A, A, [edge(A, A)])).toBe(false);
  });
});
