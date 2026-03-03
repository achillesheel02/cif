/**
 * CIF DB — Thin wrapper around the shared ~/.claude-improve/facets.db
 *
 * Adds:
 *   - user_id column migration on session_moments (for multi-user isolation)
 *   - Per-user moments retrieval for vault operations
 */
import Database from "better-sqlite3";
export declare function getDb(): Database.Database;
export interface Moment {
    id: number;
    session_id: string;
    moment_type: string;
    content: string;
    tags: string | null;
    thread: string | null;
    importance: number;
    user_id: string | null;
    created_at: string;
}
/**
 * Get recent moments for a user (or all users if user_id is null).
 * Ordered by created_at DESC — most recent first.
 */
export declare function getRecentMoments(userId: string | null, limit?: number): Moment[];
/**
 * Get moments since a given ISO timestamp.
 */
export declare function getMomentsSince(userId: string, since: string): Moment[];
/**
 * Get the most recent session_id for a user.
 */
export declare function getLastSessionId(userId: string): string | null;
/**
 * Summarize recent moments into a compact string for seed injection.
 * Returns top-N moments by importance, formatted as bullet list.
 */
export declare function summarizeMoments(userId: string, limit?: number): string;
export declare function closeDb(): void;
//# sourceMappingURL=db.d.ts.map