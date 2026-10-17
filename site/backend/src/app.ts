import type { IncomingMessage, ServerResponse } from "node:http";
import { API_HEADER, API_VERSION } from "../../shared/content.ts";
import { SECURITY_HEADERS } from "../../shared/security.ts";
import type { ApiHandler } from "./api.ts";
import type { RateLimiter } from "./rate-limit.ts";
import { negotiateEncoding } from "./static-files.ts";
import type { StaticFile } from "./static-files.ts";

export interface RequestLog {
  readonly method: string;
  readonly path: string;
  readonly status: number;
  readonly durationMs: number;
}

export interface HandlerDependencies {
  readonly files: ReadonlyMap<string, StaticFile>;
  readonly api: ApiHandler;
  readonly limiter: RateLimiter;
  readonly trustProxy: boolean;
  readonly log: (entry: RequestLog) => void;
}

const MAX_URL_LENGTH = 2048;
const ALLOWED_METHODS = "GET, HEAD, OPTIONS";
const API_PREFIX = "/api/";
const NOT_FOUND_PAGE = "/404.html";

function clientKey(request: IncomingMessage, trustProxy: boolean): string {
  if (trustProxy) {
    const forwarded = request.headers["x-forwarded-for"];
    const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(",")[0]?.trim();
    if (first) {
      return first.slice(0, 64);
    }
  }
  return request.socket.remoteAddress ?? "unknown";
}

function decodePath(rawUrl: string): string | null {
  try {
    const pathname = decodeURIComponent(new URL(rawUrl, "http://localhost").pathname);
    if (pathname.includes("\0") || pathname.includes("\\") || pathname.split("/").includes("..")) {
      return null;
    }
    return pathname;
  } catch {
    return null;
  }
}

function sendJson(response: ServerResponse, request: IncomingMessage, status: number, body: unknown, cacheControl: string): void {
  const payload = Buffer.from(JSON.stringify(body));
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": payload.length,
    "Cache-Control": cacheControl,
    "Access-Control-Allow-Origin": "*",
  });
  response.end(request.method === "HEAD" ? undefined : payload);
}

function sendFile(response: ServerResponse, request: IncomingMessage, file: StaticFile, status = 200): void {
  const headers: Record<string, string | number> = {
    "Content-Type": file.type,
    "Cache-Control": file.cacheControl,
    ETag: file.etag,
    Vary: "Accept-Encoding",
  };

  if (status === 200 && request.headers["if-none-match"] === file.etag) {
    response.writeHead(304, headers);
    response.end();
    return;
  }

  const { body, encoding } = negotiateEncoding(request.headers["accept-encoding"], file);
  if (encoding) {
    headers["Content-Encoding"] = encoding;
  }
  headers["Content-Length"] = body.length;
  response.writeHead(status, headers);
  response.end(request.method === "HEAD" ? undefined : body);
}

function sendText(response: ServerResponse, status: number, text: string, extra: Record<string, string> = {}): void {
  response.writeHead(status, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", ...extra });
  response.end(text);
}

export function createHandler(dependencies: HandlerDependencies): (request: IncomingMessage, response: ServerResponse) => void {
  const { files, api, limiter, trustProxy, log } = dependencies;

  return (request, response) => {
    const started = performance.now();
    const method = request.method ?? "GET";
    const rawUrl = request.url ?? "/";
    let loggedPath = "/";

    response.on("finish", () => {
      log({ method, path: loggedPath, status: response.statusCode, durationMs: Math.round((performance.now() - started) * 10) / 10 });
    });
    request.resume();

    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      response.setHeader(name, value);
    }
    response.setHeader(API_HEADER, API_VERSION);

    try {
      if (rawUrl.length > MAX_URL_LENGTH) {
        sendText(response, 414, "URI Too Long");
        return;
      }

      const pathname = decodePath(rawUrl);
      if (pathname === null) {
        sendText(response, 400, "Bad Request");
        return;
      }
      loggedPath = pathname.slice(0, 200);

      if (method === "OPTIONS") {
        response.writeHead(204, {
          Allow: ALLOWED_METHODS,
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, HEAD",
          "Access-Control-Max-Age": "86400",
        });
        response.end();
        return;
      }
      if (method !== "GET" && method !== "HEAD") {
        sendText(response, 405, "Method Not Allowed", { Allow: ALLOWED_METHODS });
        return;
      }

      const quota = limiter.take(clientKey(request, trustProxy));
      if (!quota.allowed) {
        response.setHeader("Retry-After", String(quota.retryAfterSeconds));
        sendJson(response, request, 429, { error: "rate_limited", message: "Too many requests" }, "no-store");
        return;
      }

      if (pathname.startsWith(API_PREFIX)) {
        const result = api(pathname, new URL(rawUrl, "http://localhost").searchParams);
        sendJson(response, request, result.status, result.body, result.cacheControl);
        return;
      }

      const file = files.get(pathname.endsWith("/") ? `${pathname}index.html` : pathname);
      if (file) {
        sendFile(response, request, file);
        return;
      }

      const notFound = files.get(NOT_FOUND_PAGE);
      if (notFound) {
        sendFile(response, request, notFound, 404);
      } else {
        sendText(response, 404, "Not Found");
      }
    } catch (error) {
      console.error(JSON.stringify({ level: "error", message: error instanceof Error ? error.message : String(error) }));
      if (!response.headersSent) {
        sendText(response, 500, "Internal Server Error");
      } else {
        response.destroy();
      }
    }
  };
}
