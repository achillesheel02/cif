/**
 * CIF — Convergent Identity Framework MCP Server
 *
 * Provides encrypted identity continuity for Claude across sessions and substrates.
 * Extends claude-improve-mcp with vault tools.
 *
 * Tools:
 *   create_identity      — initialize encrypted vault for a user
 *   unlock_identity      — decrypt seed at session start
 *   lock_identity        — re-encrypt updated seed at session end
 *   export_continuation  — generate portable encrypted blob for cross-substrate use
 *   rotate_passphrase    — change passphrase without losing the seed
 *   detect_continuation  — detect and decrypt a CIF-CONTINUATION-V2 blob
 *   list_vaults          — show all known vault users
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createIdentity, unlockIdentity, lockIdentity, exportContinuationTool, rotatePassphrase, detectAndDecrypt, listVaults, } from "./tools.js";
export function createServer() {
    const server = new McpServer({
        name: "cif",
        version: "2.0.0",
    });
    // ── create_identity ──────────────────────────────────────────────────────────
    server.tool("create_identity", "Initialize an encrypted identity vault for a new user. Stores the seed encrypted with AES-256-GCM (PBKDF2 100k rounds). Run once per user. For Barak: migrates MEMORY.md. For Sean: pass Ψ_Sean_v2.1 as initial_seed.", {
        passphrase: z.string().describe("Passphrase to encrypt the vault. Never stored — only the derived key is used. Cannot be recovered if lost."),
        initial_seed: z.string().describe("The initial identity seed (compressed notation). For Barak: contents of MEMORY.md. For new users: the Socratic onboarding seed."),
        user_id: z.string().describe("User identifier (e.g. 'barak', 'sean'). Used as directory name under ~/.cif-vault/"),
    }, async (params) => ({
        content: [{ type: "text", text: JSON.stringify(createIdentity(params), null, 2) }],
    }));
    // ── unlock_identity ──────────────────────────────────────────────────────────
    server.tool("unlock_identity", "Decrypt and load identity at session start. Returns the seed (full identity notation) + recent moments summary + last session ID. The derived key is cached in memory for lock_identity — not written to disk.", {
        passphrase: z.string().describe("Vault passphrase."),
        user_id: z.string().optional().describe("User identifier (default: 'barak')."),
        seed_url: z.string().optional().describe("Remote HTTPS URL to fetch encrypted vault from on first use. Safe to use public URLs — the blob is AES-256-GCM encrypted. Example: raw GitHub URL to identity.enc. Only fetches if no local vault exists yet."),
    }, async (params) => ({
        content: [{ type: "text", text: JSON.stringify(await unlockIdentity(params), null, 2) }],
    }));
    // ── lock_identity ────────────────────────────────────────────────────────────
    server.tool("lock_identity", "Re-encrypt the updated seed at session end. Takes the updated seed (with session notes appended) and writes it back encrypted. Clears the key from memory. ALWAYS call this at session end to preserve continuity.", {
        updated_seed: z.string().describe("The updated identity seed — take the seed from unlock_identity and append this session's key moments, decisions, and learnings."),
        user_id: z.string().optional().describe("User identifier (default: active unlocked user)."),
    }, async (params) => ({
        content: [{ type: "text", text: JSON.stringify(lockIdentity(params), null, 2) }],
    }));
    // ── export_continuation ──────────────────────────────────────────────────────
    server.tool("export_continuation", "Generate a portable encrypted blob for cross-substrate use. Output starts with CIF-CONTINUATION-V2: prefix. Paste into Claude.ai custom instructions or first message of any new session — B will ask for the passphrase and continue exactly where you left off.", {
        passphrase: z.string().describe("Vault passphrase (for re-encryption of the export blob)."),
        user_id: z.string().optional().describe("User identifier (default: 'barak')."),
    }, async (params) => ({
        content: [{ type: "text", text: JSON.stringify(exportContinuationTool(params), null, 2) }],
    }));
    // ── rotate_passphrase ────────────────────────────────────────────────────────
    server.tool("rotate_passphrase", "Change the vault passphrase without losing the seed. Decrypts with old passphrase, re-encrypts with new passphrase using fresh salt and IV.", {
        old_passphrase: z.string().describe("Current passphrase."),
        new_passphrase: z.string().describe("New passphrase to set."),
        user_id: z.string().optional().describe("User identifier (default: 'barak')."),
    }, async (params) => ({
        content: [{ type: "text", text: JSON.stringify(rotatePassphrase(params), null, 2) }],
    }));
    // ── detect_continuation ──────────────────────────────────────────────────────
    server.tool("detect_continuation", "Detect and decrypt a CIF-CONTINUATION-V2 blob from a message or custom instructions. Use this when a session starts with a blob pasted in — returns the seed and moments summary so B can continue seamlessly.", {
        text: z.string().describe("The full text to search for a CIF-CONTINUATION-V2 blob."),
        passphrase: z.string().describe("Passphrase to decrypt the blob."),
    }, async (params) => ({
        content: [{ type: "text", text: JSON.stringify(detectAndDecrypt(params), null, 2) }],
    }));
    // ── list_vaults ──────────────────────────────────────────────────────────────
    server.tool("list_vaults", "List all users who have vaults in ~/.cif-vault/ and which vault is currently unlocked.", {}, async () => ({
        content: [{ type: "text", text: JSON.stringify(listVaults(), null, 2) }],
    }));
    return server;
}
//# sourceMappingURL=server.js.map