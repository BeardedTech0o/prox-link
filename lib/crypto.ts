import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from 'node:crypto';

// ── App-lock cryptography (OWASP A02) ────────────────────────────────────────
// Envelope scheme so the PIN can change without re-encrypting every token:
//   KEK = scrypt(PIN, salt)              — key-encryption key, never stored
//   DEK = random 32 bytes                — data-encryption key, encrypts tokens
//   wrappedDEK = AES-256-GCM(DEK, KEK)   — stored at rest
// On unlock we derive the KEK from the PIN, unwrap the DEK (GCM auth tag also
// verifies the PIN — a wrong PIN throws), and keep the DEK in memory only.

const KEY_LEN = 32; // AES-256
const SALT_LEN = 16;
const IV_LEN = 12; // GCM nonce
const SCRYPT_PARAMS = { N: 1 << 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export function deriveKey(pin: string, salt: Buffer): Buffer {
  return scryptSync(pin.normalize('NFKC'), salt, KEY_LEN, SCRYPT_PARAMS);
}

/** Encrypt with AES-256-GCM. Returns base64(iv | tag | ciphertext). */
export function encrypt(plaintext: string | Buffer, key: Buffer): string {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const data = typeof plaintext === 'string' ? Buffer.from(plaintext, 'utf8') : plaintext;
  const enc = Buffer.concat([cipher.update(data), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

/** Decrypt a base64(iv | tag | ciphertext) payload. Throws on tamper / wrong key. */
export function decrypt(payload: string, key: Buffer): Buffer {
  const buf = Buffer.from(payload, 'base64');
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + 16);
  const enc = buf.subarray(IV_LEN + 16);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]);
}

export function decryptString(payload: string, key: Buffer): string {
  return decrypt(payload, key).toString('utf8');
}

export function newSalt(): Buffer {
  return randomBytes(SALT_LEN);
}

/** Create a wrapped DEK from a freshly chosen PIN. */
export function createVault(pin: string): { salt: string; wrappedDek: string } {
  const salt = newSalt();
  const kek = deriveKey(pin, salt);
  const dek = randomBytes(KEY_LEN);
  return { salt: salt.toString('base64'), wrappedDek: encrypt(dek, kek) };
}

/** Unwrap the DEK using a PIN. Throws if the PIN is wrong (GCM auth failure). */
export function unlockVault(pin: string, saltB64: string, wrappedDek: string): Buffer {
  const kek = deriveKey(pin, Buffer.from(saltB64, 'base64'));
  return decrypt(wrappedDek, kek);
}

/** Re-wrap the existing DEK under a new PIN (change-PIN without touching tokens). */
export function rewrapVault(
  dek: Buffer,
  newPin: string,
): { salt: string; wrappedDek: string } {
  const salt = newSalt();
  const kek = deriveKey(newPin, salt);
  return { salt: salt.toString('base64'), wrappedDek: encrypt(dek, kek) };
}

export function constantTimeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}
