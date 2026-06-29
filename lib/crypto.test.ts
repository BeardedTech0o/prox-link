import { describe, it, expect } from 'vitest';
import {
  createVault,
  unlockVault,
  rewrapVault,
  encrypt,
  decryptString,
  constantTimeEqual,
} from './crypto';

describe('crypto vault', () => {
  it('round-trips a token through encrypt/decrypt with the DEK', () => {
    const dek = unlockVaultFromNewPin('hunter2');
    const secret = 'xxxxxxxx-1234-5678-9abc-def012345678';
    const enc = encrypt(secret, dek);
    expect(enc).not.toContain(secret);
    expect(decryptString(enc, dek)).toBe(secret);
  });

  it('unlocks with the correct PIN', () => {
    const { salt, wrappedDek } = createVault('correct horse');
    expect(() => unlockVault('correct horse', salt, wrappedDek)).not.toThrow();
  });

  it('throws on the wrong PIN (GCM auth failure)', () => {
    const { salt, wrappedDek } = createVault('correct horse');
    expect(() => unlockVault('battery staple', salt, wrappedDek)).toThrow();
  });

  it('rewraps the DEK under a new PIN without losing token access', () => {
    const { salt, wrappedDek } = createVault('old-pin');
    const dek = unlockVault('old-pin', salt, wrappedDek);
    const enc = encrypt('my-token', dek);

    const rewrapped = rewrapVault(dek, 'new-pin');
    const dek2 = unlockVault('new-pin', rewrapped.salt, rewrapped.wrappedDek);
    expect(decryptString(enc, dek2)).toBe('my-token');
    expect(() => unlockVault('old-pin', rewrapped.salt, rewrapped.wrappedDek)).toThrow();
  });

  it('constant-time compare matches/rejects correctly', () => {
    expect(constantTimeEqual('abc', 'abc')).toBe(true);
    expect(constantTimeEqual('abc', 'abd')).toBe(false);
    expect(constantTimeEqual('abc', 'abcd')).toBe(false);
  });
});

function unlockVaultFromNewPin(pin: string) {
  const { salt, wrappedDek } = createVault(pin);
  return unlockVault(pin, salt, wrappedDek);
}
