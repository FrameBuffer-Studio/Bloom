const PREFIX = "bloom-docs:";

function store(kind: "local" | "session"): Storage | null {
  try {
    return kind === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

export function readValue(key: string, kind: "local" | "session" = "local"): string | null {
  try {
    return store(kind)?.getItem(PREFIX + key) ?? null;
  } catch {
    return null;
  }
}

export function writeValue(key: string, value: string, kind: "local" | "session" = "local"): void {
  try {
    store(kind)?.setItem(PREFIX + key, value);
  } catch {
    return;
  }
}

export function readList(key: string, limit: number): string[] {
  const raw = readValue(key);
  if (raw === null) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string" && item.length <= 200).slice(-limit)
      : [];
  } catch {
    return [];
  }
}

export function writeList(key: string, values: readonly string[]): void {
  writeValue(key, JSON.stringify(values));
}
