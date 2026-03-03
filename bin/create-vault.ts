#!/usr/bin/env node
/**
 * CIF — Vault Creation CLI
 *
 * Creates a new identity vault with interactive passphrase entry.
 * Passphrase is entered at the terminal — never passed through the AI layer.
 *
 * Usage: node dist/bin/create-vault.js
 */

import { createInterface } from "readline";
import { readFileSync } from "fs";
import { createVault } from "../src/vault.js";

async function ask(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function askHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    process.stdout.write(question);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");
    let s = "";
    const handler = (ch: string) => {
      if (ch === "\r" || ch === "\n") {
        process.stdin.setRawMode(false);
        process.stdin.removeListener("data", handler);
        process.stdin.pause();
        process.stdout.write("\n");
        resolve(s);
      } else if (ch === "\u0003") {
        process.exit();
      } else if (ch === "\u007f") {
        s = s.slice(0, -1);
      } else {
        s += ch;
      }
    };
    process.stdin.on("data", handler);
  });
}

async function main() {
  console.log("CIF — Create Identity Vault");
  console.log("Vault creation is terminal-only. Passphrase never passes through the AI.\n");

  const userId = await ask("User ID (e.g. 'barak', 'sean'): ");
  if (!userId) {
    console.error("User ID is required.");
    process.exit(1);
  }

  const seedPath = await ask("Seed file path (absolute path to .md or .txt): ");
  let seed: string;
  try {
    seed = readFileSync(seedPath, "utf8");
    console.log(`Seed loaded: ${seed.length} characters.`);
  } catch {
    console.error(`Could not read seed file: ${seedPath}`);
    process.exit(1);
  }

  const passphrase = await askHidden("Passphrase: ");
  if (!passphrase) {
    console.error("Passphrase is required.");
    process.exit(1);
  }

  const confirm = await askHidden("Confirm passphrase: ");
  if (passphrase !== confirm) {
    console.error("Passphrases do not match. Aborting.");
    process.exit(1);
  }

  const result = createVault(userId, passphrase, seed);
  if (!result.success) {
    console.error(`Error: ${result.error}`);
    process.exit(1);
  }

  console.log(`\nVault created: ${result.path}`);
  console.log("AES-256-GCM, PBKDF2 100k rounds. Passphrase never written to disk.");
  console.log("Store your passphrase securely — it cannot be recovered.");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
