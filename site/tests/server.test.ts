import assert from "node:assert/strict";
import { createServer, request } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, describe, it } from "node:test";
import { createApi } from "../backend/src/api.ts";
import { createHandler } from "../backend/src/app.ts";
import { createRateLimiter } from "../backend/src/rate-limit.ts";
import type { StaticFile } from "../backend/src/static-files.ts";
import type { DocsContent } from "../shared/content.ts";

const content: DocsContent = {
  version: "9.9.9",
  sections: [{ slug: "canvas", order: 4, title: "Холст", summary: "s", headings: [], blocks: [] }],
  api: [{ name: "canvas:DrawLine", short: "DrawLine", signature: "canvas:DrawLine()", section: "canvas", anchor: "canvas-drawline", summary: "line" }],
  chunks: [{ section: "canvas", anchor: "", heading: "Холст", text: "холст рисует пиксели" }],
};

const html = Buffer.from(`<!doctype html><title>bloom</title>${"x".repeat(2000)}`);
const file = (body: Buffer, type: string, brotli: Buffer | null = null): StaticFile => ({
  body,
  brotli,
  gzip: null,
  type,
  etag: '"abc"',
  cacheControl: "no-cache",
});

const files = new Map<string, StaticFile>([
  ["/index.html", file(html, "text/html; charset=utf-8", Buffer.from([0x1b, 0x00]))],
  ["/404.html", file(Buffer.from("missing"), "text/html; charset=utf-8")],
]);

interface Reply {
  readonly status: number;
  readonly headers: Record<string, string | string[] | undefined>;
  readonly body: Buffer;
}

let baseUrl = "";
const server = createServer(
  createHandler({
    files,
    api: createApi({ ru: content, en: { ...content, version: "en" } }, Date.now()),
    limiter: createRateLimiter(1000, 1000),
    trustProxy: false,
    log: () => undefined,
  }),
);

function send(path: string, options: { method?: string; headers?: Record<string, string> } = {}): Promise<Reply> {
  return new Promise((resolve, reject) => {
    const url = new URL(baseUrl);
    const req = request({ host: url.hostname, port: url.port, path, method: options.method ?? "GET", headers: options.headers ?? {} }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks) }));
    });
    req.on("error", reject);
    req.end();
  });
}

before(async () => {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(() => {
  server.close();
});

describe("static files", () => {
  it("serves index.html with security headers", async () => {
    const reply = await send("/");
    assert.equal(reply.status, 200);
    assert.match(String(reply.headers["content-security-policy"]), /default-src 'none'/);
    assert.match(String(reply.headers["content-security-policy"]), /frame-ancestors 'none'/);
    assert.equal(reply.headers["x-content-type-options"], "nosniff");
    assert.equal(reply.headers["x-frame-options"], "DENY");
    assert.equal(reply.headers["referrer-policy"], "no-referrer");
  });

  it("answers conditional requests with 304", async () => {
    const reply = await send("/index.html", { headers: { "If-None-Match": '"abc"' } });
    assert.equal(reply.status, 304);
    assert.equal(reply.body.length, 0);
  });

  it("negotiates brotli", async () => {
    const reply = await send("/", { headers: { "Accept-Encoding": "gzip, br" } });
    assert.equal(reply.headers["content-encoding"], "br");
  });

  it("refuses path traversal and NUL bytes", async () => {
    assert.equal((await send("/..%2f..%2fpackage.json")).status, 400);
    assert.equal((await send("/%00")).status, 400);
    assert.equal((await send("/assets/../../etc/passwd")).status, 404);
  });

  it("returns the 404 page for unknown files", async () => {
    const reply = await send("/missing.js");
    assert.equal(reply.status, 404);
    assert.equal(reply.body.toString(), "missing");
  });

  it("allows only safe methods", async () => {
    assert.equal((await send("/", { method: "POST" })).status, 405);
    assert.equal((await send("/", { method: "PUT" })).status, 405);
    assert.equal((await send("/", { method: "OPTIONS" })).status, 204);
    const head = await send("/", { method: "HEAD" });
    assert.equal(head.status, 200);
    assert.equal(head.body.length, 0);
  });

  it("rejects overlong URLs", async () => {
    assert.equal((await send(`/${"a".repeat(3000)}`)).status, 414);
  });
});

describe("api", () => {
  it("reports health", async () => {
    const reply = await send("/api/v1/health");
    const body = JSON.parse(reply.body.toString()) as { status: string; version: string };
    assert.equal(reply.status, 200);
    assert.equal(body.status, "ok");
    assert.equal(body.version, "9.9.9");
    assert.equal(reply.headers["cache-control"], "no-store");
  });

  it("returns sections and validates slugs", async () => {
    assert.equal((await send("/api/v1/sections")).status, 200);
    assert.equal((await send("/api/v1/sections/canvas")).status, 200);
    assert.equal((await send("/api/v1/sections/missing")).status, 404);
    assert.equal((await send("/api/v1/sections/BAD%20SLUG")).status, 400);
  });

  it("finds functions", async () => {
    const reply = await send("/api/v1/functions/DrawLine");
    assert.equal(reply.status, 200);
    assert.match(reply.body.toString(), /canvas:DrawLine/);
    assert.equal((await send("/api/v1/functions/%3Cscript%3E")).status, 400);
  });

  it("searches with validated parameters", async () => {
    assert.equal((await send("/api/v1/search?q=%D1%85%D0%BE%D0%BB%D1%81%D1%82")).status, 200);
    assert.equal((await send("/api/v1/search")).status, 400);
    assert.equal((await send("/api/v1/search?q=a&limit=0")).status, 400);
    assert.equal((await send(`/api/v1/search?q=${"a".repeat(101)}`)).status, 400);
  });

  it("selects and validates the language", async () => {
    const english = JSON.parse((await send("/api/v1/health?lang=en")).body.toString()) as { version: string };
    assert.equal(english.version, "en");
    assert.equal((await send("/api/v1/health?lang=de")).status, 400);
  });

  it("returns JSON 404 for unknown routes", async () => {
    const reply = await send("/api/v1/nothing");
    assert.equal(reply.status, 404);
    assert.match(String(reply.headers["content-type"]), /application\/json/);
  });
});

describe("rate limiting", () => {
  it("returns 429 with Retry-After once the bucket is empty", async () => {
    const limited = createServer(
      createHandler({ files, api: createApi({ ru: content, en: { ...content, version: "en" } }, Date.now()), limiter: createRateLimiter(2, 1), trustProxy: false, log: () => undefined }),
    );
    await new Promise<void>((resolve) => limited.listen(0, "127.0.0.1", resolve));
    const previous = baseUrl;
    baseUrl = `http://127.0.0.1:${(limited.address() as AddressInfo).port}`;
    try {
      assert.equal((await send("/")).status, 200);
      assert.equal((await send("/")).status, 200);
      const reply = await send("/");
      assert.equal(reply.status, 429);
      assert.equal(reply.headers["retry-after"], "1");
    } finally {
      baseUrl = previous;
      limited.close();
    }
  });
});
