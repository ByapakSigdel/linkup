import {
  collectAllowedGoogleClientIds,
  verifyGoogleIdToken,
  GoogleTokenError,
  type GoogleFetch,
} from './google-token.helpers';

describe('collectAllowedGoogleClientIds', () => {
  it('merges, splits, trims and de-blanks all four env sources', () => {
    const env: Record<string, string | undefined> = {
      GOOGLE_CLIENT_ID: 'a, b',
      GOOGLE_CLIENT_IDS: 'c',
      GOOGLE_WEB_CLIENT_ID: '  d  ',
      NEXT_PUBLIC_GOOGLE_CLIENT_ID: '',
    };
    expect(collectAllowedGoogleClientIds((k) => env[k])).toEqual([
      'a',
      'b',
      'c',
      'd',
    ]);
  });

  it('returns an empty array when nothing is configured', () => {
    expect(collectAllowedGoogleClientIds(() => undefined)).toEqual([]);
  });
});

describe('verifyGoogleIdToken', () => {
  const okFetch =
    (payload: any, ok = true, status = 200): GoogleFetch =>
    async () => ({ ok, status, json: async () => payload });

  it('rejects a missing token', async () => {
    await expect(
      verifyGoogleIdToken(undefined, ['aud1'], okFetch({})),
    ).rejects.toBeInstanceOf(GoogleTokenError);
  });

  it('rejects when tokeninfo returns a non-2xx', async () => {
    await expect(
      verifyGoogleIdToken('tok', ['aud1'], okFetch({}, false, 400)),
    ).rejects.toBeInstanceOf(GoogleTokenError);
  });

  it('fails closed when no client IDs are configured', async () => {
    await expect(
      verifyGoogleIdToken(
        'tok',
        [],
        okFetch({ aud: 'aud1', email: 'a@b.com', email_verified: true }),
      ),
    ).rejects.toBeInstanceOf(GoogleTokenError);
  });

  it('rejects a token minted for an unlisted audience', async () => {
    await expect(
      verifyGoogleIdToken(
        'tok',
        ['aud1'],
        okFetch({ aud: 'other', email: 'a@b.com', email_verified: true }),
      ),
    ).rejects.toBeInstanceOf(GoogleTokenError);
  });

  it('rejects an unverified email', async () => {
    await expect(
      verifyGoogleIdToken(
        'tok',
        ['aud1'],
        okFetch({ aud: 'aud1', email: 'a@b.com', email_verified: false }),
      ),
    ).rejects.toBeInstanceOf(GoogleTokenError);
  });

  it('returns trusted, lowercased claims on success', async () => {
    const info = await verifyGoogleIdToken(
      'tok',
      ['aud1'],
      okFetch({
        aud: 'aud1',
        email: 'Alice@Example.com',
        email_verified: 'true',
        sub: '12345',
        name: 'Alice',
        picture: 'https://pic',
      }),
    );
    expect(info).toEqual({
      email: 'alice@example.com',
      emailVerified: true,
      sub: '12345',
      name: 'Alice',
      picture: 'https://pic',
    });
  });
});
