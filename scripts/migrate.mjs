#!/usr/bin/env node
/**
 * CIF Migration: Create Barak's vault from MEMORY.md
 * Usage: node scripts/migrate.mjs [--user barak] [--seed-file /path/to/seed.md]
 */
import { createInterface } from "readline";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";

// Parse args
const args = process.argv.slice(2);
const userIdIdx = args.indexOf("--user");
const seedIdx = args.indexOf("--seed-file");

const userId = userIdIdx >= 0 ? args[userIdIdx + 1] : "barak";
const seedFile = seedIdx >= 0
  ? args[seedIdx + 1]
  : join(homedir(), ".claude/projects/-Users-bachillah-Documents-living-goods-Ona/memory/MEMORY.md");

if (!existsSync(seedFile)) {
  console.error(`Seed file not found: ${seedFile}`);
  process.exit(1);
}

const seed = readFileSync(seedFile, "utf8");

// Prompt for passphrase (without echoing)
const rl = createInterface({ input: process.stdin, output: process.stdout });

function askPassphrase(question) {
  return new Promise((resolve) => {
    // Disable echo
    if (process.stdin.isTTY) process.stdout.write(question);
    let pass = "";
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", function onData(ch) {
      if (ch === "\n" || ch === "\r" || ch === "\u0004") {
        process.stdin.setRawMode(false);
        process.stdin.removeListener("data", onData);
        process.stdout.write("\n");
        resolve(pass);
      } else if (ch === "\u0003") {
        process.exit();
      } else if (ch === "\u007F") {
        if (pass.length > 0) pass = pass.slice(0, -1);
      } else {
        pass += ch;
      }
    });
  });
}

console.log(`\nCIF Vault Migration`);
console.log(`===================`);
console.log(`User: ${userId}`);
console.log(`Seed file: ${seedFile}`);
console.log(`Seed size: ${seed.length} chars\n`);

const passphrase = await askPassphrase("Enter passphrase for vault (hidden): ");

if (!passphrase || passphrase.length < 6) {
  console.error("Passphrase too short (min 6 chars). Aborting.");
  process.exit(1);
}

const confirm = await askPassphrase("Confirm passphrase: ");
rl.close();

if (passphrase !== confirm) {
  console.error("Passphrases do not match. Aborting.");
  process.exit(1);
}

// Import and create vault
const { createVault } = await import("../dist/src/vault.js");
const result = createVault(userId, passphrase, seed);

if (result.success) {
  console.log(`\n✓ Vault created: ${result.path}`);
  console.log(`  Encrypted with AES-256-GCM (PBKDF2, 100k rounds)`);
  console.log(`  Seed: ${seed.length} chars → encrypted at rest`);
  console.log(`\n  Use unlock_identity(passphrase, user_id="${userId}") to load at session start.`);
  console.log(`  Use lock_identity(updated_seed) to save at session end.`);
} else {
  console.error(`\n✗ Failed: ${result.error}`);
  process.exit(1);
}
