export interface CreditLink {
  readonly label: string;
  readonly url: string;
}

export interface CreditPerson {
  readonly name: string;
  readonly role: string;
  readonly url: string;
}

export interface Credits {
  readonly project: string;
  readonly repository: string;
  readonly license: string;
  readonly authors: readonly CreditPerson[];
  readonly donations: readonly CreditLink[];
  readonly links: readonly CreditLink[];
  readonly thanks: readonly CreditPerson[];
}

export const CREDITS_FILE = "credits.json";

const MAX_TEXT = 120;
const MAX_ITEMS = 30;

export const EMPTY_CREDITS: Credits = {
  project: "Bloom",
  repository: "",
  license: "",
  authors: [],
  donations: [],
  links: [],
  thanks: [],
};

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function text(value: unknown, field: string): string {
  if (value === undefined || value === null) {
    return "";
  }
  if (typeof value !== "string" || value.length > MAX_TEXT || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new Error(`credits: "${field}" must be a single-line string of at most ${MAX_TEXT} characters`);
  }
  return value.trim();
}

function url(value: unknown, field: string): string {
  const raw = text(value, field);
  if (raw === "") {
    return "";
  }
  const withScheme = /^[a-z][a-z\d+.-]*:/i.test(raw) ? raw : `https://${raw}`;
  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    throw new Error(`credits: "${field}" is not a valid URL`);
  }
  if (parsed.protocol !== "https:") {
    throw new Error(`credits: "${field}" must use https://`);
  }
  return parsed.href;
}

function list<T>(value: unknown, field: string, parse: (item: unknown, path: string) => T | null): T[] {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value) || value.length > MAX_ITEMS) {
    throw new Error(`credits: "${field}" must be an array of at most ${MAX_ITEMS} items`);
  }
  return value.map((item, index) => parse(item, `${field}[${index}]`)).filter((item): item is T => item !== null);
}

function person(value: unknown, path: string): CreditPerson | null {
  const source = record(value);
  const entry = { name: text(source["name"], `${path}.name`), role: text(source["role"], `${path}.role`), url: url(source["url"], `${path}.url`) };
  return entry.name === "" ? null : entry;
}

function linkEntry(value: unknown, path: string): CreditLink | null {
  const source = record(value);
  const entry = { label: text(source["label"], `${path}.label`), url: url(source["url"], `${path}.url`) };
  return entry.label === "" || entry.url === "" ? null : entry;
}

export function parseCredits(value: unknown): Credits {
  const source = record(value);
  return {
    project: text(source["project"], "project") || EMPTY_CREDITS.project,
    repository: url(source["repository"], "repository"),
    license: text(source["license"], "license"),
    authors: list(source["authors"], "authors", person),
    donations: list(source["donations"], "donations", linkEntry),
    links: list(source["links"], "links", linkEntry),
    thanks: list(source["thanks"], "thanks", person),
  };
}

export function hasCredits(credits: Credits): boolean {
  return (
    credits.repository !== "" ||
    credits.authors.length > 0 ||
    credits.donations.length > 0 ||
    credits.links.length > 0 ||
    credits.thanks.length > 0
  );
}
