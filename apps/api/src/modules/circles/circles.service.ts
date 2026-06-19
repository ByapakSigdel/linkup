import {
  Injectable,
  Inject,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { and, desc, eq, ilike, inArray, lt, ne, or, sql } from 'drizzle-orm';
import { RESERVED_HANDLES } from '@linkup/validation';
import { DRIZZLE } from '../../database/database.module';
import * as schema from '../../database/schema';
import { EventsGateway } from '../../gateway/events.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { StorageService } from '../media/storage.service';

// ─── Input shapes (validated upstream by zod schemas in @linkup/validation) ──────

interface CreateCircleInput {
  handle: string;
  name?: string;
  bio?: string;
  avatarUrl?: string;
  coverImageUrl?: string;
  isPrivate?: boolean;
}

interface UpdateCircleInput {
  handle?: string;
  name?: string;
  bio?: string;
  avatarUrl?: string | null;
  coverImageUrl?: string | null;
  isPrivate?: boolean;
}

interface CreatePostInput {
  caption?: string;
  mediaUrls: string[];
  type?: string;
  metadata?: Record<string, unknown>;
}

interface CreateStoryInput {
  mediaUrl: string;
  mediaType?: string;
  caption?: string;
  durationMs?: number;
}

type FollowState = 'none' | 'pending' | 'accepted';

type CircleRow = typeof schema.circles.$inferSelect;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STORY_TTL_MS = 24 * 60 * 60 * 1000;
const REAPER_INTERVAL_MS = 15 * 60 * 1000;
const DEFAULT_PAGE = 20;
const MAX_PAGE = 50;

@Injectable()
export class CirclesService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CirclesService.name);
  private reaperTimer: NodeJS.Timeout | null = null;
  private reaperRunning = false;

  constructor(
    @Inject(DRIZZLE) private readonly db: PostgresJsDatabase<typeof schema>,
    private readonly gateway: EventsGateway,
    private readonly notifications: NotificationsService,
    private readonly storage: StorageService,
  ) {}

  // ─── Module lifecycle (stories reaper) ─────────────────────────────────────────

  onModuleInit(): void {
    // Guarded setInterval reaper — no @nestjs/schedule dependency (per spec).
    this.reaperTimer = setInterval(() => {
      void this.reapExpiredStories();
    }, REAPER_INTERVAL_MS);
    // Don't keep the event loop alive solely for the reaper.
    if (typeof this.reaperTimer.unref === 'function') this.reaperTimer.unref();
  }

  onModuleDestroy(): void {
    if (this.reaperTimer) {
      clearInterval(this.reaperTimer);
      this.reaperTimer = null;
    }
  }

  /** Best-effort deletion of expired stories + their views + media files. */
  private async reapExpiredStories(): Promise<void> {
    if (this.reaperRunning) return; // resilient to overlap
    this.reaperRunning = true;
    try {
      const expired = await this.db
        .select({ id: schema.circleStories.id, mediaUrl: schema.circleStories.mediaUrl })
        .from(schema.circleStories)
        // Compare against the DB clock — timestamp columns are stored in the
        // server's local frame, so a JS-bound Date mismatches by the tz offset.
        .where(sql`${schema.circleStories.expiresAt} < now()`)
        .limit(500);

      if (expired.length === 0) return;

      const ids = expired.map((s) => s.id);
      // Views first (FK is cascade, but be explicit & order-safe).
      await this.db
        .delete(schema.circleStoryViews)
        .where(inArray(schema.circleStoryViews.storyId, ids));
      await this.db
        .delete(schema.circleStories)
        .where(inArray(schema.circleStories.id, ids));

      // Best-effort media cleanup.
      for (const s of expired) {
        await this.deleteMediaByUrl(s.mediaUrl);
      }
      this.logger.log(`Reaped ${ids.length} expired stories`);
    } catch (err) {
      this.logger.warn(
        `Story reaper failed: ${err instanceof Error ? err.message : 'unknown error'}`,
      );
    } finally {
      this.reaperRunning = false;
    }
  }

  /** Derive a storage key from a cdnUrl and delete the underlying file (best-effort). */
  private async deleteMediaByUrl(mediaUrl: string | null | undefined): Promise<void> {
    if (!mediaUrl) return;
    const marker = '/media/files/';
    const idx = mediaUrl.indexOf(marker);
    if (idx === -1) return; // not a locally-served file
    const storageKey = decodeURIComponent(mediaUrl.slice(idx + marker.length));
    if (!storageKey) return;
    try {
      await this.storage.delete(storageKey);
    } catch {
      // best-effort
    }
  }

  // ─── Couple / circle resolution helpers ────────────────────────────────────────

  private requireCouple(coupleId: string): string {
    if (!coupleId) {
      throw new BadRequestException('You must be part of a couple');
    }
    return coupleId;
  }

  /** The circle owned by a couple, or null. */
  private async getMyCircle(coupleId: string): Promise<CircleRow | null> {
    if (!coupleId) return null;
    const [circle] = await this.db
      .select()
      .from(schema.circles)
      .where(eq(schema.circles.createdByCoupleId, coupleId))
      .limit(1);
    return circle ?? null;
  }

  /** The circle owned by a couple, or throw "create your circle first". */
  private async requireMyCircle(coupleId: string): Promise<CircleRow> {
    this.requireCouple(coupleId);
    const circle = await this.getMyCircle(coupleId);
    if (!circle) {
      throw new BadRequestException('Create your circle first');
    }
    return circle;
  }

  /** Resolve a circle by uuid (if param looks like a uuid) else by handle. */
  private async resolveCircle(idOrHandle: string): Promise<CircleRow> {
    const where = UUID_RE.test(idOrHandle)
      ? eq(schema.circles.id, idOrHandle)
      : eq(schema.circles.handle, idOrHandle.toLowerCase());
    const [circle] = await this.db.select().from(schema.circles).where(where).limit(1);
    if (!circle) throw new NotFoundException('Circle not found');
    return circle;
  }

  private async getCircleById(circleId: string): Promise<CircleRow> {
    const [circle] = await this.db
      .select()
      .from(schema.circles)
      .where(eq(schema.circles.id, circleId))
      .limit(1);
    if (!circle) throw new NotFoundException('Circle not found');
    return circle;
  }

  // ─── Privacy enforcement (server-side) ─────────────────────────────────────────

  /** The viewer's follow state toward a target circle. */
  private async resolveFollowState(
    viewerCircleId: string | null,
    target: CircleRow,
  ): Promise<FollowState> {
    if (!viewerCircleId || viewerCircleId === target.id) return 'none';
    const [edge] = await this.db
      .select({ status: schema.circleFollows.status })
      .from(schema.circleFollows)
      .where(
        and(
          eq(schema.circleFollows.followerCircleId, viewerCircleId),
          eq(schema.circleFollows.followingCircleId, target.id),
        ),
      )
      .limit(1);
    if (!edge) return 'none';
    return edge.status === 'accepted' ? 'accepted' : 'pending';
  }

  private isOwner(target: CircleRow, viewerCoupleId: string): boolean {
    return !!viewerCoupleId && target.createdByCoupleId === viewerCoupleId;
  }

  /** Owner OR public OR an accepted follower may view posts/stories/comments. */
  private async canViewPosts(
    target: CircleRow,
    viewerCoupleId: string,
    viewerCircleId: string | null,
  ): Promise<boolean> {
    if (this.isOwner(target, viewerCoupleId)) return true;
    if (target.isPrivate === false) return true;
    if (!viewerCircleId) return false;
    const state = await this.resolveFollowState(viewerCircleId, target);
    return state === 'accepted';
  }

  /** Throw ForbiddenException unless the viewer may view the target's content. */
  private async requireCanView(
    target: CircleRow,
    viewerCoupleId: string,
    viewerCircleId: string | null,
  ): Promise<void> {
    const ok = await this.canViewPosts(target, viewerCoupleId, viewerCircleId);
    if (!ok) {
      throw new ForbiddenException('This circle is private');
    }
  }

  // ─── Fan-out helpers ───────────────────────────────────────────────────────────

  /** Both partner user ids of a couple. */
  private async coupleUserIds(coupleId: string | null): Promise<string[]> {
    if (!coupleId) return [];
    const [couple] = await this.db
      .select({
        partner1Id: schema.couples.partner1Id,
        partner2Id: schema.couples.partner2Id,
      })
      .from(schema.couples)
      .where(eq(schema.couples.id, coupleId))
      .limit(1);
    if (!couple) return [];
    return [couple.partner1Id, couple.partner2Id].filter((id): id is string => !!id);
  }

  /** The owner couple's two partner user ids for a circle. */
  private async ownerCoupleUserIds(target: CircleRow): Promise<string[]> {
    return this.coupleUserIds(target.createdByCoupleId);
  }

  /**
   * All user ids of accepted-follower couples of a circle (for live feed/story
   * fan-out). Analogous to the old getMemberUserIds, but over follows.
   */
  private async resolveFollowerUserIds(circleId: string): Promise<string[]> {
    const follows = await this.db
      .select({ followerCircleId: schema.circleFollows.followerCircleId })
      .from(schema.circleFollows)
      .where(
        and(
          eq(schema.circleFollows.followingCircleId, circleId),
          eq(schema.circleFollows.status, 'accepted'),
        ),
      );
    const followerCircleIds = follows.map((f) => f.followerCircleId);
    if (followerCircleIds.length === 0) return [];

    const followerCircles = await this.db
      .select({ coupleId: schema.circles.createdByCoupleId })
      .from(schema.circles)
      .where(inArray(schema.circles.id, followerCircleIds));

    const coupleIds = Array.from(new Set(followerCircles.map((c) => c.coupleId)));
    if (coupleIds.length === 0) return [];

    const couples = await this.db
      .select({
        partner1Id: schema.couples.partner1Id,
        partner2Id: schema.couples.partner2Id,
      })
      .from(schema.couples)
      .where(inArray(schema.couples.id, coupleIds));

    const userIds = new Set<string>();
    for (const c of couples) {
      if (c.partner1Id) userIds.add(c.partner1Id);
      if (c.partner2Id) userIds.add(c.partner2Id);
    }
    return Array.from(userIds);
  }

  private fanOut(userIds: string[], event: string, data: unknown): void {
    for (const userId of userIds) {
      this.gateway.emitToUser(userId, event, data);
    }
  }

  /** Cross-partner owner sync: relay an owner-side mutation to the actor's partner. */
  private async afterOwnerMutation(
    actingUserId: string,
    kind: string,
    extra: Record<string, unknown> = {},
  ): Promise<void> {
    await this.gateway.relayToPartner(actingUserId, 'circle:self:updated', {
      kind,
      ...extra,
    });
  }

  // ─── Serialization (DB row -> API shape) ───────────────────────────────────────

  private serializeCircle(c: CircleRow) {
    return {
      id: c.id,
      handle: c.handle,
      name: c.name,
      bio: c.description ?? undefined,
      avatarUrl: c.avatarUrl ?? undefined,
      coverImageUrl: c.coverImageUrl ?? undefined,
      isPrivate: c.isPrivate ?? false,
      followerCount: c.followerCount ?? 0,
      followingCount: c.followingCount ?? 0,
      postCount: c.postCount ?? 0,
      createdByCoupleId: c.createdByCoupleId,
      createdByUserId: c.createdByUserId,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    };
  }

  private circleSummary(c: {
    id: string;
    handle: string | null;
    name: string;
    avatarUrl: string | null;
  }) {
    return {
      id: c.id,
      handle: c.handle,
      name: c.name,
      avatarUrl: c.avatarUrl ?? undefined,
    };
  }

  // ─── Cursor helpers (base64 of createdAt + id) ─────────────────────────────────

  private encodeCursor(createdAt: Date | null, id: string): string {
    const ts = createdAt ? createdAt.getTime() : 0;
    return Buffer.from(`${ts}:${id}`).toString('base64');
  }

  private decodeCursor(cursor?: string): { ts: number; id: string } | null {
    if (!cursor) return null;
    try {
      const raw = Buffer.from(cursor, 'base64').toString('utf8');
      const sep = raw.lastIndexOf(':');
      if (sep === -1) return null;
      const ts = Number(raw.slice(0, sep));
      const id = raw.slice(sep + 1);
      if (!Number.isFinite(ts) || !id) return null;
      return { ts, id };
    } catch {
      return null;
    }
  }

  private clampLimit(limit?: number): number {
    if (!limit || limit < 1) return DEFAULT_PAGE;
    return Math.min(limit, MAX_PAGE);
  }

  private normalizeHandle(handle: string): string {
    const h = handle.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,30}$/.test(h)) {
      throw new BadRequestException(
        'Handle must be 3-30 lowercase letters, numbers or underscores',
      );
    }
    if ((RESERVED_HANDLES as readonly string[]).includes(h)) {
      throw new BadRequestException('That handle is reserved');
    }
    return h;
  }

  private async assertHandleAvailable(handle: string, exceptCircleId?: string): Promise<void> {
    const [existing] = await this.db
      .select({ id: schema.circles.id })
      .from(schema.circles)
      .where(eq(schema.circles.handle, handle))
      .limit(1);
    if (existing && existing.id !== exceptCircleId) {
      throw new ConflictException('That handle is already taken');
    }
  }

  // ─── 1. Create circle (opt-in) ─────────────────────────────────────────────────

  async createCircle(userId: string, coupleId: string, input: CreateCircleInput) {
    this.requireCouple(coupleId);

    const existing = await this.getMyCircle(coupleId);
    if (existing) {
      throw new ConflictException('Your couple already has a circle');
    }

    const handle = this.normalizeHandle(input.handle);
    await this.assertHandleAvailable(handle);

    const [couple] = await this.db
      .select({
        coupleName: schema.couples.coupleName,
        coupleAvatarUrl: schema.couples.coupleAvatarUrl,
      })
      .from(schema.couples)
      .where(eq(schema.couples.id, coupleId))
      .limit(1);

    const name = input.name?.trim() || couple?.coupleName || handle;
    const avatarUrl = input.avatarUrl ?? couple?.coupleAvatarUrl ?? null;

    try {
      const [circle] = await this.db
        .insert(schema.circles)
        .values({
          name,
          handle,
          description: input.bio ?? null,
          avatarUrl,
          coverImageUrl: input.coverImageUrl ?? null,
          createdByCoupleId: coupleId,
          createdByUserId: userId,
          isPrivate: input.isPrivate ?? false,
          followerCount: 0,
          followingCount: 0,
          postCount: 0,
        })
        .returning();

      if (!circle) throw new BadRequestException('Failed to create circle');

      await this.afterOwnerMutation(userId, 'created', { circleId: circle.id });
      return { circle: this.serializeCircle(circle) };
    } catch (err: unknown) {
      // Both-partners-opt-in race: UNIQUE(created_by_couple_id) / handle unique.
      const again = await this.getMyCircle(coupleId);
      if (again) {
        throw new ConflictException('Your couple already has a circle');
      }
      if (this.isUniqueViolation(err)) {
        throw new ConflictException('That handle is already taken');
      }
      throw err;
    }
  }

  private isUniqueViolation(err: unknown): boolean {
    return (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code?: string }).code === '23505'
    );
  }

  // ─── 2. GET /circles/me ────────────────────────────────────────────────────────

  async getMyProfile(coupleId: string) {
    this.requireCouple(coupleId);
    const circle = await this.getMyCircle(coupleId);
    if (!circle) {
      return { circle: null, stats: null, pendingRequestCount: 0 };
    }

    const [pending] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.circleFollows)
      .where(
        and(
          eq(schema.circleFollows.followingCircleId, circle.id),
          eq(schema.circleFollows.status, 'pending'),
        ),
      );

    return {
      circle: this.serializeCircle(circle),
      stats: {
        followerCount: circle.followerCount ?? 0,
        followingCount: circle.followingCount ?? 0,
        postCount: circle.postCount ?? 0,
      },
      pendingRequestCount: pending?.count ?? 0,
    };
  }

  // ─── 3. PATCH /circles/me ──────────────────────────────────────────────────────

  async updateMyCircle(userId: string, coupleId: string, input: UpdateCircleInput) {
    const circle = await this.requireMyCircle(coupleId);

    const set: Partial<typeof schema.circles.$inferInsert> = { updatedAt: new Date() };

    if (input.handle !== undefined) {
      const handle = this.normalizeHandle(input.handle);
      await this.assertHandleAvailable(handle, circle.id);
      set.handle = handle;
    }
    if (input.name !== undefined) set.name = input.name;
    if (input.bio !== undefined) set.description = input.bio;
    if (input.avatarUrl !== undefined) set.avatarUrl = input.avatarUrl;
    if (input.coverImageUrl !== undefined) set.coverImageUrl = input.coverImageUrl;

    // Privacy transition: private -> public bulk-accepts all pending follows.
    const goingPublic =
      input.isPrivate === false && circle.isPrivate === true;
    if (input.isPrivate !== undefined) set.isPrivate = input.isPrivate;

    let updated: CircleRow | undefined;
    try {
      [updated] = await this.db
        .update(schema.circles)
        .set(set)
        .where(eq(schema.circles.id, circle.id))
        .returning();
    } catch (err) {
      if (this.isUniqueViolation(err)) {
        throw new ConflictException('That handle is already taken');
      }
      throw err;
    }

    if (goingPublic) {
      await this.bulkAcceptPending(circle.id);
      // Re-read counts that changed.
      updated = await this.getCircleById(circle.id);
    }

    await this.afterOwnerMutation(userId, 'profile', { circleId: circle.id });
    return { circle: this.serializeCircle(updated ?? circle) };
  }

  /** Accept every pending follow request for a circle (private -> public flip). */
  private async bulkAcceptPending(circleId: string): Promise<void> {
    const pending = await this.db
      .select({
        id: schema.circleFollows.id,
        followerCircleId: schema.circleFollows.followerCircleId,
      })
      .from(schema.circleFollows)
      .where(
        and(
          eq(schema.circleFollows.followingCircleId, circleId),
          eq(schema.circleFollows.status, 'pending'),
        ),
      );
    if (pending.length === 0) return;

    const now = new Date();
    await this.db
      .update(schema.circleFollows)
      .set({ status: 'accepted', acceptedAt: now })
      .where(
        and(
          eq(schema.circleFollows.followingCircleId, circleId),
          eq(schema.circleFollows.status, 'pending'),
        ),
      );

    // Bump the target's followerCount, and each follower's followingCount.
    await this.db
      .update(schema.circles)
      .set({ followerCount: sql`${schema.circles.followerCount} + ${pending.length}` })
      .where(eq(schema.circles.id, circleId));

    for (const p of pending) {
      await this.db
        .update(schema.circles)
        .set({ followingCount: sql`${schema.circles.followingCount} + 1` })
        .where(eq(schema.circles.id, p.followerCircleId));

      const followerUserIds = await this.coupleUserIdsForCircle(p.followerCircleId);
      this.fanOut(followerUserIds, 'follow:accepted', { circleId });
    }
  }

  private async coupleUserIdsForCircle(circleId: string): Promise<string[]> {
    const [c] = await this.db
      .select({ coupleId: schema.circles.createdByCoupleId })
      .from(schema.circles)
      .where(eq(schema.circles.id, circleId))
      .limit(1);
    return this.coupleUserIds(c?.coupleId ?? null);
  }

  // ─── 4. DELETE /circles/me ─────────────────────────────────────────────────────

  async deleteMyCircle(userId: string, coupleId: string) {
    const circle = await this.requireMyCircle(coupleId);
    // Cascade handles posts/follows/stories (FK ON DELETE cascade).
    await this.db.delete(schema.circles).where(eq(schema.circles.id, circle.id));
    await this.afterOwnerMutation(userId, 'deleted', { circleId: circle.id });
    return { success: true };
  }

  // ─── 5. GET /circles/:idOrHandle ───────────────────────────────────────────────

  async getProfile(idOrHandle: string, coupleId: string) {
    const target = await this.resolveCircle(idOrHandle);
    const viewerCircle = await this.getMyCircle(coupleId);
    const isOwner = this.isOwner(target, coupleId);
    const followState = await this.resolveFollowState(viewerCircle?.id ?? null, target);
    const canView = await this.canViewPosts(target, coupleId, viewerCircle?.id ?? null);

    return {
      circle: this.serializeCircle(target),
      isOwner,
      followState,
      canViewPosts: canView,
    };
  }

  // ─── 6. GET /circles/:id/posts ─────────────────────────────────────────────────

  async listPosts(
    idOrHandle: string,
    userId: string,
    coupleId: string,
    cursor?: string,
    limit?: number,
  ) {
    const target = await this.resolveCircle(idOrHandle);
    const viewerCircle = await this.getMyCircle(coupleId);
    await this.requireCanView(target, coupleId, viewerCircle?.id ?? null);

    const take = this.clampLimit(limit);
    const decoded = this.decodeCursor(cursor);

    const conditions = [eq(schema.circlePosts.circleId, target.id)];
    if (decoded) {
      conditions.push(
        sql`(${schema.circlePosts.createdAt}, ${schema.circlePosts.id}) < (to_timestamp(${
          decoded.ts / 1000
        }), ${decoded.id})`,
      );
    }

    const rows = await this.db
      .select({
        id: schema.circlePosts.id,
        circleId: schema.circlePosts.circleId,
        coupleId: schema.circlePosts.coupleId,
        authorId: schema.circlePosts.authorId,
        content: schema.circlePosts.content,
        type: schema.circlePosts.type,
        mediaUrls: schema.circlePosts.mediaUrls,
        metadata: schema.circlePosts.metadata,
        likeCount: schema.circlePosts.likeCount,
        commentCount: schema.circlePosts.commentCount,
        createdAt: schema.circlePosts.createdAt,
        authorName: schema.users.displayName,
        authorAvatarUrl: schema.users.avatarUrl,
      })
      .from(schema.circlePosts)
      .leftJoin(schema.users, eq(schema.circlePosts.authorId, schema.users.id))
      .where(and(...conditions))
      .orderBy(desc(schema.circlePosts.createdAt), desc(schema.circlePosts.id))
      .limit(take + 1);

    const hasMore = rows.length > take;
    const sliced = hasMore ? rows.slice(0, take) : rows;
    const posts = await this.attachLikedByMe(sliced.map((p) => this.serializePost(p)), userId);
    const last = sliced[sliced.length - 1];
    const nextCursor = hasMore && last ? this.encodeCursor(last.createdAt, last.id) : null;

    return { posts, nextCursor };
  }

  private serializePost(p: {
    id: string;
    circleId: string;
    coupleId: string;
    authorId: string;
    content: string | null;
    type: string | null;
    mediaUrls: string[] | null;
    metadata: Record<string, unknown> | null;
    likeCount: number | null;
    commentCount: number | null;
    createdAt: Date | null;
    authorName?: string | null;
    authorAvatarUrl?: string | null;
  }) {
    return {
      id: p.id,
      circleId: p.circleId,
      coupleId: p.coupleId,
      authorId: p.authorId,
      caption: p.content ?? undefined,
      type: p.type ?? 'photo',
      mediaUrls: p.mediaUrls ?? [],
      metadata: p.metadata ?? undefined,
      likeCount: p.likeCount ?? 0,
      commentCount: p.commentCount ?? 0,
      createdAt: p.createdAt,
      authorName: p.authorName ?? null,
      authorAvatarUrl: p.authorAvatarUrl ?? null,
    };
  }

  // ─── 7. POST /circles/me/posts ─────────────────────────────────────────────────

  async createPost(userId: string, coupleId: string, input: CreatePostInput) {
    const circle = await this.requireMyCircle(coupleId);

    if (!input.mediaUrls || input.mediaUrls.length === 0) {
      throw new BadRequestException('At least one media item is required');
    }

    const [post] = await this.db
      .insert(schema.circlePosts)
      .values({
        circleId: circle.id, // server-forced: never trust a body circleId
        coupleId,
        authorId: userId,
        content: input.caption ?? null,
        type: input.type ?? 'photo',
        mediaUrls: input.mediaUrls,
        metadata: input.metadata,
        likeCount: 0,
        commentCount: 0,
      })
      .returning();

    await this.db
      .update(schema.circles)
      .set({ postCount: sql`${schema.circles.postCount} + 1`, updatedAt: new Date() })
      .where(eq(schema.circles.id, circle.id));

    const serialized = {
      ...this.serializePost(post!),
      circle: this.circleSummary(circle),
    };

    // Fan out to accepted followers for live feed prepend.
    const followerUserIds = await this.resolveFollowerUserIds(circle.id);
    this.fanOut(followerUserIds, 'circle:post:new', {
      circleId: circle.id,
      post: serialized,
    });
    await this.afterOwnerMutation(userId, 'post:new', { circleId: circle.id, postId: post!.id });

    return { post: serialized };
  }

  // ─── 8. DELETE /circles/me/posts/:postId ───────────────────────────────────────

  async deletePost(userId: string, coupleId: string, postId: string) {
    const circle = await this.requireMyCircle(coupleId);

    const [post] = await this.db
      .select()
      .from(schema.circlePosts)
      .where(eq(schema.circlePosts.id, postId))
      .limit(1);
    if (!post) throw new NotFoundException('Post not found');
    if (post.circleId !== circle.id) {
      throw new ForbiddenException('You can only delete posts on your own circle');
    }

    await this.db.delete(schema.circlePosts).where(eq(schema.circlePosts.id, postId));
    await this.db
      .update(schema.circles)
      .set({
        postCount: sql`GREATEST(${schema.circles.postCount} - 1, 0)`,
        updatedAt: new Date(),
      })
      .where(eq(schema.circles.id, circle.id));

    const followerUserIds = await this.resolveFollowerUserIds(circle.id);
    this.fanOut(followerUserIds, 'circle:post:deleted', { circleId: circle.id, postId });
    await this.afterOwnerMutation(userId, 'post:deleted', { circleId: circle.id, postId });

    return { success: true };
  }

  // ─── 9. POST /circles/:id/posts/:postId/like ───────────────────────────────────

  async toggleLike(idOrHandle: string, postId: string, userId: string, coupleId: string) {
    const target = await this.resolveCircle(idOrHandle);
    const viewerCircle = await this.getMyCircle(coupleId);
    await this.requireCanView(target, coupleId, viewerCircle?.id ?? null);

    const [post] = await this.db
      .select()
      .from(schema.circlePosts)
      .where(and(eq(schema.circlePosts.id, postId), eq(schema.circlePosts.circleId, target.id)))
      .limit(1);
    if (!post) throw new NotFoundException('Post not found');

    const [existing] = await this.db
      .select({ id: schema.postLikes.id })
      .from(schema.postLikes)
      .where(and(eq(schema.postLikes.postId, postId), eq(schema.postLikes.userId, userId)))
      .limit(1);

    let liked: boolean;
    if (existing) {
      await this.db.delete(schema.postLikes).where(eq(schema.postLikes.id, existing.id));
      await this.db
        .update(schema.circlePosts)
        .set({ likeCount: sql`GREATEST(${schema.circlePosts.likeCount} - 1, 0)` })
        .where(eq(schema.circlePosts.id, postId));
      liked = false;
    } else {
      try {
        await this.db.insert(schema.postLikes).values({ postId, userId });
        await this.db
          .update(schema.circlePosts)
          .set({ likeCount: sql`${schema.circlePosts.likeCount} + 1` })
          .where(eq(schema.circlePosts.id, postId));
      } catch (err) {
        if (!this.isUniqueViolation(err)) throw err; // concurrent like, ignore
      }
      liked = true;
    }

    const [updated] = await this.db
      .select({ likeCount: schema.circlePosts.likeCount })
      .from(schema.circlePosts)
      .where(eq(schema.circlePosts.id, postId))
      .limit(1);
    const likeCount = updated?.likeCount ?? 0;

    // Emit to post-owner couple users.
    const ownerUserIds = await this.ownerCoupleUserIds(target);
    this.fanOut(ownerUserIds, 'circle:post:liked', {
      circleId: target.id,
      postId,
      userId,
      liked,
      likeCount,
    });

    // Notify owner on a new like (not on unlike, not on self-like).
    if (liked && !this.isOwner(target, coupleId)) {
      const actor = await this.displayName(userId);
      for (const ownerUserId of ownerUserIds) {
        await this.notifications.create({
          userId: ownerUserId,
          coupleId: target.createdByCoupleId,
          type: 'circle_post_like',
          title: 'New like',
          body: `${actor} liked your post`,
          actionType: 'circle',
          actionData: { circleId: target.id, postId },
        });
      }
    }

    return { liked, likeCount };
  }

  // ─── 10. GET /circles/:id/posts/:postId/comments ───────────────────────────────

  async listComments(
    idOrHandle: string,
    postId: string,
    coupleId: string,
    cursor?: string,
    limit?: number,
  ) {
    const target = await this.resolveCircle(idOrHandle);
    const viewerCircle = await this.getMyCircle(coupleId);
    await this.requireCanView(target, coupleId, viewerCircle?.id ?? null);

    const [post] = await this.db
      .select({ id: schema.circlePosts.id })
      .from(schema.circlePosts)
      .where(and(eq(schema.circlePosts.id, postId), eq(schema.circlePosts.circleId, target.id)))
      .limit(1);
    if (!post) throw new NotFoundException('Post not found');

    const take = this.clampLimit(limit);
    const decoded = this.decodeCursor(cursor);
    const conditions = [eq(schema.postComments.postId, postId)];
    if (decoded) {
      conditions.push(
        sql`(${schema.postComments.createdAt}, ${schema.postComments.id}) > (to_timestamp(${
          decoded.ts / 1000
        }), ${decoded.id})`,
      );
    }

    const rows = await this.db
      .select({
        id: schema.postComments.id,
        postId: schema.postComments.postId,
        userId: schema.postComments.userId,
        content: schema.postComments.content,
        createdAt: schema.postComments.createdAt,
        authorName: schema.users.displayName,
        authorAvatarUrl: schema.users.avatarUrl,
        authorUsername: schema.users.username,
      })
      .from(schema.postComments)
      .leftJoin(schema.users, eq(schema.postComments.userId, schema.users.id))
      .where(and(...conditions))
      .orderBy(schema.postComments.createdAt, schema.postComments.id)
      .limit(take + 1);

    const hasMore = rows.length > take;
    const comments = hasMore ? rows.slice(0, take) : rows;
    const last = comments[comments.length - 1];
    const nextCursor = hasMore && last ? this.encodeCursor(last.createdAt, last.id) : null;

    return { comments, nextCursor };
  }

  // ─── 11. POST /circles/:id/posts/:postId/comments ──────────────────────────────

  async addComment(
    idOrHandle: string,
    postId: string,
    userId: string,
    coupleId: string,
    content: string,
  ) {
    const target = await this.resolveCircle(idOrHandle);
    const viewerCircle = await this.getMyCircle(coupleId);
    await this.requireCanView(target, coupleId, viewerCircle?.id ?? null);

    if (!content || !content.trim()) {
      throw new BadRequestException('Comment content is required');
    }

    const [post] = await this.db
      .select({ id: schema.circlePosts.id })
      .from(schema.circlePosts)
      .where(and(eq(schema.circlePosts.id, postId), eq(schema.circlePosts.circleId, target.id)))
      .limit(1);
    if (!post) throw new NotFoundException('Post not found');

    const [comment] = await this.db
      .insert(schema.postComments)
      .values({ postId, userId, content: content.trim() })
      .returning();

    await this.db
      .update(schema.circlePosts)
      .set({ commentCount: sql`${schema.circlePosts.commentCount} + 1` })
      .where(eq(schema.circlePosts.id, postId));

    // Emit to post-owner couple users.
    const ownerUserIds = await this.ownerCoupleUserIds(target);
    this.fanOut(ownerUserIds, 'circle:comment:new', {
      circleId: target.id,
      postId,
      comment,
    });

    // Notify owner (not on self-comment).
    if (!this.isOwner(target, coupleId)) {
      const actor = await this.displayName(userId);
      for (const ownerUserId of ownerUserIds) {
        await this.notifications.create({
          userId: ownerUserId,
          coupleId: target.createdByCoupleId,
          type: 'circle_comment',
          title: 'New comment',
          body: `${actor} commented on your post`,
          actionType: 'circle',
          actionData: { circleId: target.id, postId },
        });
      }
    }

    return { comment };
  }

  // ─── 12. DELETE /circles/:id/posts/:postId/comments/:commentId ─────────────────

  async deleteComment(
    idOrHandle: string,
    postId: string,
    commentId: string,
    userId: string,
    coupleId: string,
  ) {
    const target = await this.resolveCircle(idOrHandle);

    const [post] = await this.db
      .select({ id: schema.circlePosts.id, circleId: schema.circlePosts.circleId })
      .from(schema.circlePosts)
      .where(and(eq(schema.circlePosts.id, postId), eq(schema.circlePosts.circleId, target.id)))
      .limit(1);
    if (!post) throw new NotFoundException('Post not found');

    const [comment] = await this.db
      .select()
      .from(schema.postComments)
      .where(and(eq(schema.postComments.id, commentId), eq(schema.postComments.postId, postId)))
      .limit(1);
    if (!comment) throw new NotFoundException('Comment not found');

    // Author OR post-owner couple may delete.
    const isAuthor = comment.userId === userId;
    const isPostOwner = this.isOwner(target, coupleId);
    if (!isAuthor && !isPostOwner) {
      throw new ForbiddenException('You cannot delete this comment');
    }

    await this.db.delete(schema.postComments).where(eq(schema.postComments.id, commentId));
    await this.db
      .update(schema.circlePosts)
      .set({ commentCount: sql`GREATEST(${schema.circlePosts.commentCount} - 1, 0)` })
      .where(eq(schema.circlePosts.id, postId));

    return { success: true };
  }

  // ─── 13. POST /circles/:id/follow ──────────────────────────────────────────────

  async follow(idOrHandle: string, userId: string, coupleId: string) {
    const myCircle = await this.requireMyCircle(coupleId); // 400 'create your circle first'
    const target = await this.resolveCircle(idOrHandle);

    if (target.id === myCircle.id) {
      throw new BadRequestException('You cannot follow your own circle');
    }

    const [existing] = await this.db
      .select()
      .from(schema.circleFollows)
      .where(
        and(
          eq(schema.circleFollows.followerCircleId, myCircle.id),
          eq(schema.circleFollows.followingCircleId, target.id),
        ),
      )
      .limit(1);
    if (existing) {
      return { follow: { status: existing.status } };
    }

    const isPublic = target.isPrivate === false;
    const status = isPublic ? 'accepted' : 'pending';
    const now = new Date();

    let follow: typeof schema.circleFollows.$inferSelect | undefined;
    try {
      [follow] = await this.db
        .insert(schema.circleFollows)
        .values({
          followerCircleId: myCircle.id,
          followingCircleId: target.id,
          status,
          requestedByUserId: userId,
          acceptedAt: isPublic ? now : null,
        })
        .returning();
    } catch (err) {
      if (this.isUniqueViolation(err)) {
        const [again] = await this.db
          .select({ status: schema.circleFollows.status })
          .from(schema.circleFollows)
          .where(
            and(
              eq(schema.circleFollows.followerCircleId, myCircle.id),
              eq(schema.circleFollows.followingCircleId, target.id),
            ),
          )
          .limit(1);
        return { follow: { status: again?.status ?? status } };
      }
      throw err;
    }

    const followerSummary = this.circleSummary(myCircle);
    const ownerUserIds = await this.ownerCoupleUserIds(target);
    const actor = await this.displayName(userId);

    if (isPublic) {
      await this.db
        .update(schema.circles)
        .set({ followerCount: sql`${schema.circles.followerCount} + 1` })
        .where(eq(schema.circles.id, target.id));
      await this.db
        .update(schema.circles)
        .set({ followingCount: sql`${schema.circles.followingCount} + 1` })
        .where(eq(schema.circles.id, myCircle.id));

      const [updatedTarget] = await this.db
        .select({ followerCount: schema.circles.followerCount })
        .from(schema.circles)
        .where(eq(schema.circles.id, target.id))
        .limit(1);

      this.fanOut(ownerUserIds, 'follow:new', {
        circleId: target.id,
        followerCircle: followerSummary,
        followerCount: updatedTarget?.followerCount ?? 0,
      });
      for (const ownerUserId of ownerUserIds) {
        await this.notifications.create({
          userId: ownerUserId,
          coupleId: target.createdByCoupleId,
          type: 'circle_follow',
          title: 'New follower',
          body: `${myCircle.name} (${actor}) started following you`,
          actionType: 'circle',
          actionData: { circleId: target.id, handle: myCircle.handle ?? undefined },
        });
      }
    } else {
      const [pending] = await this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.circleFollows)
        .where(
          and(
            eq(schema.circleFollows.followingCircleId, target.id),
            eq(schema.circleFollows.status, 'pending'),
          ),
        );
      this.fanOut(ownerUserIds, 'follow:request', {
        followId: follow!.id,
        followerCircle: followerSummary,
        pendingRequestCount: pending?.count ?? 0,
      });
      for (const ownerUserId of ownerUserIds) {
        await this.notifications.create({
          userId: ownerUserId,
          coupleId: target.createdByCoupleId,
          type: 'circle_follow_request',
          title: 'Follow request',
          body: `${myCircle.name} (${actor}) requested to follow you`,
          actionType: 'circle',
          actionData: { circleId: target.id, handle: myCircle.handle ?? undefined },
        });
      }
    }

    return { follow: { status } };
  }

  // ─── 14. DELETE /circles/:id/follow ────────────────────────────────────────────

  async unfollow(idOrHandle: string, coupleId: string) {
    const myCircle = await this.requireMyCircle(coupleId);
    const target = await this.resolveCircle(idOrHandle);

    const [existing] = await this.db
      .select()
      .from(schema.circleFollows)
      .where(
        and(
          eq(schema.circleFollows.followerCircleId, myCircle.id),
          eq(schema.circleFollows.followingCircleId, target.id),
        ),
      )
      .limit(1);
    if (!existing) return { success: true };

    await this.db.delete(schema.circleFollows).where(eq(schema.circleFollows.id, existing.id));

    if (existing.status === 'accepted') {
      await this.db
        .update(schema.circles)
        .set({ followerCount: sql`GREATEST(${schema.circles.followerCount} - 1, 0)` })
        .where(eq(schema.circles.id, target.id));
      await this.db
        .update(schema.circles)
        .set({ followingCount: sql`GREATEST(${schema.circles.followingCount} - 1, 0)` })
        .where(eq(schema.circles.id, myCircle.id));

      const [updatedTarget] = await this.db
        .select({ followerCount: schema.circles.followerCount })
        .from(schema.circles)
        .where(eq(schema.circles.id, target.id))
        .limit(1);

      const ownerUserIds = await this.ownerCoupleUserIds(target);
      this.fanOut(ownerUserIds, 'follow:removed', {
        circleId: target.id,
        followerCount: updatedTarget?.followerCount ?? 0,
      });
    }

    return { success: true };
  }

  // ─── 15. GET /circles/me/followers ─────────────────────────────────────────────

  async listFollowers(coupleId: string, cursor?: string, limit?: number) {
    const myCircle = await this.requireMyCircle(coupleId);
    return this.listFollowEdges('followers', myCircle.id, cursor, limit);
  }

  // ─── 16. GET /circles/me/following ─────────────────────────────────────────────

  async listFollowing(coupleId: string, cursor?: string, limit?: number) {
    const myCircle = await this.requireMyCircle(coupleId);
    return this.listFollowEdges('following', myCircle.id, cursor, limit);
  }

  private async listFollowEdges(
    direction: 'followers' | 'following',
    myCircleId: string,
    cursor?: string,
    limit?: number,
  ) {
    const take = this.clampLimit(limit);
    const decoded = this.decodeCursor(cursor);

    // followers: edges where following=me, list the follower circle.
    // following: edges where follower=me, list the following circle.
    const matchCol =
      direction === 'followers'
        ? schema.circleFollows.followingCircleId
        : schema.circleFollows.followerCircleId;
    const otherCol =
      direction === 'followers'
        ? schema.circleFollows.followerCircleId
        : schema.circleFollows.followingCircleId;

    const conditions = [eq(matchCol, myCircleId), eq(schema.circleFollows.status, 'accepted')];
    if (decoded) {
      conditions.push(
        sql`(${schema.circleFollows.createdAt}, ${schema.circleFollows.id}) < (to_timestamp(${
          decoded.ts / 1000
        }), ${decoded.id})`,
      );
    }

    const rows = await this.db
      .select({
        followId: schema.circleFollows.id,
        createdAt: schema.circleFollows.createdAt,
        circleId: schema.circles.id,
        handle: schema.circles.handle,
        name: schema.circles.name,
        avatarUrl: schema.circles.avatarUrl,
      })
      .from(schema.circleFollows)
      .innerJoin(schema.circles, eq(otherCol, schema.circles.id))
      .where(and(...conditions))
      .orderBy(desc(schema.circleFollows.createdAt), desc(schema.circleFollows.id))
      .limit(take + 1);

    const hasMore = rows.length > take;
    const sliced = hasMore ? rows.slice(0, take) : rows;
    const list = sliced.map((r) =>
      this.circleSummary({ id: r.circleId, handle: r.handle, name: r.name, avatarUrl: r.avatarUrl }),
    );
    const last = sliced[sliced.length - 1];
    const nextCursor =
      hasMore && last ? this.encodeCursor(last.createdAt, last.followId) : null;

    return direction === 'followers'
      ? { followers: list, nextCursor }
      : { following: list, nextCursor };
  }

  // ─── 17. GET /circles/me/requests ──────────────────────────────────────────────

  async listRequests(coupleId: string, cursor?: string, limit?: number) {
    const myCircle = await this.requireMyCircle(coupleId);
    const take = this.clampLimit(limit);
    const decoded = this.decodeCursor(cursor);

    const conditions = [
      eq(schema.circleFollows.followingCircleId, myCircle.id),
      eq(schema.circleFollows.status, 'pending'),
    ];
    if (decoded) {
      conditions.push(
        sql`(${schema.circleFollows.createdAt}, ${schema.circleFollows.id}) < (to_timestamp(${
          decoded.ts / 1000
        }), ${decoded.id})`,
      );
    }

    const rows = await this.db
      .select({
        followId: schema.circleFollows.id,
        createdAt: schema.circleFollows.createdAt,
        circleId: schema.circles.id,
        handle: schema.circles.handle,
        name: schema.circles.name,
        avatarUrl: schema.circles.avatarUrl,
      })
      .from(schema.circleFollows)
      .innerJoin(schema.circles, eq(schema.circleFollows.followerCircleId, schema.circles.id))
      .where(and(...conditions))
      .orderBy(desc(schema.circleFollows.createdAt), desc(schema.circleFollows.id))
      .limit(take + 1);

    const hasMore = rows.length > take;
    const sliced = hasMore ? rows.slice(0, take) : rows;
    const requests = sliced.map((r) => ({
      followId: r.followId,
      circle: this.circleSummary({
        id: r.circleId,
        handle: r.handle,
        name: r.name,
        avatarUrl: r.avatarUrl,
      }),
      createdAt: r.createdAt,
    }));
    const last = sliced[sliced.length - 1];
    const nextCursor =
      hasMore && last ? this.encodeCursor(last.createdAt, last.followId) : null;

    return { requests, nextCursor };
  }

  // ─── 18. POST /circles/me/requests/:followId/accept ────────────────────────────

  async acceptRequest(userId: string, coupleId: string, followId: string) {
    const myCircle = await this.requireMyCircle(coupleId);

    const [follow] = await this.db
      .select()
      .from(schema.circleFollows)
      .where(eq(schema.circleFollows.id, followId))
      .limit(1);
    if (!follow) throw new NotFoundException('Follow request not found');
    if (follow.followingCircleId !== myCircle.id) {
      throw new ForbiddenException('That request is not for your circle');
    }
    if (follow.status !== 'pending') {
      throw new BadRequestException('That request is no longer pending');
    }

    const now = new Date();
    const [updated] = await this.db
      .update(schema.circleFollows)
      .set({ status: 'accepted', acceptedAt: now })
      .where(eq(schema.circleFollows.id, followId))
      .returning();

    await this.db
      .update(schema.circles)
      .set({ followerCount: sql`${schema.circles.followerCount} + 1` })
      .where(eq(schema.circles.id, myCircle.id));
    await this.db
      .update(schema.circles)
      .set({ followingCount: sql`${schema.circles.followingCount} + 1` })
      .where(eq(schema.circles.id, follow.followerCircleId));

    const followerUserIds = await this.coupleUserIdsForCircle(follow.followerCircleId);
    this.fanOut(followerUserIds, 'follow:accepted', { circleId: myCircle.id });
    await this.afterOwnerMutation(userId, 'request:accepted', { followId });

    return { follow: updated };
  }

  // ─── 19. POST /circles/me/requests/:followId/decline ───────────────────────────

  async declineRequest(userId: string, coupleId: string, followId: string) {
    const myCircle = await this.requireMyCircle(coupleId);

    const [follow] = await this.db
      .select()
      .from(schema.circleFollows)
      .where(eq(schema.circleFollows.id, followId))
      .limit(1);
    if (!follow) throw new NotFoundException('Follow request not found');
    if (follow.followingCircleId !== myCircle.id) {
      throw new ForbiddenException('That request is not for your circle');
    }

    await this.db.delete(schema.circleFollows).where(eq(schema.circleFollows.id, followId));
    await this.afterOwnerMutation(userId, 'request:declined', { followId });

    return { success: true };
  }

  // ─── 20. GET /circles/feed ─────────────────────────────────────────────────────

  async getFeed(userId: string, coupleId: string, cursor?: string, limit?: number) {
    const myCircle = await this.getMyCircle(coupleId);
    if (!myCircle) {
      // No circle => nothing to follow, empty feed.
      return { posts: [], nextCursor: null };
    }

    const take = this.clampLimit(limit);
    const decoded = this.decodeCursor(cursor);

    // Source circle ids: my own + accepted-followed circles.
    const followed = await this.db
      .select({ followingCircleId: schema.circleFollows.followingCircleId })
      .from(schema.circleFollows)
      .where(
        and(
          eq(schema.circleFollows.followerCircleId, myCircle.id),
          eq(schema.circleFollows.status, 'accepted'),
        ),
      );
    const sourceIds = Array.from(
      new Set<string>([myCircle.id, ...followed.map((f) => f.followingCircleId)]),
    );

    const conditions = [inArray(schema.circlePosts.circleId, sourceIds)];
    if (decoded) {
      conditions.push(
        sql`(${schema.circlePosts.createdAt}, ${schema.circlePosts.id}) < (to_timestamp(${
          decoded.ts / 1000
        }), ${decoded.id})`,
      );
    }

    const rows = await this.db
      .select({
        id: schema.circlePosts.id,
        circleId: schema.circlePosts.circleId,
        coupleId: schema.circlePosts.coupleId,
        authorId: schema.circlePosts.authorId,
        content: schema.circlePosts.content,
        type: schema.circlePosts.type,
        mediaUrls: schema.circlePosts.mediaUrls,
        metadata: schema.circlePosts.metadata,
        likeCount: schema.circlePosts.likeCount,
        commentCount: schema.circlePosts.commentCount,
        createdAt: schema.circlePosts.createdAt,
        authorName: schema.users.displayName,
        authorAvatarUrl: schema.users.avatarUrl,
        circleHandle: schema.circles.handle,
        circleName: schema.circles.name,
        circleAvatarUrl: schema.circles.avatarUrl,
      })
      .from(schema.circlePosts)
      .innerJoin(schema.circles, eq(schema.circlePosts.circleId, schema.circles.id))
      .leftJoin(schema.users, eq(schema.circlePosts.authorId, schema.users.id))
      .where(and(...conditions))
      .orderBy(desc(schema.circlePosts.createdAt), desc(schema.circlePosts.id))
      .limit(take + 1);

    const hasMore = rows.length > take;
    const sliced = hasMore ? rows.slice(0, take) : rows;
    const base = sliced.map((r) => ({
      ...this.serializePost(r),
      circle: this.circleSummary({
        id: r.circleId,
        handle: r.circleHandle,
        name: r.circleName,
        avatarUrl: r.circleAvatarUrl,
      }),
    }));
    const posts = await this.attachLikedByMe(base, userId);
    const last = sliced[sliced.length - 1];
    const nextCursor = hasMore && last ? this.encodeCursor(last.createdAt, last.id) : null;

    return { posts, nextCursor };
  }

  // ─── 21. GET /circles/discover ─────────────────────────────────────────────────

  async discover(coupleId: string, q?: string, cursor?: string, limit?: number) {
    const myCircle = await this.getMyCircle(coupleId);
    const take = this.clampLimit(limit);
    const decoded = this.decodeCursor(cursor);

    // Already followed/pending target ids to exclude.
    let excludeIds: string[] = [];
    if (myCircle) {
      const edges = await this.db
        .select({ followingCircleId: schema.circleFollows.followingCircleId })
        .from(schema.circleFollows)
        .where(eq(schema.circleFollows.followerCircleId, myCircle.id));
      excludeIds = edges.map((e) => e.followingCircleId);
      excludeIds.push(myCircle.id);
    }

    const conditions = [];
    const search = q?.trim();
    if (search) {
      const like = `%${search}%`;
      conditions.push(
        or(
          ilike(schema.circles.handle, like),
          ilike(schema.circles.name, like),
          ilike(schema.circles.description, like),
        )!,
      );
    } else {
      // Empty q -> suggested public circles.
      conditions.push(eq(schema.circles.isPrivate, false));
    }
    if (excludeIds.length > 0) {
      for (const id of excludeIds) {
        conditions.push(ne(schema.circles.id, id));
      }
    }

    // Ordering: by followerCount desc for suggestions; cursor uses followerCount+id.
    if (decoded) {
      // decoded.ts carries followerCount here; id is the tiebreaker.
      conditions.push(
        sql`(${schema.circles.followerCount}, ${schema.circles.id}) < (${decoded.ts}, ${decoded.id})`,
      );
    }

    const rows = await this.db
      .select()
      .from(schema.circles)
      .where(and(...conditions))
      .orderBy(desc(schema.circles.followerCount), desc(schema.circles.id))
      .limit(take + 1);

    const hasMore = rows.length > take;
    const sliced = hasMore ? rows.slice(0, take) : rows;

    const circles = await Promise.all(
      sliced.map(async (c) => {
        const followState = await this.resolveFollowState(myCircle?.id ?? null, c);
        return { ...this.serializeCircle(c), followState };
      }),
    );

    const last = sliced[sliced.length - 1];
    const nextCursor =
      hasMore && last
        ? Buffer.from(`${last.followerCount ?? 0}:${last.id}`).toString('base64')
        : null;

    return { circles, nextCursor };
  }

  // ─── 22. GET /circles/stories (tray) ───────────────────────────────────────────

  async getStoryTray(userId: string, coupleId: string) {
    const myCircle = await this.getMyCircle(coupleId);
    if (!myCircle) return { trays: [] };

    const followed = await this.db
      .select({ followingCircleId: schema.circleFollows.followingCircleId })
      .from(schema.circleFollows)
      .where(
        and(
          eq(schema.circleFollows.followerCircleId, myCircle.id),
          eq(schema.circleFollows.status, 'accepted'),
        ),
      );
    const sourceIds = Array.from(
      new Set<string>([myCircle.id, ...followed.map((f) => f.followingCircleId)]),
    );

    const storyRows = await this.db
      .select({
        id: schema.circleStories.id,
        circleId: schema.circleStories.circleId,
        coupleId: schema.circleStories.coupleId,
        authorId: schema.circleStories.authorId,
        mediaUrl: schema.circleStories.mediaUrl,
        mediaType: schema.circleStories.mediaType,
        durationMs: schema.circleStories.durationMs,
        caption: schema.circleStories.caption,
        viewCount: schema.circleStories.viewCount,
        createdAt: schema.circleStories.createdAt,
        expiresAt: schema.circleStories.expiresAt,
        circleHandle: schema.circles.handle,
        circleName: schema.circles.name,
        circleAvatarUrl: schema.circles.avatarUrl,
      })
      .from(schema.circleStories)
      .innerJoin(schema.circles, eq(schema.circleStories.circleId, schema.circles.id))
      .where(
        and(
          inArray(schema.circleStories.circleId, sourceIds),
          sql`${schema.circleStories.expiresAt} > now()`,
        ),
      )
      .orderBy(schema.circleStories.createdAt);

    if (storyRows.length === 0) return { trays: [] };

    // Which of these stories has the viewer seen?
    const storyIds = storyRows.map((s) => s.id);
    const seen = await this.db
      .select({ storyId: schema.circleStoryViews.storyId })
      .from(schema.circleStoryViews)
      .where(
        and(
          inArray(schema.circleStoryViews.storyId, storyIds),
          eq(schema.circleStoryViews.viewerUserId, userId),
        ),
      );
    const seenSet = new Set(seen.map((v) => v.storyId));

    // Group by circle.
    const groups = new Map<
      string,
      {
        circle: { id: string; handle: string | null; name: string; avatarUrl?: string };
        stories: ReturnType<CirclesService['serializeStory']>[];
        hasUnseen: boolean;
        latestAt: Date | null;
      }
    >();

    for (const s of storyRows) {
      let g = groups.get(s.circleId);
      if (!g) {
        g = {
          circle: this.circleSummary({
            id: s.circleId,
            handle: s.circleHandle,
            name: s.circleName,
            avatarUrl: s.circleAvatarUrl,
          }),
          stories: [],
          hasUnseen: false,
          latestAt: null,
        };
        groups.set(s.circleId, g);
      }
      const viewedByMe = seenSet.has(s.id);
      g.stories.push(this.serializeStory(s, viewedByMe));
      if (!viewedByMe) g.hasUnseen = true;
      if (!g.latestAt || (s.createdAt && s.createdAt > g.latestAt)) {
        g.latestAt = s.createdAt;
      }
    }

    const trays = Array.from(groups.values());
    // Own first; then unseen-first by latestAt desc.
    trays.sort((a, b) => {
      const aMine = a.circle.id === myCircle.id ? 1 : 0;
      const bMine = b.circle.id === myCircle.id ? 1 : 0;
      if (aMine !== bMine) return bMine - aMine;
      if (a.hasUnseen !== b.hasUnseen) return a.hasUnseen ? -1 : 1;
      const at = a.latestAt?.getTime() ?? 0;
      const bt = b.latestAt?.getTime() ?? 0;
      return bt - at;
    });

    return {
      trays: trays.map((t) => ({
        circle: t.circle,
        stories: t.stories,
        hasUnseen: t.hasUnseen,
        latestAt: t.latestAt,
      })),
    };
  }

  private serializeStory(
    s: {
      id: string;
      circleId: string;
      coupleId: string;
      authorId: string;
      mediaUrl: string;
      mediaType: string | null;
      durationMs: number | null;
      caption: string | null;
      viewCount: number | null;
      createdAt: Date | null;
      expiresAt: Date | null;
    },
    viewedByMe?: boolean,
  ) {
    return {
      id: s.id,
      circleId: s.circleId,
      coupleId: s.coupleId,
      authorId: s.authorId,
      mediaUrl: s.mediaUrl,
      mediaType: s.mediaType ?? 'image',
      durationMs: s.durationMs ?? 5000,
      caption: s.caption ?? undefined,
      viewCount: s.viewCount ?? 0,
      viewedByMe: viewedByMe ?? undefined,
      createdAt: s.createdAt,
      expiresAt: s.expiresAt,
    };
  }

  // ─── 23. POST /circles/me/stories ──────────────────────────────────────────────

  async createStory(userId: string, coupleId: string, input: CreateStoryInput) {
    const circle = await this.requireMyCircle(coupleId);
    if (!input.mediaUrl) {
      throw new BadRequestException('mediaUrl is required');
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + STORY_TTL_MS);

    const [story] = await this.db
      .insert(schema.circleStories)
      .values({
        circleId: circle.id, // server-forced
        coupleId,
        authorId: userId,
        mediaUrl: input.mediaUrl,
        mediaType: input.mediaType ?? 'image',
        caption: input.caption ?? null,
        durationMs: input.durationMs ?? 5000,
        viewCount: 0,
        expiresAt,
      })
      .returning();

    const serialized = this.serializeStory(story!);

    const followerUserIds = await this.resolveFollowerUserIds(circle.id);
    this.fanOut(followerUserIds, 'circle:story:new', {
      circleId: circle.id,
      story: {
        id: story!.id,
        circle: this.circleSummary(circle),
      },
    });
    await this.afterOwnerMutation(userId, 'story:new', { circleId: circle.id, storyId: story!.id });

    return { story: serialized };
  }

  // ─── 24. GET /circles/:id/stories ──────────────────────────────────────────────

  async listStories(idOrHandle: string, userId: string, coupleId: string) {
    const target = await this.resolveCircle(idOrHandle);
    const viewerCircle = await this.getMyCircle(coupleId);
    await this.requireCanView(target, coupleId, viewerCircle?.id ?? null);

    const rows = await this.db
      .select()
      .from(schema.circleStories)
      .where(
        and(
          eq(schema.circleStories.circleId, target.id),
          sql`${schema.circleStories.expiresAt} > now()`,
        ),
      )
      .orderBy(schema.circleStories.createdAt);

    if (rows.length === 0) return { stories: [] };

    const storyIds = rows.map((s) => s.id);
    const seen = await this.db
      .select({ storyId: schema.circleStoryViews.storyId })
      .from(schema.circleStoryViews)
      .where(
        and(
          inArray(schema.circleStoryViews.storyId, storyIds),
          eq(schema.circleStoryViews.viewerUserId, userId),
        ),
      );
    const seenSet = new Set(seen.map((v) => v.storyId));

    return { stories: rows.map((s) => this.serializeStory(s, seenSet.has(s.id))) };
  }

  // ─── 25. POST /circles/stories/:storyId/view ───────────────────────────────────

  async viewStory(storyId: string, userId: string, coupleId: string) {
    const [story] = await this.db
      .select()
      .from(schema.circleStories)
      .where(eq(schema.circleStories.id, storyId))
      .limit(1);
    if (!story || (story.expiresAt && story.expiresAt <= new Date())) {
      throw new NotFoundException('Story not found');
    }

    const target = await this.getCircleById(story.circleId);
    const viewerCircle = await this.getMyCircle(coupleId);
    await this.requireCanView(target, coupleId, viewerCircle?.id ?? null);

    let inserted = false;
    try {
      const res = await this.db
        .insert(schema.circleStoryViews)
        .values({
          storyId,
          viewerUserId: userId,
          viewerCircleId: viewerCircle?.id ?? null,
        })
        .returning();
      inserted = res.length > 0;
    } catch (err) {
      if (!this.isUniqueViolation(err)) throw err; // idempotent: already viewed
    }

    if (inserted) {
      await this.db
        .update(schema.circleStories)
        .set({ viewCount: sql`${schema.circleStories.viewCount} + 1` })
        .where(eq(schema.circleStories.id, storyId));
    }

    const [updated] = await this.db
      .select({ viewCount: schema.circleStories.viewCount })
      .from(schema.circleStories)
      .where(eq(schema.circleStories.id, storyId))
      .limit(1);
    const viewCount = updated?.viewCount ?? 0;

    if (inserted) {
      const ownerUserIds = await this.ownerCoupleUserIds(target);
      this.fanOut(ownerUserIds, 'circle:story:viewed', { storyId, viewCount });
    }

    return { viewCount };
  }

  // ─── 26. GET /circles/me/stories/:storyId/viewers ──────────────────────────────

  async listStoryViewers(coupleId: string, storyId: string) {
    const myCircle = await this.requireMyCircle(coupleId);
    const [story] = await this.db
      .select()
      .from(schema.circleStories)
      .where(eq(schema.circleStories.id, storyId))
      .limit(1);
    if (!story) throw new NotFoundException('Story not found');
    if (story.circleId !== myCircle.id) {
      throw new ForbiddenException('That story is not on your circle');
    }

    const rows = await this.db
      .select({
        viewedAt: schema.circleStoryViews.viewedAt,
        displayName: schema.users.displayName,
        avatarUrl: schema.users.avatarUrl,
      })
      .from(schema.circleStoryViews)
      .leftJoin(schema.users, eq(schema.circleStoryViews.viewerUserId, schema.users.id))
      .where(eq(schema.circleStoryViews.storyId, storyId))
      .orderBy(desc(schema.circleStoryViews.viewedAt));

    const viewers = rows.map((r) => ({
      user: { displayName: r.displayName ?? 'Someone', avatarUrl: r.avatarUrl ?? undefined },
      viewedAt: r.viewedAt,
    }));

    return { viewers };
  }

  // ─── 27. DELETE /circles/me/stories/:storyId ───────────────────────────────────

  async deleteStory(userId: string, coupleId: string, storyId: string) {
    const myCircle = await this.requireMyCircle(coupleId);
    const [story] = await this.db
      .select()
      .from(schema.circleStories)
      .where(eq(schema.circleStories.id, storyId))
      .limit(1);
    if (!story) throw new NotFoundException('Story not found');
    if (story.circleId !== myCircle.id) {
      throw new ForbiddenException('That story is not on your circle');
    }

    await this.db
      .delete(schema.circleStoryViews)
      .where(eq(schema.circleStoryViews.storyId, storyId));
    await this.db.delete(schema.circleStories).where(eq(schema.circleStories.id, storyId));
    await this.deleteMediaByUrl(story.mediaUrl); // best-effort
    await this.afterOwnerMutation(userId, 'story:deleted', { circleId: myCircle.id, storyId });

    return { success: true };
  }

  // ─── Internal utilities ────────────────────────────────────────────────────────

  private async displayName(userId: string): Promise<string> {
    const [u] = await this.db
      .select({ displayName: schema.users.displayName })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);
    return u?.displayName ?? 'Someone';
  }

  private async attachLikedByMe<T extends { id: string }>(
    posts: T[],
    userId: string,
  ): Promise<(T & { likedByMe: boolean })[]> {
    if (posts.length === 0) return [];
    const postIds = posts.map((p) => p.id);
    const likes = await this.db
      .select({ postId: schema.postLikes.postId })
      .from(schema.postLikes)
      .where(
        and(inArray(schema.postLikes.postId, postIds), eq(schema.postLikes.userId, userId)),
      );
    const likedSet = new Set(likes.map((l) => l.postId));
    return posts.map((p) => ({ ...p, likedByMe: likedSet.has(p.id) }));
  }
}
