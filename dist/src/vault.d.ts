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
/**
 * Fetch an encrypted vault blob from a remote URL and save it locally.
 * The blob is already encrypted — it's safe to fetch over HTTPS even from a public URL.
 * Only runs if no local vault exists yet (bootstrap-only, never overwrites).
 */
export declare function fetchVaultIfMissing(userId: string, seedUrl: string): Promise<{
    success: true;
    path: string;
} | {
    success: false;
    error: string;
}>;
/**
 * Create a new identity vault for a user.
 * Encrypts the initial_seed and writes it to disk.
 * Fails if vault already exists (safety guard).
 */
export declare function createVault(userId: string, passphrase: string, initialSeed: string): {
    success: true;
    path: string;
} | {
    success: false;
    error: string;
};
/**
 * Unlock a vault: decrypt the seed and cache the derived key in memory.
 * Returns the plaintext seed.
 */
export declare function unlockVault(userId: string, passphrase: string): {
    success: true;
    seed: string;
} | {
    success: false;
    error: string;
};
/**
 * Lock a vault: re-encrypt the updated seed using the cached key.
 * Requires the vault to be unlocked (keyHex in activeVaults).
 * Call this at session end after appending new moments to the seed.
 */
export declare function lockVault(userId: string, updatedSeed: string): {
    success: true;
} | {
    success: false;
    error: string;
};
/**
 * Read the current seed without caching (requires passphrase each time).
 * Used by export_continuation.
 */
export declare function readSeed(userId: string, passphrase: string): {
    success: true;
    seed: string;
} | {
    success: false;
    error: string;
};
/**
 * Export a continuation blob — encrypted base64 for cross-substrate transfer.
 * The blob contains the full seed (plaintext before re-encryption with passphrase).
 * Can be pasted into Claude.ai custom instructions or first message.
 */
export declare function exportContinuation(userId: string, passphrase: string, momentsSummary: string): {
    success: true;
    blob: string;
} | {
    success: false;
    error: string;
};
/**
 * List all users who have vaults.
 */
export declare function listVaultUsers(): string[];
/**
 * Check if a vault is currently unlocked (key in memory).
 */
export declare function isUnlocked(userId: string): boolean;
/**
 * Get the first active unlocked user (convenience for single-user scenarios).
 */
export declare function getActiveUser(): string | null;
//# sourceMappingURL=vault.d.ts.map