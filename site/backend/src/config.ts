import path from "node:path";
import { fileURLToPath } from "node:url";

export interface Config {
  readonly host: string;
  readonly port: number;
  readonly webRoot: string;
  readonly trustProxy: boolean;
  readonly rateLimit: { readonly capacity: number; readonly refillPerSecond: number };
  readonly logRequests: boolean;
}

function integer(value: string | undefined, fallback: number, min: number, max: number): number {
  if (value === undefined || value.trim() === "") {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`Expected an integer between ${min} and ${max}, got "${value}"`);
  }
  return parsed;
}

function flag(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value.trim() === "") {
    return fallback;
  }
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const defaultRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "web");
  return {
    host: env["HOST"]?.trim() || "0.0.0.0",
    port: integer(env["PORT"], 8080, 1, 65535),
    webRoot: path.resolve(env["WEB_ROOT"] ?? defaultRoot),
    trustProxy: flag(env["TRUST_PROXY"], false),
    rateLimit: {
      capacity: integer(env["RATE_LIMIT_BURST"], 120, 1, 100_000),
      refillPerSecond: integer(env["RATE_LIMIT_PER_SECOND"], 20, 1, 100_000),
    },
    logRequests: flag(env["LOG_REQUESTS"], true),
  };
}
