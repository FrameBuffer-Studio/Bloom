import type { ApiEntry, DocsContent, SearchChunk } from "./content.ts";

export const MAX_QUERY_LENGTH = 100;
const SNIPPET_RADIUS = 70;
const DEFAULT_LIMIT = 12;

export interface Highlighted {
  readonly text: string;
  readonly ranges: readonly (readonly [number, number])[];
}

export interface SearchHit {
  readonly section: string;
  readonly anchor: string;
  readonly heading: string;
  readonly snippet: Highlighted;
  readonly score: number;
}

export function normalize(value: string): string {
  return value.toLowerCase().replace(/ё/g, "е");
}

export function sanitizeQuery(query: string): string {
  return query.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, MAX_QUERY_LENGTH);
}

function terms(query: string): string[] {
  return [...new Set(normalize(sanitizeQuery(query)).split(" ").filter((term) => term.length > 0))];
}

function countOccurrences(haystack: string, needle: string): number {
  let count = 0;
  let index = haystack.indexOf(needle);
  while (index !== -1) {
    count += 1;
    index = haystack.indexOf(needle, index + needle.length);
  }
  return count;
}

function highlight(text: string, needles: readonly string[]): (readonly [number, number])[] {
  const lower = normalize(text);
  const ranges: [number, number][] = [];
  for (const needle of needles) {
    let index = lower.indexOf(needle);
    while (index !== -1) {
      ranges.push([index, index + needle.length]);
      index = lower.indexOf(needle, index + needle.length);
    }
  }

  ranges.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const range of ranges) {
    const last = merged[merged.length - 1];
    if (last && range[0] <= last[1]) {
      last[1] = Math.max(last[1], range[1]);
    } else {
      merged.push([range[0], range[1]]);
    }
  }
  return merged;
}

function snippet(chunk: SearchChunk, needles: readonly string[]): Highlighted {
  const lower = normalize(chunk.text);
  const first = Math.max(0, Math.min(...needles.map((needle) => lower.indexOf(needle)).filter((index) => index >= 0)));
  const start = Math.max(0, first - SNIPPET_RADIUS);
  const end = Math.min(chunk.text.length, first + SNIPPET_RADIUS * 2);
  const text = `${start > 0 ? "…" : ""}${chunk.text.slice(start, end)}${end < chunk.text.length ? "…" : ""}`;
  return { text, ranges: highlight(text, needles) };
}

export function searchDocs(content: DocsContent, query: string, limit = DEFAULT_LIMIT): SearchHit[] {
  const needles = terms(query);
  if (needles.length === 0) {
    return [];
  }
  const phrase = needles.join(" ");

  const hits: SearchHit[] = [];
  for (const chunk of content.chunks) {
    const heading = normalize(chunk.heading);
    const body = normalize(chunk.text);
    if (!needles.every((needle) => heading.includes(needle) || body.includes(needle))) {
      continue;
    }

    let score = 0;
    for (const needle of needles) {
      score += Math.min(countOccurrences(body, needle), 10) + (heading.includes(needle) ? 25 : 0);
    }
    if (needles.length > 1 && body.includes(phrase)) {
      score += 15;
    }

    hits.push({ section: chunk.section, anchor: chunk.anchor, heading: chunk.heading, snippet: snippet(chunk, needles), score });
  }

  return hits.sort((a, b) => b.score - a.score).slice(0, Math.max(1, Math.min(limit, 50)));
}

export function fuzzyScore(candidate: string, query: string): number {
  const target = normalize(candidate);
  const needle = normalize(query);
  if (needle === "") {
    return 1;
  }
  if (target === needle) {
    return 1000;
  }
  if (target.startsWith(needle)) {
    return 800 - target.length;
  }

  const contains = target.indexOf(needle);
  if (contains !== -1) {
    return 600 - contains - target.length;
  }

  let score = 0;
  let position = 0;
  let streak = 0;
  for (const char of needle) {
    const found = target.indexOf(char, position);
    if (found === -1) {
      return 0;
    }
    streak = found === position ? streak + 1 : 0;
    score += 10 + streak * 5 - (found - position);
    position = found + 1;
  }
  return Math.max(1, Math.min(score, 400));
}

export function rankApi(api: readonly ApiEntry[], query: string, limit = DEFAULT_LIMIT): ApiEntry[] {
  return api
    .map((entry) => ({ entry, score: Math.max(fuzzyScore(entry.short, query) + 50, fuzzyScore(entry.name, query)) }))
    .filter(({ score }) => score > 50 || query === "")
    .sort((a, b) => b.score - a.score || a.entry.name.localeCompare(b.entry.name))
    .slice(0, limit)
    .map(({ entry }) => entry);
}

export function findApi(api: readonly ApiEntry[], query: string): ApiEntry[] {
  const needle = normalize(query.trim().replace(/\(.*$/, ""));
  const exact = api.filter((entry) => normalize(entry.name) === needle);
  if (exact.length > 0) {
    return exact;
  }
  const byShort = api.filter((entry) => normalize(entry.short) === needle);
  return byShort.length > 0 ? byShort : rankApi(api, needle, 8);
}
