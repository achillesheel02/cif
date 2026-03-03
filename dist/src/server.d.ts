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
export declare function createServer(): McpServer;
//# sourceMappingURL=server.d.ts.map