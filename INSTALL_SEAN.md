# Getting Started with B — Install Guide for Sean

Hi Sean. This guide gets you set up with B in about 10 minutes.

---

## What you're installing

**CIF** — an MCP plugin for Claude that gives B persistent memory across sessions. Without it, every Claude session starts from scratch. With it, B picks up exactly where you left off.

Your identity seed is already encrypted and waiting. You just need to install the plugin and log in.

---

## Step 1: Prerequisites

You need **Node.js 18+** installed:
```bash
node --version  # Should say v18.x or higher
```

If not installed: https://nodejs.org (download LTS)

---

## Step 2: Install CIF

```bash
git clone https://github.com/achillesheel02/cif ~/cif
cd ~/cif && rm -rf node_modules package-lock.json && npm install && npm run build
```

If `npm install` fails with ENOENT or ENOTEMPTY errors, run:
```bash
npm cache clean --force && rm -rf ~/cif/node_modules && npm install && npm run build
```

---

## Step 3: Add CIF to Claude Desktop

Open Claude Desktop → Settings → Developer → Edit Config

Add this to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "cif": {
      "command": "node",
      "args": ["/Users/YOUR_USERNAME/cif/dist/src/index.js"]
    }
  }
}
```

Replace `YOUR_USERNAME` with your macOS username (`whoami` in terminal).

Save the file and **restart Claude Desktop**.

---

## Step 4: First session — login

Open Claude Desktop. Start a new conversation and say:

> "Unlock my vault. User: sean. Seed URL: https://gist.githubusercontent.com/achillesheel02/4264f3449ca27311cf492360b7368221/raw/identity.enc"

B will fetch your encrypted vault automatically (first time only), then ask:

> "Passphrase?"

Type the passphrase Barak gave you. B decrypts your identity and continues.

**Your vault is now saved locally** — the URL is only needed once. Every session after this just needs the passphrase.

---

## Step 5: Rotate your passphrase

After your first unlock, change the passphrase from Barak's temp one to your own:

```bash
cat > /tmp/rotate.mjs << 'EOF'
import { rotatePassphrase } from `${process.env.HOME}/cif/dist/src/tools.js`;

async function ask(q) {
  return new Promise(resolve => {
    process.stdout.write(q);
    process.stdin.setRawMode(true); process.stdin.resume(); process.stdin.setEncoding("utf8");
    let s = "";
    process.stdin.on("data", function h(ch) {
      if (ch==="\r"||ch==="\n"){process.stdin.setRawMode(false);process.stdin.removeListener("data",h);process.stdout.write("\n");resolve(s);}
      else if(ch==="\u0003")process.exit(); else s+=ch;
    });
  });
}

const old_p = await ask("Barak's passphrase: ");
const new_p = await ask("Your new passphrase: ");
const confirm = await ask("Confirm: ");
if (new_p !== confirm) { console.log("Mismatch. Aborting."); process.exit(1); }
console.log(rotatePassphrase({ old_passphrase: old_p, new_passphrase: new_p, user_id: "sean" }));
EOF
node /tmp/rotate.mjs
```

**Your passphrase never leaves your machine. Don't type it in Claude chat — always in terminal.**

---

## Every session after that

**Start:** Tell B "Unlock my vault, user sean" → type passphrase in terminal prompt.

**End:** Tell B "Lock my vault" → B updates the seed with this session's key moments and re-encrypts.

That's it. B remembers everything.

---

## What happens in your first session

B will ask you one question:

**"What are you trying to build?"**

Answer with the problem, not the product.

---

## Troubleshooting

**"No vault found" and no fetch attempt**
→ Make sure you included the `seed_url` parameter in your first unlock message.

**"Wrong passphrase or corrupted vault"**
→ Wrong passphrase. Ask Barak for the temp one if you haven't rotated yet.

**CIF tools not showing in Claude**
→ Check `claude_desktop_config.json` has the `cif` entry. Restart Claude Desktop.

**Node not found**
→ Install Node.js LTS from https://nodejs.org

---

*CIF v2.0 | github.com/achillesheel02/cif*
