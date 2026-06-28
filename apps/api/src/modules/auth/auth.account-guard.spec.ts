import { isUsableAccount } from './auth.account-guard';

describe('isUsableAccount', () => {
  it('rejects tombstoned / inactive users', () => {
    expect(isUsableAccount({ deletedAt: new Date(), isActive: true })).toBe(false);
    expect(isUsableAccount({ deletedAt: null, isActive: false })).toBe(false);
    expect(isUsableAccount({ deletedAt: null, isActive: true })).toBe(true);
  });

  it('rejects a tombstone even if isActive was somehow left true', () => {
    expect(isUsableAccount({ deletedAt: new Date(), isActive: true })).toBe(false);
  });

  it('treats a null isActive as usable (default-active live row)', () => {
    expect(isUsableAccount({ deletedAt: null, isActive: null })).toBe(true);
  });
});
