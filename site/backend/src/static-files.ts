import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { brotliCompressSync, constants, gzipSync } from "node:zlib";

export interface StaticFile {
  readonly body: Buffer;
  readonly brotli: Buffer | null;
  readonly gzip: Buffer | null;
  readonly type: string;
  readonly etag: string;
  readonly cacheControl: string;
}

const TYPES: Readonly<Record<string, string>> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json",
};

const COMPRESSIBLE = new Set([".html", ".css", ".js", ".json", ".svg", ".txt", ".webmanifest"]);
const COMPRESS_MIN_BYTES = 1024;

function cacheControlFor(urlPath: string): string {
  if (urlPath.startsWith("/assets/")) {
    return "public, max-age=31536000, immutable";
  }
  if (urlPath.endsWith(".html") || urlPath.endsWith(".json")) {
    return "no-cache";
  }
  return "public, max-age=3600";
}

async function listFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        return listFiles(full);
      }
      return entry.isFile() ? [full] : [];
    }),
  );
  return nested.flat();
}

export async function loadStaticFiles(root: string): Promise<ReadonlyMap<string, StaticFile>> {
  const files = new Map<string, StaticFile>();
  for (const file of await listFiles(root)) {
    const extension = path.extname(file).toLowerCase();
    const type = TYPES[extension];
    if (type === undefined) {
      continue;
    }

    const urlPath = `/${path.relative(root, file).split(path.sep).join("/")}`;
    const body = await readFile(file);
    const compressible = COMPRESSIBLE.has(extension) && body.length >= COMPRESS_MIN_BYTES;
    files.set(urlPath, {
      body,
      brotli: compressible ? brotliCompressSync(body, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }) : null,
      gzip: compressible ? gzipSync(body, { level: 9 }) : null,
      type,
      etag: `"${createHash("sha256").update(body).digest("base64url").slice(0, 27)}"`,
      cacheControl: cacheControlFor(urlPath),
    });
  }
  return files;
}

export function negotiateEncoding(header: string | undefined, file: StaticFile): { readonly body: Buffer; readonly encoding: string | null } {
  const accepted = new Set(
    (header ?? "")
      .split(",")
      .map((part) => part.trim().toLowerCase())
      .filter((part) => !/;\s*q=0(?:\.0*)?$/.test(part))
      .map((part) => part.split(";")[0] ?? ""),
  );
  if (file.brotli && accepted.has("br")) {
    return { body: file.brotli, encoding: "br" };
  }
  if (file.gzip && accepted.has("gzip")) {
    return { body: file.gzip, encoding: "gzip" };
  }
  return { body: file.body, encoding: null };
}
