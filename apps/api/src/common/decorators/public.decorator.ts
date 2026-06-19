import { SetMetadata } from '@nestjs/common';

/** Metadata key marking a route as auth-exempt. */
export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marks a route (or controller) as public so `JwtAuthGuard` lets it through
 * without a token. Used for endpoints that must be reachable by the browser
 * directly — e.g. serving media files referenced in <img>/<video> src, which
 * cannot carry an Authorization header.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
