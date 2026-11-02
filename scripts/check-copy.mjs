// Banned-words and em-dash check on user-facing copy. Exits 1 on any hit.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, basename } from "node:path";

const root = process.cwd();
const EXEMPT = new Set(["Footer.astro", "Disclaimer.astro"]);
const BANNED = [
  /\bshould\b/i, /\brecommend\w*/i, /\bsignal\w*/i, /\bpredict\w*/i, /\bforecast\w*/i, /\bguarantee\w*/i,
  /\bmoon\b/i, /\bbullish\b/i, /\bbearish\b/i, /\bundervalued\b/i, /\bovervalued\b/i,
  /\badvice\b/i, /\bbest time\b/i, /\bopportunity\b/i,
];

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

const files = [
  ...walk(join(root, "src")).filter((f) => f.endsWith(".astro")),
  join(root, "src/lib/calc/messages.ts"),
];

let failed = false;
for (const file of files) {
  const exempt = EXEMPT.has(basename(file));
  const lines = readFileSync(file, "utf8").split("\n");
  lines.forEach((line, i) => {
    const where = `${relative(root, file)}:${i + 1}`;
    if (line.includes("—")) {
      console.error(`${where}: em dash in user-facing copy`);
      failed = true;
    }
    if (exempt) return;
    for (const re of BANNED) {
      const m = line.match(re);
      if (m) {
        console.error(`${where}: banned word "${m[0]}"`);
        failed = true;
      }
    }
  });
}
if (failed) process.exit(1);
console.log(`check-copy: ${files.length} files clean`);
