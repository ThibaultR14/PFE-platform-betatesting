// Hook PostToolUse de Claude Code : formate et lint le fichier que Claude vient de modifier.
// Les erreurs qui restent sont renvoyées à Claude (exit 2) pour qu'il les corrige.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const PRETTIER_EXT = /\.(ts|tsx|js|mjs|cjs|json|md|css|ya?ml)$/i;
const ESLINT_EXT = /\.(ts|tsx|js|mjs|cjs)$/i;
const BOM = String.fromCharCode(0xfeff);

let raw = readFileSync(0, "utf8");
if (raw.startsWith(BOM)) raw = raw.slice(1); // PowerShell ajoute un BOM sur stdin
const input = JSON.parse(raw || "{}");
const filePath = input.tool_input?.file_path;
const root = process.cwd();

if (!filePath || !existsSync(filePath)) process.exit(0);
const rel = path.relative(root, filePath);
// On ignore les fichiers hors du projet et ceux des dépendances.
if (rel.startsWith("..") || path.isAbsolute(rel) || rel.includes("node_modules")) process.exit(0);
if (!PRETTIER_EXT.test(rel)) process.exit(0);

const run = (command) => spawnSync(command, { cwd: root, encoding: "utf8", shell: true });

run(`pnpm exec prettier --write --ignore-unknown "${rel}"`);

if (ESLINT_EXT.test(rel)) {
  const res = run(`pnpm exec eslint --fix --no-warn-ignored "${rel}"`);
  if (res.status !== 0) {
    process.stderr.write(`ESLint signale des erreurs dans ${rel} :\n${res.stdout}${res.stderr}`);
    process.exit(2);
  }
}
