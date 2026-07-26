import { readdir, readFile } from "node:fs/promises";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const legacyPrefix = "memorag" + ":";
const allowedExtensions = new Set([
  ".cjs",
  ".js",
  ".json",
  ".md",
  ".mjs",
  ".sh",
  ".ts",
  ".tsx",
  ".yaml",
  ".yml",
]);
const ignoredDirectoryNames = new Set(["generated", "node_modules"]);
const activeRoots = [
  ".github",
  "docs",
  "scripts",
  "skills",
];
const activeFiles = ["README.md", "package.json", "Taskfile.yml"];

async function listFiles(path) {
  const entries = await readdir(path, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.isDirectory() && ignoredDirectoryNames.has(entry.name)) {
      continue;
    }

    const entryPath = join(path, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(entryPath)));
    } else if (entry.isFile() && allowedExtensions.has(extname(entry.name))) {
      files.push(entryPath);
    }
  }

  return files;
}

const files = [
  ...activeFiles.map((path) => join(repositoryRoot, path)),
  ...(await Promise.all(activeRoots.map((path) => listFiles(join(repositoryRoot, path))))).flat(),
];
const violations = [];

for (const path of files) {
  const lines = (await readFile(path, "utf8")).split(/\r?\n/u);
  for (const [index, line] of lines.entries()) {
    if (line.includes(legacyPrefix)) {
      violations.push(`${relative(repositoryRoot, path)}:${index + 1}: ${line.trim()}`);
    }
  }
}

if (violations.length > 0) {
  console.error("Legacy Taskfile alias references are not allowed in active files:");
  console.error(violations.join("\n"));
  process.exitCode = 1;
} else {
  console.log("No legacy Taskfile alias references found in active files.");
}
