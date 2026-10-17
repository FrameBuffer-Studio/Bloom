import type { Block, CalloutKind, Inline, TableAlign } from "./content.ts";

export type LinkResolver = (href: string) => string | null;

const ESCAPABLE = new Set("\\`*_{}[]()#+-.!|>~<\"'");
const FENCE = /^(`{3,}|~{3,})\s*([\w+-]*)\s*$/;
const HEADING = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
const RULE = /^(?:\*{3,}|-{3,}|_{3,})\s*$/;
const QUOTE = /^\s{0,3}>\s?/;
const LIST_ITEM = /^\s{0,3}([-*+]|\d{1,9}[.)])\s+(.*)$/;
const TABLE_SEPARATOR = /^\s*\|?\s*:?-+:?\s*(?:\|\s*:?-+:?\s*)*\|?\s*$/;
const CALLOUT = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*$/i;
const WORD = /[\p{L}\p{N}]/u;

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}

export function plainText(inlines: readonly Inline[]): string {
  return inlines
    .map((inline) => (inline.kind === "text" || inline.kind === "code" ? inline.value : plainText(inline.children)))
    .join("");
}

function isWordChar(char: string | undefined): boolean {
  return char !== undefined && WORD.test(char);
}

function findClosingBracket(source: string, open: number): number {
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    const char = source[index];
    if (char === "\\") {
      index += 1;
    } else if (char === "[") {
      depth += 1;
    } else if (char === "]") {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }
  return -1;
}

function findClosingParen(source: string, open: number): number {
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    const char = source[index];
    if (char === "(") {
      depth += 1;
    } else if (char === ")") {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }
  return -1;
}

function findEmphasisEnd(source: string, start: number, marker: string): number {
  for (let index = start + 1; index < source.length; index += 1) {
    if (source[index] !== marker || source[index - 1] === " ") {
      continue;
    }
    if (marker === "*" && source[index + 1] === "*") {
      index += 1;
      continue;
    }
    if (marker === "_" && isWordChar(source[index + 1])) {
      continue;
    }
    return index;
  }
  return -1;
}

export function parseInline(source: string, resolve: LinkResolver): Inline[] {
  const result: Inline[] = [];
  let text = "";

  const flush = (): void => {
    if (text !== "") {
      result.push({ kind: "text", value: text });
      text = "";
    }
  };

  let index = 0;
  while (index < source.length) {
    const char = source[index] ?? "";
    const next = source[index + 1];

    if (char === "\\" && next !== undefined && ESCAPABLE.has(next)) {
      text += next;
      index += 2;
      continue;
    }

    if (char === "`") {
      let ticks = 1;
      while (source[index + ticks] === "`") {
        ticks += 1;
      }
      const fence = "`".repeat(ticks);
      const end = source.indexOf(fence, index + ticks);
      if (end !== -1) {
        flush();
        const raw = source.slice(index + ticks, end);
        const value = raw.length > 2 && raw.startsWith(" ") && raw.endsWith(" ") ? raw.slice(1, -1) : raw;
        result.push({ kind: "code", value });
        index = end + ticks;
        continue;
      }
    }

    if (char === "*" && next === "*") {
      const end = source.indexOf("**", index + 2);
      if (end > index + 2) {
        flush();
        result.push({ kind: "strong", children: parseInline(source.slice(index + 2, end), resolve) });
        index = end + 2;
        continue;
      }
    }

    if ((char === "*" || char === "_") && next !== undefined && next !== " ") {
      const opensWord = char === "*" || !isWordChar(source[index - 1]);
      const end = opensWord ? findEmphasisEnd(source, index, char) : -1;
      if (end > index + 1) {
        flush();
        result.push({ kind: "em", children: parseInline(source.slice(index + 1, end), resolve) });
        index = end + 1;
        continue;
      }
    }

    if (char === "[") {
      const close = findClosingBracket(source, index);
      if (close !== -1 && source[close + 1] === "(") {
        const paren = findClosingParen(source, close + 1);
        if (paren !== -1) {
          flush();
          const children = parseInline(source.slice(index + 1, close), resolve);
          const href = resolve(source.slice(close + 2, paren).trim());
          if (href === null) {
            result.push(...children);
          } else {
            result.push({ kind: "link", href, children });
          }
          index = paren + 1;
          continue;
        }
      }
    }

    text += char;
    index += 1;
  }

  flush();
  return result;
}

export function splitTableRow(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inCode = false;

  const trimmed = line.trim().replace(/^\|/, "");
  for (let index = 0; index < trimmed.length; index += 1) {
    const char = trimmed[index] ?? "";
    if (char === "\\" && trimmed[index + 1] === "|") {
      current += "\\|";
      index += 1;
    } else if (char === "`") {
      inCode = !inCode;
      current += char;
    } else if (char === "|" && !inCode) {
      cells.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  if (current.trim() !== "" || !trimmed.endsWith("|")) {
    cells.push(current.trim());
  }
  return cells;
}

function parseAlign(cell: string): TableAlign {
  const left = cell.startsWith(":");
  const right = cell.endsWith(":");
  if (left && right) {
    return "center";
  }
  if (right) {
    return "right";
  }
  return left ? "left" : null;
}

function isTableStart(lines: readonly string[], index: number): boolean {
  const line = lines[index] ?? "";
  const separator = lines[index + 1];
  return line.includes("|") && separator !== undefined && separator.includes("-") && TABLE_SEPARATOR.test(separator);
}

function startsBlock(lines: readonly string[], index: number): boolean {
  const line = lines[index] ?? "";
  return (
    FENCE.test(line) ||
    HEADING.test(line) ||
    RULE.test(line) ||
    QUOTE.test(line) ||
    LIST_ITEM.test(line) ||
    isTableStart(lines, index)
  );
}

interface ParseState {
  readonly resolve: LinkResolver;
  readonly headingIds: (content: readonly Inline[]) => string;
}

function parseLines(lines: readonly string[], state: ParseState): Block[] {
  const blocks: Block[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index] ?? "";

    if (line.trim() === "") {
      index += 1;
      continue;
    }

    const fence = FENCE.exec(line);
    if (fence) {
      const marker = fence[1] ?? "```";
      const body: string[] = [];
      index += 1;
      while (index < lines.length && !(lines[index] ?? "").trimEnd().startsWith(marker)) {
        body.push(lines[index] ?? "");
        index += 1;
      }
      index += 1;
      blocks.push({ kind: "code", language: (fence[2] ?? "").toLowerCase() || "text", code: body.join("\n") });
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      const content = parseInline(heading[2] ?? "", state.resolve);
      blocks.push({ kind: "heading", level: (heading[1] ?? "#").length, id: state.headingIds(content), content });
      index += 1;
      continue;
    }

    if (RULE.test(line)) {
      blocks.push({ kind: "rule" });
      index += 1;
      continue;
    }

    if (QUOTE.test(line)) {
      const inner: string[] = [];
      while (index < lines.length && QUOTE.test(lines[index] ?? "")) {
        inner.push((lines[index] ?? "").replace(QUOTE, ""));
        index += 1;
      }
      const callout = CALLOUT.exec(inner[0] ?? "");
      const variant: CalloutKind = callout ? ((callout[1] ?? "note").toLowerCase() as CalloutKind) : "quote";
      blocks.push({ kind: "callout", variant, blocks: parseLines(callout ? inner.slice(1) : inner, state) });
      continue;
    }

    if (isTableStart(lines, index)) {
      const header = splitTableRow(line);
      const align = splitTableRow(lines[index + 1] ?? "").map(parseAlign);
      const rows: Inline[][][] = [];
      index += 2;
      while (index < lines.length && (lines[index] ?? "").includes("|") && (lines[index] ?? "").trim() !== "") {
        const cells = splitTableRow(lines[index] ?? "");
        rows.push(header.map((_, column) => parseInline(cells[column] ?? "", state.resolve)));
        index += 1;
      }
      blocks.push({
        kind: "table",
        align: header.map((_, column) => align[column] ?? null),
        header: header.map((cell) => parseInline(cell, state.resolve)),
        rows,
      });
      continue;
    }

    const item = LIST_ITEM.exec(line);
    if (item) {
      const ordered = /\d/.test(item[1] ?? "");
      const start = ordered ? Number.parseInt(item[1] ?? "1", 10) : 1;
      const items: string[] = [];
      while (index < lines.length) {
        const current = lines[index] ?? "";
        const match = LIST_ITEM.exec(current);
        if (match && /\d/.test(match[1] ?? "") === ordered) {
          items.push(match[2] ?? "");
        } else if (current.trim() !== "" && /^\s{2,}/.test(current) && items.length > 0) {
          items[items.length - 1] += ` ${current.trim()}`;
        } else {
          break;
        }
        index += 1;
      }
      blocks.push({ kind: "list", ordered, start, items: items.map((entry) => parseInline(entry, state.resolve)) });
      continue;
    }

    const paragraph: string[] = [line.trim()];
    index += 1;
    while (index < lines.length && (lines[index] ?? "").trim() !== "" && !startsBlock(lines, index)) {
      paragraph.push((lines[index] ?? "").trim());
      index += 1;
    }
    blocks.push({ kind: "paragraph", content: parseInline(paragraph.join(" "), state.resolve) });
  }

  return blocks;
}

const API_NAME = /^([A-Za-z_]\w*(?:[.:][A-Za-z_]\w*)+)/;

export function apiName(code: string): string | null {
  return API_NAME.exec(code.trim())?.[1] ?? null;
}

export function headingSlug(content: readonly Inline[]): string {
  const first = content[0];
  const name = first?.kind === "code" ? apiName(first.value) : null;
  return slugify(name ?? plainText(content)) || "section";
}

export function parseMarkdown(markdown: string, resolve: LinkResolver): Block[] {
  const used = new Map<string, number>();
  const headingIds = (content: readonly Inline[]): string => {
    const base = headingSlug(content);
    const count = (used.get(base) ?? 0) + 1;
    used.set(base, count);
    return count === 1 ? base : `${base}-${count}`;
  };

  return parseLines(markdown.replace(/\r\n?/g, "\n").split("\n"), { resolve, headingIds });
}
