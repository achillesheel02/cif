/**
 * CIF DB — Thin wrapper around the shared ~/.claude-improve/facets.db
 *
 * Adds:
 *   - user_id column migration on session_moments (for multi-user isolation)
 *   - Per-user moments retrieval for vault operations
 */

import Database from "better-sqlite3";
import { existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const DB_PATH = join(homedir(), ".claude-improve", "facets.db");

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;

  if (!existsSync(DB_PATH)) {
    throw new Error(
      `CIF requires claude-improve-mcp to be installed first.\n` +
      `Expected database at: ${DB_PATH}\n` +
      `Install claude-improve-mcp and run at least one session to initialize.`
    );
  }

  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");

  runMigrations(db);

  return db;
}

function runMigrations(db: Database.Database): void {
  // Migration: add user_id column to session_moments
  // SQLite does not support ALTER TABLE ADD COLUMN IF NOT EXISTS — use try/catch
  try {
    db.exec(`ALTER TABLE session_moments ADD COLUMN user_id TEXT DEFAULT NULL`);
  } catch {
    // Column already exists — fine
  }

  // Index for fast per-user queries
  try {
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_moments_user_id
      ON session_moments (user_id, created_at DESC)
    `);
  } catch {
    // Index exists
  }
}

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
export function getRecentMoments(userId: string | null, limit = 50): Moment[] {
  const db = getDb();

  if (userId) {
    return db
      .prepare(
        `SELECT * FROM session_moments
         WHERE user_id = ?
         ORDER BY created_at DESC LIMIT ?`
      )
      .all(userId, limit) as Moment[];
  }

  // Legacy: no user_id — return all (single-user assumption)
  return db
    .prepare(
      `SELECT * FROM session_moments
       ORDER BY created_at DESC LIMIT ?`
    )
    .all(limit) as Moment[];
}

/**
 * Get moments since a given ISO timestamp.
 */
export function getMomentsSince(userId: string, since: string): Moment[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT * FROM session_moments
       WHERE (user_id = ? OR user_id IS NULL)
         AND created_at > ?
       ORDER BY created_at ASC`
    )
    .all(userId, since) as Moment[];
}

/**
 * Get the most recent session_id for a user.
 */
export function getLastSessionId(userId: string): string | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT session_id FROM session_moments
       WHERE user_id = ? OR user_id IS NULL
       ORDER BY created_at DESC LIMIT 1`
    )
    .get(userId) as { session_id: string } | undefined;
  return row?.session_id ?? null;
}

/**
 * Summarize recent moments into a compact string for seed injection.
 * Returns top-N moments by importance, formatted as bullet list.
 */
export function summarizeMoments(userId: string, limit = 10): string {
  const moments = getRecentMoments(userId, limit * 3); // pull extra, filter by importance

  if (moments.length === 0) return "(no recent moments)";

  const sorted = moments
    .sort((a, b) => (b.importance ?? 5) - (a.importance ?? 5))
    .slice(0, limit);

  return sorted
    .map((m) => {
      const tag = m.moment_type.toUpperCase();
      const thread = m.thread ? ` [${m.thread}]` : "";
      const ts = m.created_at.slice(0, 10);
      return `• [${tag}${thread}] ${ts}: ${m.content.slice(0, 200)}`;
    })
    .join("\n");
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
