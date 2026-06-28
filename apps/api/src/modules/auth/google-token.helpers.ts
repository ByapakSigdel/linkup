// Shared, dependency-free Google ID-token verification — kept out of any service
// so BOTH auth.service (sign-in / account creation) and users.service (delete
// re-authentication for OAuth-only accounts) can use it WITHOUT importing each
// other (AuthModule already imports UsersModule, so the reverse would be a
// circular module dependency). Mirrors the circle-dm.helpers.ts pattern: pure
// logic in its own file, with the only side effect (an HTTPS fetch) injected so
// it stays unit-testable.

/** The fields we trust from a verified Google ID token. */
export interface GoogleTokenInfo {
  email: string;
  emailVerified: boolean;
  sub: string;
  name: string | null;
  picture: string | null;
}

/** Minimal fetch shape so callers can inject `globalThis.fetch` (or a stub). */
export type GoogleFetch = (url: string) => Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<any>;
}>;

/**
 * Collect the allowed OAuth client IDs from the various env vars we accept. Both
 * web and mobile send an ID token whose `aud` is the WEB client ID, so all four
 * sources are merged, trimmed and de-blanked. Pure (takes a getter), so it can be
 * unit-tested without a ConfigService.
 */
export function collectAllowedGoogleClientIds(
  get: (key: string) => string | undefined,
): string[] {
  return [
    ...(get('GOOGLE_CLIENT_ID') || '').split(','),
    ...(get('GOOGLE_CLIENT_IDS') || '').split(','),
    ...(get('GOOGLE_WEB_CLIENT_ID') || '').split(','),
    ...(get('NEXT_PUBLIC_GOOGLE_CLIENT_ID') || '').split(','),
  ]
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Raised when a Google ID token cannot be trusted; callers map it to a 401. */
export class GoogleTokenError extends Error {}

/**
 * Verify a Google ID token against Google's tokeninfo endpoint and our allowed
 * audiences, returning the trusted claims. Throws GoogleTokenError on any
 * failure (missing token, network/HTTP error, wrong/unconfigured audience, or an
 * unverified email). Fails CLOSED when no client IDs are configured so a token
 * minted for any Google client can never pass the audience check.
 */
export async function verifyGoogleIdToken(
  idToken: string | undefined,
  allowedClientIds: string[],
  fetchFn: GoogleFetch,
): Promise<GoogleTokenInfo> {
  if (!idToken) {
    throw new GoogleTokenError('Missing Google credential');
  }

  let payload: any;
  try {
    const res = await fetchFn(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
    );
    if (!res.ok) {
      throw new Error(`tokeninfo HTTP ${res.status}`);
    }
    payload = await res.json();
  } catch (err) {
    throw new GoogleTokenError(
      `Google token verification failed: ${(err as Error).message}`,
    );
  }

  if (allowedClientIds.length === 0 || !allowedClientIds.includes(payload.aud)) {
    throw new GoogleTokenError('Google sign-in is not configured for this app');
  }

  const email = String(payload.email || '').toLowerCase();
  const emailVerified =
    payload.email_verified === true || payload.email_verified === 'true';
  if (!email || !emailVerified) {
    throw new GoogleTokenError('Your Google account has no verified email');
  }

  return {
    email,
    emailVerified,
    sub: String(payload.sub || ''),
    name: payload.name ? String(payload.name) : null,
    picture: payload.picture ? String(payload.picture) : null,
  };
}
