import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const webRoot = join(root, "web");
const mountRoots = new Map([
  ["data", join(root, "data")],
  ["kuwaya-geo", join(root, "docs", "ref", "kuwaya-geo")],
  ["modules", join(root, "node_modules")],
]);
const files = [];
const errors = [];

function walk(directory) {
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) walk(path);
    else if ([".html", ".js", ".css"].includes(extname(path))) files.push(path);
  }
}

function targetFor(source, reference) {
  const clean = reference.split(/[?#]/, 1)[0];
  if (!clean || clean.startsWith("#") || /^(?:data:|https?:|mailto:)/i.test(clean)) return null;
  if (extname(source) === ".js" && !clean.startsWith(".") && !clean.startsWith("/")) return null;
  if (!clean.startsWith("/")) return resolve(dirname(source), clean);

  const [mount, ...rest] = clean.slice(1).split("/");
  return join(mountRoots.get(mount) ?? webRoot, ...(mountRoots.has(mount) ? rest : [mount, ...rest]));
}

function check(source, reference) {
  let target = targetFor(source, reference);
  if (!target) return;
  if (existsSync(target) && statSync(target).isDirectory()) target = join(target, "index.html");
  if (!existsSync(target)) errors.push(`${source.slice(root.length + 1)} -> ${reference}`);
}

walk(webRoot);
for (const file of files) {
  if (file.endsWith(join("maplibre-gl", "maplibre-gl.js"))) continue;
  const source = readFileSync(file, "utf8");
  const patterns = [
    /\b(?:src|href)\s*=\s*["']([^"']+)["']/g,
    /\bfrom\s*["']([^"']+)["']/g,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
    /url\(\s*["']?([^)'"\s]+)["']?\s*\)/g,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) check(file, match[1]);
  }
}

if (errors.length) {
  console.error(`Webローカル参照エラー (${errors.length}件):\n${errors.join("\n")}`);
  process.exitCode = 1;
} else {
  console.log(`Webローカル参照: OK (${files.length}ファイル)`);
}
