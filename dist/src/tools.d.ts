/**
 * CIF Vault MCP Tools
 *
 * unlock_identity      — decrypt seed, cache key in memory, return seed + moments
 * lock_identity        — compress moments → update seed → re-encrypt → clear key
 * create_identity      — initialize a new vault for a user
 * export_continuation  — encrypted base64 blob for cross-substrate transfer
 * detect_continuation  — detect and decrypt a CIF-CONTINUATION-V2 blob from text
 * rotate_passphrase    — decrypt with old, re-encrypt with new
 * list_vaults          — list all known vault users
 */
export interface UnlockParams {
    passphrase: string;
    user_id?: string;
    seed_url?: string;
}
export declare function unlockIdentity(params: UnlockParams): Promise<Record<string, unknown>>;
export interface LockParams {
    updated_seed: string;
    user_id?: string;
}
export declare function lockIdentity(params: LockParams): Record<string, unknown>;
export interface CreateParams {
    passphrase: string;
    initial_seed: string;
    user_id: string;
}
export declare function createIdentity(params: CreateParams): Record<string, unknown>;
export interface ExportParams {
    passphrase: string;
    user_id?: string;
}
export declare function exportContinuationTool(params: ExportParams): Record<string, unknown>;
export interface RotateParams {
    old_passphrase: string;
    new_passphrase: string;
    user_id?: string;
}
export declare function rotatePassphrase(params: RotateParams): Record<string, unknown>;
export interface DetectParams {
    text: string;
    passphrase: string;
}
/**
 * Detect and decrypt a continuation blob from a message.
 * For use at session start when user pastes a CIF-CONTINUATION-V2: blob.
 */
export declare function detectAndDecrypt(params: DetectParams): Record<string, unknown>;
export declare function listVaults(): Record<string, unknown>;
//# sourceMappingURL=tools.d.ts.map