import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import type { DocsContent } from "../../shared/content.ts";
import { LANGUAGES, contentFile } from "../../shared/languages.ts";
import type { Language } from "../../shared/languages.ts";
import { createApi } from "./api.ts";
import { createHandler } from "./app.ts";
import { loadConfig } from "./config.ts";
import { createRateLimiter } from "./rate-limit.ts";
import { loadStaticFiles } from "./static-files.ts";

const SHUTDOWN_GRACE_MS = 5000;
const PRUNE_INTERVAL_MS = 60_000;

async function main(): Promise<void> {
  const config = loadConfig();
  const entries = await Promise.all(
    LANGUAGES.map(async (language) => [language, JSON.parse(await readFile(path.join(config.webRoot, contentFile(language)), "utf8")) as DocsContent] as const),
  );
  const contents = Object.fromEntries(entries) as Record<Language, DocsContent>;
  const files = await loadStaticFiles(config.webRoot);
  const limiter = createRateLimiter(config.rateLimit.capacity, config.rateLimit.refillPerSecond);

  const handler = createHandler({
    files,
    api: createApi(contents, Date.now()),
    limiter,
    trustProxy: config.trustProxy,
    log: config.logRequests ? (entry) => console.log(JSON.stringify({ level: "info", ...entry })) : () => undefined,
  });

  const server = createServer({ maxHeaderSize: 16 * 1024, requestTimeout: 10_000, headersTimeout: 8_000, keepAliveTimeout: 5_000 }, handler);
  server.maxHeadersCount = 64;
  server.maxRequestsPerSocket = 1000;
  server.on("clientError", (_, socket) => {
    if (socket.writable) {
      socket.end("HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n");
    } else {
      socket.destroy();
    }
  });

  setInterval(() => limiter.prune(), PRUNE_INTERVAL_MS).unref();

  const shutdown = (signal: string): void => {
    console.log(JSON.stringify({ level: "info", message: `${signal} received, shutting down` }));
    server.close(() => process.exit(0));
    server.closeIdleConnections();
    setTimeout(() => process.exit(1), SHUTDOWN_GRACE_MS).unref();
  };
  process.once("SIGTERM", () => shutdown("SIGTERM"));
  process.once("SIGINT", () => shutdown("SIGINT"));

  server.listen(config.port, config.host, () => {
    console.log(
      JSON.stringify({
        level: "info",
        message: "bloom docs server listening",
        url: `http://${config.host}:${config.port}`,
        files: files.size,
        languages: LANGUAGES,
      }),
    );
  });
}

main().catch((error: unknown) => {
  console.error(JSON.stringify({ level: "fatal", message: error instanceof Error ? error.message : String(error) }));
  process.exit(1);
});
