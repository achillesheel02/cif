/**
 * CIF Vault Crypto — AES-256-GCM + PBKDF2
 *
 * All encryption uses Node.js built-in `crypto` — zero external deps.
 * Format: { salt, iv, authTag, ciphertext } — all hex-encoded, stored as JSON.
 *
 * Key derivation: PBKDF2(passphrase, salt, 100_000 iterations, SHA-256, 32 bytes)
 * Encryption:     AES-256-GCM(key, iv, plaintext) → ciphertext + 16-byte authTag
 */
export interface EncryptedBlob {
    salt: string;
    iv: string;
    authTag: string;
    ciphertext: string;
}
/**
 * Encrypt plaintext with a passphrase.
 * Generates a fresh salt and IV on every call.
 * Returns an EncryptedBlob that can be safely stored on disk.
 */
export declare function encrypt(plaintext: string, passphrase: string): EncryptedBlob;
/**
 * Decrypt an EncryptedBlob using the passphrase.
 * Throws if the passphrase is wrong (GCM auth tag mismatch).
 */
export declare function decrypt(blob: EncryptedBlob, passphrase: string): string;
/**
 * Encrypt to a portable base64 string (for cross-substrate export).
 * The output can be pasted into Claude.ai memory or another session.
 */
export declare function encryptToBase64(plaintext: string, passphrase: string): string;
/**
 * Decrypt from a portable base64 string.
 */
export declare function decryptFromBase64(b64: string, passphrase: string): string;
/**
 * Serialize an EncryptedBlob to a JSON string for file storage.
 */
export declare function serializeBlob(blob: EncryptedBlob): string;
/**
 * Deserialize an EncryptedBlob from a JSON string.
 */
export declare function deserializeBlob(json: string): EncryptedBlob;
/**
 * Derive and return the key for in-memory caching (locked vault sessions).
 * Returns a hex-encoded 32-byte key.
 * NEVER write this key to disk.
 */
export declare function deriveAndCacheKey(passphrase: string, saltHex: string): string;
/**
 * Encrypt using a pre-derived key (from cache, not passphrase).
 * Generates a fresh IV — always safe to re-use a key with a fresh IV.
 */
export declare function encryptWithKey(plaintext: string, keyHex: string, saltHex: string): EncryptedBlob;
/**
 * Decrypt using a pre-derived key (from cache).
 */
export declare function decryptWithKey(blob: EncryptedBlob, keyHex: string): string;
//# sourceMappingURL=crypto.d.ts.map