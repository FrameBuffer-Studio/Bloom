export {};

const port = Number(process.env["PORT"] ?? 8080);

try {
  const response = await fetch(`http://127.0.0.1:${port}/api/v1/health`, { signal: AbortSignal.timeout(3000) });
  const body = (await response.json()) as { status?: unknown };
  process.exit(response.ok && body.status === "ok" ? 0 : 1);
} catch {
  process.exit(1);
}
