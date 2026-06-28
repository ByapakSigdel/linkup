import {
  buildAnonymizedUserFields,
  shouldPurgeCoupleData,
  COUPLE_PURGE_ORDER,
  COUPLE_PURGE_PREREQUISITES,
} from './account-deletion.helpers';

describe('account-deletion helpers', () => {
  const id = '11111111-1111-1111-1111-111111111111';
  const now = new Date('2026-06-28T00:00:00.000Z');

  it('scrubs all PII into a tombstone field set', () => {
    const f = buildAnonymizedUserFields(id, now);
    expect(f.email).toBe(`deleted+${id}@linkup.invalid`);
    expect(f.username).toBe(`deleted_${id.slice(0, 8)}`);
    expect(f.displayName).toBe('Your partner');
    expect(f.avatarUrl).toBeNull();
    expect(f.bio).toBeNull();
    expect(f.phone).toBeNull();
    expect(f.dateOfBirth).toBeNull();
    expect(f.gender).toBeNull();
    expect(f.fcmToken).toBeNull();
    expect(f.isActive).toBe(false);
    expect(f.deletedAt).toBe(now);
    expect(f.coupleId).toBeNull();
    expect(typeof f.passwordHash).toBe('string');
    expect(f.passwordHash.length).toBeGreaterThanOrEqual(32);
  });

  it('derives a fresh random password hash each call (login impossible)', () => {
    const a = buildAnonymizedUserFields(id, now);
    const b = buildAnonymizedUserFields(id, now);
    expect(a.passwordHash).not.toBe(b.passwordHash);
  });

  it('purges only when both partners are tombstoned', () => {
    expect(shouldPurgeCoupleData(null, null)).toBe(false);
    expect(shouldPurgeCoupleData(now, null)).toBe(false);
    expect(shouldPurgeCoupleData(null, now)).toBe(false);
    expect(shouldPurgeCoupleData(now, now)).toBe(true);
  });

  it('orders couple purge children-before-parents', () => {
    expect(COUPLE_PURGE_ORDER[COUPLE_PURGE_ORDER.length - 1]).toBe('couples');
    expect(COUPLE_PURGE_ORDER.indexOf('message_reactions')).toBeLessThan(
      COUPLE_PURGE_ORDER.indexOf('messages'),
    );
  });

  it('lists every couple-chained child strictly before its parent', () => {
    const before = (child: string, parent: string) => {
      const ci = COUPLE_PURGE_ORDER.indexOf(child);
      const pi = COUPLE_PURGE_ORDER.indexOf(parent);
      expect(ci).toBeGreaterThanOrEqual(0);
      expect(pi).toBeGreaterThanOrEqual(0);
      expect(ci).toBeLessThan(pi);
    };
    // chained child -> parent (all parents ultimately chain to couples)
    before('message_reactions', 'messages');
    before('date_celebrations', 'important_dates');
    before('streak_history', 'photo_streaks');
    before('playlist_tracks', 'playlists');
    before('post_likes', 'circle_posts');
    before('post_comments', 'circle_posts');
    before('circle_story_views', 'circle_stories');
    before('circle_follows', 'circles');
    before('circle_conversation_messages', 'circle_conversations');
    before('circle_conversation_reads', 'circle_conversations');
    before('circle_conversations', 'circles');
    before('circle_posts', 'circles');
    before('circle_stories', 'circles');
    before('media', 'media_albums');
    // every couple-scoped table precedes the couples row
    const couplesIdx = COUPLE_PURGE_ORDER.indexOf('couples');
    for (const t of COUPLE_PURGE_ORDER) {
      if (t !== 'couples') {
        expect(COUPLE_PURGE_ORDER.indexOf(t)).toBeLessThan(couplesIdx);
      }
    }
  });

  it('has no duplicate table names', () => {
    expect(new Set(COUPLE_PURGE_ORDER).size).toBe(COUPLE_PURGE_ORDER.length);
  });

  it('documents the cross-couple / survivor FK prerequisites for purge', () => {
    // The table-order array alone can't satisfy FKs that point INTO the couple
    // from other couples' rows or the survivor's own user row. These prerequisite
    // steps must run before COUPLE_PURGE_ORDER (see Task 4 purgeCoupleData).
    const joined = COUPLE_PURGE_PREREQUISITES.join('\n');
    // survivor archive pointer must be cleared before couples row is deleted
    expect(joined).toContain('users.archived_couple_id');
    // cross-couple circle references that have no ON DELETE action
    expect(joined).toContain('circle_story_views.viewer_circle_id');
    expect(joined).toContain('circle_conversation_reads.circle_id');
    expect(joined).toContain('circle_conversation_messages.sender_circle_id');
    expect(joined).toContain('circle_follows.follower_circle_id');
    expect(COUPLE_PURGE_PREREQUISITES.length).toBeGreaterThanOrEqual(5);
  });
});
