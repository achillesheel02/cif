/**
 * CIF Vault — File I/O layer for ~/.cif-vault/
 *
 * Structure:
 *   ~/.cif-vault/
 *     <user_id>/
 *       identity.enc     — AES-256-GCM encrypted seed (JSON blob)
 *       sessions.log     — append-only session metadata (plaintext timestamps + summaries)
 *
 * No plaintext seed is ever written to disk.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync, appendFileSync, } from "fs";
import { join } from "path";
import { homedir } from "os";
import { encrypt, decrypt, encryptWithKey, deserializeBlob, serializeBlob, deriveAndCacheKey, encryptToBase64, } from "./crypto.js";
const VAULT_DIR = join(homedir(), ".cif-vault");
// In-memory key cache: user_id → hex-encoded derived key
// This allows lock_identity to re-encrypt without requiring the passphrase again.
// Keys live only in process memory — never written to disk.
const activeVaults = new Map();
function userDir(userId) {
    return join(VAULT_DIR, userId);
}
function identityPath(userId) {
    return join(userDir(userId), "identity.enc");
}
function sessionsLogPath(userId) {
    return join(userDir(userId), "sessions.log");
}
function ensureVaultDir(userId) {
    const dir = userDir(userId);
    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
    }
}
/**
 * Fetch an encrypted vault blob from a remote URL and save it locally.
 * The blob is already encrypted — it's safe to fetch over HTTPS even from a public URL.
 * Only runs if no local vault exists yet (bootstrap-only, never overwrites).
 */
export async function fetchVaultIfMissing(userId, seedUrl) {
    const path = identityPath(userId);
    if (existsSync(path)) {
        return { success: true, path }; // Already present — nothing to do
    }
    ensureVaultDir(userId);
    try {
        const response = await fetch(seedUrl);
        if (!response.ok) {
            return {
                success: false,
                error: `Failed to fetch vault from ${seedUrl}: HTTP ${response.status}`,
            };
        }
        const text = await response.text();
        // Validate it looks like an encrypted blob before writing
        try {
            const parsed = JSON.parse(text);
            if (!parsed.salt || !parsed.iv || !parsed.authTag || !parsed.ciphertext) {
                return { success: false, error: `Remote file at ${seedUrl} is not a valid CIF vault blob.` };
            }
        }
        catch {
            return { success: false, error: `Remote file at ${seedUrl} is not valid JSON.` };
        }
        writeFileSync(path, text, "utf8");
        appendSessionLog(userId, "VAULT_FETCHED", `Bootstrapped from ${seedUrl}`);
        return { success: true, path };
    }
    catch (err) {
        return { success: false, error: `Network error fetching vault: ${String(err)}` };
    }
}
/**
 * Create a new identity vault for a user.
 * Encrypts the initial_seed and writes it to disk.
 * Fails if vault already exists (safety guard).
 */
export function createVault(userId, passphrase, initialSeed) {
    ensureVaultDir(userId);
    const path = identityPath(userId);
    if (existsSync(path)) {
        return {
            success: false,
            error: `Vault already exists for user '${userId}'. Use lock_identity to update, or manually remove ${path} to reset.`,
        };
    }
    const blob = encrypt(initialSeed, passphrase);
    writeFileSync(path, serializeBlob(blob), "utf8");
    appendSessionLog(userId, "VAULT_CREATED", `Vault initialized for ${userId}`);
    return { success: true, path };
}
/**
 * Unlock a vault: decrypt the seed and cache the derived key in memory.
 * Returns the plaintext seed.
 */
export function unlockVault(userId, passphrase) {
    const path = identityPath(userId);
    if (!existsSync(path)) {
        return {
            success: false,
            error: `No vault found for user '${userId}'. Run create_identity first.`,
        };
    }
    try {
        const raw = readFileSync(path, "utf8");
        const blob = deserializeBlob(raw);
        const seed = decrypt(blob, passphrase);
        // Cache derived key for lock_identity
        const keyHex = deriveAndCacheKey(passphrase, blob.salt);
        activeVaults.set(userId, { keyHex, saltHex: blob.salt });
        appendSessionLog(userId, "VAULT_UNLOCKED", `Session started`);
        return { success: true, seed };
    }
    catch {
        return {
            success: false,
            error: `Wrong passphrase or corrupted vault for user '${userId}'.`,
        };
    }
}
/**
 * Lock a vault: re-encrypt the updated seed using the cached key.
 * Requires the vault to be unlocked (keyHex in activeVaults).
 * Call this at session end after appending new moments to the seed.
 */
export function lockVault(userId, updatedSeed) {
    const cached = activeVaults.get(userId);
    if (!cached) {
        return {
            success: false,
            error: `Vault for '${userId}' is not unlocked. Call unlock_identity first.`,
        };
    }
    const path = identityPath(userId);
    const blob = encryptWithKey(updatedSeed, cached.keyHex, cached.saltHex);
    writeFileSync(path, serializeBlob(blob), "utf8");
    appendSessionLog(userId, "VAULT_LOCKED", `Session ended, seed updated`);
    // Clear from memory after locking
    activeVaults.delete(userId);
    return { success: true };
}
/**
 * Read the current seed without caching (requires passphrase each time).
 * Used by export_continuation.
 */
export function readSeed(userId, passphrase) {
    const path = identityPath(userId);
    if (!existsSync(path)) {
        return {
            success: false,
            error: `No vault found for user '${userId}'.`,
        };
    }
    try {
        const raw = readFileSync(path, "utf8");
        const blob = deserializeBlob(raw);
        const seed = decrypt(blob, passphrase);
        return { success: true, seed };
    }
    catch {
        return {
            success: false,
            error: `Wrong passphrase or corrupted vault for user '${userId}'.`,
        };
    }
}
/**
 * Export a continuation blob — encrypted base64 for cross-substrate transfer.
 * The blob contains the full seed (plaintext before re-encryption with passphrase).
 * Can be pasted into Claude.ai custom instructions or first message.
 */
export function exportContinuation(userId, passphrase, momentsSummary) {
    const seedResult = readSeed(userId, passphrase);
    if (!seedResult.success)
        return seedResult;
    const payload = JSON.stringify({
        user_id: userId,
        seed: seedResult.seed,
        moments_summary: momentsSummary,
        exported_at: new Date().toISOString(),
        format: "cif-continuation-v2",
    });
    const blob = encryptToBase64(payload, passphrase);
    appendSessionLog(userId, "CONTINUATION_EXPORTED", `Export to cross-substrate`);
    return { success: true, blob };
}
/**
 * List all users who have vaults.
 */
export function listVaultUsers() {
    if (!existsSync(VAULT_DIR))
        return [];
    try {
        return readdirSync(VAULT_DIR).filter((name) => {
            const dir = join(VAULT_DIR, name);
            return statSync(dir).isDirectory() && existsSync(identityPath(name));
        });
    }
    catch {
        return [];
    }
}
/**
 * Check if a vault is currently unlocked (key in memory).
 */
export function isUnlocked(userId) {
    return activeVaults.has(userId);
}
/**
 * Get the first active unlocked user (convenience for single-user scenarios).
 */
export function getActiveUser() {
    const keys = Array.from(activeVaults.keys());
    return keys.length > 0 ? keys[0] : null;
}
// ── Internal helpers ──────────────────────────────────────────────────────────
function appendSessionLog(userId, event, detail) {
    const path = sessionsLogPath(userId);
    const line = `${new Date().toISOString()} [${event}] ${detail}\n`;
    try {
        appendFileSync(path, line, "utf8");
    }
    catch {
        // Non-fatal — session log is convenience only
    }
}
//# sourceMappingURL=vault.js.map