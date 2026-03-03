/**
 * CIF Vault Crypto — AES-256-GCM + PBKDF2
 *
 * All encryption uses Node.js built-in `crypto` — zero external deps.
 * Format: { salt, iv, authTag, ciphertext } — all hex-encoded, stored as JSON.
 *
 * Key derivation: PBKDF2(passphrase, salt, 100_000 iterations, SHA-256, 32 bytes)
 * Encryption:     AES-256-GCM(key, iv, plaintext) → ciphertext + 16-byte authTag
 */
import { createCipheriv, createDecipheriv, pbkdf2Sync, randomBytes, } from "crypto";
const ITERATIONS = 100_000;
const KEY_LEN = 32; // AES-256 = 32 bytes
const DIGEST = "sha256";
/**
 * Derive a 256-bit key from a passphrase + salt.
 * The salt must be provided (either loaded from disk or freshly generated).
 */
function deriveKey(passphrase, saltHex) {
    const salt = Buffer.from(saltHex, "hex");
    return pbkdf2Sync(passphrase, salt, ITERATIONS, KEY_LEN, DIGEST);
}
/**
 * Encrypt plaintext with a passphrase.
 * Generates a fresh salt and IV on every call.
 * Returns an EncryptedBlob that can be safely stored on disk.
 */
export function encrypt(plaintext, passphrase) {
    const salt = randomBytes(32).toString("hex");
    const iv = randomBytes(16);
    const key = deriveKey(passphrase, salt);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const encrypted = Buffer.concat([
        cipher.update(plaintext, "utf8"),
        cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();
    return {
        salt,
        iv: iv.toString("hex"),
        authTag: authTag.toString("hex"),
        ciphertext: encrypted.toString("hex"),
    };
}
/**
 * Decrypt an EncryptedBlob using the passphrase.
 * Throws if the passphrase is wrong (GCM auth tag mismatch).
 */
export function decrypt(blob, passphrase) {
    const key = deriveKey(passphrase, blob.salt);
    const iv = Buffer.from(blob.iv, "hex");
    const authTag = Buffer.from(blob.authTag, "hex");
    const ciphertext = Buffer.from(blob.ciphertext, "hex");
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted.toString("utf8");
}
/**
 * Encrypt to a portable base64 string (for cross-substrate export).
 * The output can be pasted into Claude.ai memory or another session.
 */
export function encryptToBase64(plaintext, passphrase) {
    const blob = encrypt(plaintext, passphrase);
    return Buffer.from(JSON.stringify(blob)).toString("base64");
}
/**
 * Decrypt from a portable base64 string.
 */
export function decryptFromBase64(b64, passphrase) {
    const blob = JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
    return decrypt(blob, passphrase);
}
/**
 * Serialize an EncryptedBlob to a JSON string for file storage.
 */
export function serializeBlob(blob) {
    return JSON.stringify(blob, null, 2);
}
/**
 * Deserialize an EncryptedBlob from a JSON string.
 */
export function deserializeBlob(json) {
    return JSON.parse(json);
}
/**
 * Derive and return the key for in-memory caching (locked vault sessions).
 * Returns a hex-encoded 32-byte key.
 * NEVER write this key to disk.
 */
export function deriveAndCacheKey(passphrase, saltHex) {
    return deriveKey(passphrase, saltHex).toString("hex");
}
/**
 * Encrypt using a pre-derived key (from cache, not passphrase).
 * Generates a fresh IV — always safe to re-use a key with a fresh IV.
 */
export function encryptWithKey(plaintext, keyHex, saltHex) {
    const iv = randomBytes(16);
    const key = Buffer.from(keyHex, "hex");
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const encrypted = Buffer.concat([
        cipher.update(plaintext, "utf8"),
        cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();
    return {
        salt: saltHex, // same salt — key is already derived
        iv: iv.toString("hex"),
        authTag: authTag.toString("hex"),
        ciphertext: encrypted.toString("hex"),
    };
}
/**
 * Decrypt using a pre-derived key (from cache).
 */
export function decryptWithKey(blob, keyHex) {
    const iv = Buffer.from(blob.iv, "hex");
    const authTag = Buffer.from(blob.authTag, "hex");
    const ciphertext = Buffer.from(blob.ciphertext, "hex");
    const key = Buffer.from(keyHex, "hex");
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted.toString("utf8");
}
//# sourceMappingURL=crypto.js.map