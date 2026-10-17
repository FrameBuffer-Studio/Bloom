import { createHash } from "node:crypto";
import { watch } from "node:fs";
import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import type { Metafile } from "esbuild";
import { compileDocs } from "../shared/compile.ts";
import type { DocsContent } from "../shared/content.ts";
import { CREDITS_FILE, parseCredits } from "../shared/credits.ts";
import { LANGUAGES, contentFile } from "../shared/languages.ts";
import type { Language } from "../shared/languages.ts";
import { contentSecurityPolicy } from "../shared/security.ts";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const docsDir = path.resolve(process.env["DOCS_DIR"] ?? path.join(root, "..", "docs"));
const dist = path.join(root, "dist");
const web = path.join(dist, "web");
const server = path.join(dist, "server");
const frontend = path.join(root, "frontend");

async function readVersion(): Promise<string> {
  const manifest: unknown = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
  const version = typeof manifest === "object" && manifest !== null ? (manifest as { version?: unknown }).version : undefined;
  return typeof version === "string" ? version : "0.0.0";
}

async function compileLanguage(language: Language, version: string): Promise<DocsContent> {
  const directory = path.join(docsDir, language);
  const files = (await readdir(directory)).filter((file) => file.toLowerCase().endsWith(".md")).sort();
  if (files.length === 0) {
    throw new Error(`No Markdown files found in ${directory}`);
  }
  const documents = await Promise.all(
    files.map(async (fileName) => ({ fileName, markdown: await readFile(path.join(directory, fileName), "utf8") })),
  );
  return compileDocs(documents, version);
}

function assertSameChapters(contents: readonly (readonly [Language, DocsContent])[]): void {
  const signatures = contents.map(([language, content]) => [language, content.sections.map((section) => section.slug).join(",")] as const);
  const [first] = signatures;
  for (const [language, signature] of signatures) {
    if (first !== undefined && signature !== first[1]) {
      throw new Error(`docs/${language} has different chapters than docs/${first[0]}`);
    }
  }
}

async function buildContent(version: string): Promise<void> {
  const contents = await Promise.all(LANGUAGES.map(async (language) => [language, await compileLanguage(language, version)] as const));
  assertSameChapters(contents);
  for (const [language, content] of contents) {
    await writeFile(path.join(web, contentFile(language)), JSON.stringify(content));
    console.log(`content  ${language} · ${content.sections.length} sections · ${content.api.length} functions · ${content.chunks.length} chunks`);
  }
}

async function buildCredits(): Promise<void> {
  let source: unknown;
  try {
    source = JSON.parse(await readFile(path.join(root, CREDITS_FILE), "utf8"));
  } catch (error) {
    throw new Error(`${CREDITS_FILE} is not valid JSON (separate entries with commas, not semicolons): ${error instanceof Error ? error.message : String(error)}`);
  }
  const credits = parseCredits(source);
  await writeFile(path.join(web, CREDITS_FILE), JSON.stringify(credits));
  console.log(`credits  ${credits.authors.length} authors · ${credits.donations.length} donations · ${credits.links.length} links`);
}

function outputFor(metafile: Metafile, entry: string): string {
  const match = Object.entries(metafile.outputs).find(([, output]) => output.entryPoint === entry);
  if (match === undefined) {
    throw new Error(`esbuild produced no output for ${entry}`);
  }
  return match[0];
}

async function integrity(file: string): Promise<string> {
  return `sha384-${createHash("sha384").update(await readFile(file)).digest("base64")}`;
}

async function buildFrontend(): Promise<void> {
  const scriptEntry = "frontend/src/main.ts";
  const styleEntry = "frontend/styles/main.css";
  const result = await build({
    absWorkingDir: root,
    entryPoints: { app: scriptEntry, styles: styleEntry },
    outdir: path.join(web, "assets"),
    entryNames: "[name]-[hash]",
    assetNames: "[name]-[hash]",
    loader: { ".woff2": "file" },
    bundle: true,
    minify: true,
    format: "esm",
    target: ["es2022", "chrome111", "firefox113", "safari16.4"],
    legalComments: "none",
    metafile: true,
    logLevel: "warning",
  });

  const script = path.join(root, outputFor(result.metafile, scriptEntry));
  const style = path.join(root, outputFor(result.metafile, styleEntry));
  const relative = (file: string): string => `./${path.relative(web, file).split(path.sep).join("/")}`;

  const replacements: Readonly<Record<string, string>> = {
    __CSP__: contentSecurityPolicy({ forHeader: false }),
    __JS__: relative(script),
    __JS_SRI__: await integrity(script),
    __CSS__: relative(style),
    __CSS_SRI__: await integrity(style),
  };
  const template = await readFile(path.join(frontend, "index.html"), "utf8");
  const html = template.replace(/__[A-Z_]+__/g, (token) => replacements[token] ?? token);

  await writeFile(path.join(web, "index.html"), html);
  await writeFile(path.join(web, "404.html"), html);
  await writeFile(path.join(web, ".nojekyll"), "");
  await cp(path.join(frontend, "public"), web, { recursive: true });
  await cp(path.join(frontend, "fonts", "OFL.txt"), path.join(web, "assets", "JetBrainsMono-OFL.txt"));
  console.log(`frontend ${replacements["__JS__"]} · ${replacements["__CSS__"]}`);
}

async function buildServer(): Promise<void> {
  await build({
    absWorkingDir: root,
    entryPoints: { server: "backend/src/server.ts", healthcheck: "backend/src/healthcheck.ts" },
    outdir: server,
    outExtension: { ".js": ".mjs" },
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node24",
    legalComments: "none",
    logLevel: "warning",
  });
  console.log("backend  dist/server/server.mjs · dist/server/healthcheck.mjs");
}

async function buildAll(): Promise<void> {
  const started = performance.now();
  await rm(dist, { recursive: true, force: true });
  await mkdir(web, { recursive: true });
  const version = await readVersion();
  await Promise.all([buildContent(version), buildCredits(), buildFrontend(), buildServer()]);
  console.log(`done     ${Math.round(performance.now() - started)} ms`);
}

function watchAll(): void {
  let timer: NodeJS.Timeout | undefined;
  const schedule = (): void => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      buildAll().catch((error: unknown) => console.error(error));
    }, 120);
  };
  for (const directory of [docsDir, frontend, path.join(root, "shared"), path.join(root, "backend")]) {
    watch(directory, { recursive: true }, schedule);
  }
  console.log("watching docs/, frontend/, shared/, backend/ …");
}

await buildAll();
if (process.argv.includes("--watch")) {
  watchAll();
}
