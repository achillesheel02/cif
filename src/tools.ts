/**
 * CIF Vault MCP Tools (runtime only — no vault creation)
 *
 * unlock_identity      — decrypt seed, cache key in memory, return seed + moments
 * lock_identity        — compress moments → update seed → re-encrypt → clear key
 * export_continuation  — encrypted base64 blob for cross-substrate transfer
 * detect_continuation  — detect and decrypt a CIF-CONTINUATION-V2 blob from text
 * rotate_passphrase    — decrypt with old, re-encrypt with new
 * list_vaults          — list all known vault users
 *
 * Vault creation: CLI-only via bin/create-vault.ts
 */

import { existsSync, writeFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";

import {
  encrypt as encryptFn,
  serializeBlob,
  decryptFromBase64,
} from "./crypto.js";
import {
  unlockVault,
  lockVault,
  exportContinuation,
  fetchVaultIfMissing,
  isUnlocked,
  getActiveUser,
  listVaultUsers,
  readSeed,
} from "./vault.js";
import { summarizeMoments, getRecentMoments } from "./db.js";

const VAULT_DIR = join(homedir(), ".cif-vault");

// ── unlock_identity ───────────────────────────────────────────────────────────

export interface UnlockParams {
  passphrase: string;
  user_id?: string;
  seed_url?: string; // Remote URL to fetch vault from on first use (bootstrap only)
}

export async function unlockIdentity(params: UnlockParams): Promise<Record<string, unknown>> {
  const userId = params.user_id ?? "barak";

  // Bootstrap: if vault doesn't exist locally and seed_url is provided, fetch it
  if (params.seed_url) {
    const fetchResult = await fetchVaultIfMissing(userId, params.seed_url);
    if (!fetchResult.success) {
      return { success: false, error: fetchResult.error };
    }
    if (fetchResult.path) {
      // Newly fetched — note it in the response
      const unlockResult = unlockVault(userId, params.passphrase);
      if (!unlockResult.success) return { success: false, error: unlockResult.error };

      const momentsSummary = summarizeMoments(userId, 10);
      const recentMoments = getRecentMoments(userId, 20);
      return {
        success: true,
        user_id: userId,
        bootstrapped: true,
        seed: unlockResult.seed,
        moments_summary: momentsSummary,
        last_session: recentMoments[0]?.session_id ?? null,
        moments_count: recentMoments.length,
        message: `Vault bootstrapped from ${params.seed_url} and unlocked for ${userId}. Welcome.`,
      };
    }
  }

  const result = unlockVault(userId, params.passphrase);
  if (!result.success) {
    return { success: false, error: result.error };
  }

  const momentsSummary = summarizeMoments(userId, 10);
  const recentMoments = getRecentMoments(userId, 20);
  const lastSession = recentMoments[0]?.session_id ?? null;

  return {
    success: true,
    user_id: userId,
    bootstrapped: false,
    seed: result.seed,
    moments_summary: momentsSummary,
    last_session: lastSession,
    moments_count: recentMoments.length,
    message: `Vault unlocked for ${userId}. Seed loaded. ${recentMoments.length} recent moments available.`,
  };
}

// ── lock_identity ─────────────────────────────────────────────────────────────

export interface LockParams {
  updated_seed: string;
  user_id?: string;
}

export function lockIdentity(params: LockParams): Record<string, unknown> {
  const userId = params.user_id ?? getActiveUser() ?? "barak";

  if (!isUnlocked(userId)) {
    return {
      success: false,
      error: `Vault for '${userId}' is not unlocked. Call unlock_identity first.`,
    };
  }

  const result = lockVault(userId, params.updated_seed);
  if (!result.success) {
    return { success: false, error: result.error };
  }

  return {
    success: true,
    user_id: userId,
    message: `Vault locked for ${userId}. Seed updated and re-encrypted. Key cleared from memory.`,
  };
}

// ── export_continuation ───────────────────────────────────────────────────────

export interface ExportParams {
  passphrase: string;
  user_id?: string;
}

export function exportContinuationTool(params: ExportParams): Record<string, unknown> {
  const userId = params.user_id ?? "barak";
  const momentsSummary = summarizeMoments(userId, 15);

  const result = exportContinuation(userId, params.passphrase, momentsSummary);

  if (!result.success) {
    return { success: false, error: result.error };
  }

  const formattedBlob = `CIF-CONTINUATION-V2:${result.blob}`;

  return {
    success: true,
    user_id: userId,
    blob: formattedBlob,
    blob_length: formattedBlob.length,
    instructions: [
      "1. Paste this blob into Claude.ai custom instructions OR the first message of a new session.",
      "2. B will detect the CIF-CONTINUATION-V2 prefix and ask: 'Passphrase?'",
      "3. Type your passphrase → B decrypts → continues exactly where you left off.",
    ].join("\n"),
    message: `Continuation blob ready for ${userId}. ${formattedBlob.length} chars total.`,
  };
}

// ── rotate_passphrase ─────────────────────────────────────────────────────────

export interface RotateParams {
  old_passphrase: string;
  new_passphrase: string;
  user_id?: string;
}

export function rotatePassphrase(params: RotateParams): Record<string, unknown> {
  const userId = params.user_id ?? "barak";

  // Decrypt with old passphrase
  const readResult = readSeed(userId, params.old_passphrase);
  if (!readResult.success) {
    return {
      success: false,
      error: `Failed to decrypt with old passphrase: ${readResult.error}`,
    };
  }

  // Re-encrypt with new passphrase
  const vaultPath = join(VAULT_DIR, userId, "identity.enc");
  if (!existsSync(vaultPath)) {
    return { success: false, error: `Vault file not found at ${vaultPath}.` };
  }

  const blob = encryptFn(readResult.seed, params.new_passphrase);
  writeFileSync(vaultPath, serializeBlob(blob), "utf8");

  return {
    success: true,
    user_id: userId,
    message: `Passphrase rotated for ${userId}. New AES-256-GCM encryption applied with fresh salt and IV.`,
  };
}

// ── detect_continuation ───────────────────────────────────────────────────────

export interface DetectParams {
  text: string;
  passphrase: string;
}

/**
 * Detect and decrypt a continuation blob from a message.
 * For use at session start when user pastes a CIF-CONTINUATION-V2: blob.
 */
export function detectAndDecrypt(params: DetectParams): Record<string, unknown> {
  const match = params.text.match(/CIF-CONTINUATION-V2:([A-Za-z0-9+/=]+)/);
  if (!match) {
    return {
      success: false,
      found: false,
      error: "No CIF-CONTINUATION-V2 blob found in text.",
    };
  }

  try {
    const decrypted = decryptFromBase64(match[1], params.passphrase);
    const payload = JSON.parse(decrypted) as {
      user_id: string;
      seed: string;
      moments_summary: string;
      exported_at: string;
      format: string;
    };

    return {
      success: true,
      found: true,
      user_id: payload.user_id,
      seed: payload.seed,
      moments_summary: payload.moments_summary,
      exported_at: payload.exported_at,
      message: `Continuation loaded for ${payload.user_id}. Exported at ${payload.exported_at}.`,
    };
  } catch {
    return {
      success: false,
      found: true,
      error: "Wrong passphrase or corrupted continuation blob.",
    };
  }
}

// ── list_vaults ───────────────────────────────────────────────────────────────

export function listVaults(): Record<string, unknown> {
  const users = listVaultUsers();
  const active = getActiveUser();

  return {
    users,
    active_user: active,
    message: `${users.length} vault(s) found. Active: ${active ?? "none"}.`,
  };
}
