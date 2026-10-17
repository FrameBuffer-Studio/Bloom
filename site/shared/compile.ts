import { HOME_SLUG } from "./content.ts";
import type { ApiEntry, Block, DocsContent, HeadingRef, Inline, SearchChunk, Section } from "./content.ts";
import { apiName, parseMarkdown, plainText } from "./markdown.ts";

export interface SourceDocument {
  readonly fileName: string;
  readonly markdown: string;
}

const DOC_FILE = /^(?:(\d+)-)?([\w-]+)\.md$/i;
const SUMMARY_LIMIT = 180;
const CHUNK_LIMIT = 4000;

export function sectionSlug(fileName: string): string {
  if (/^readme\.md$/i.test(fileName)) {
    return HOME_SLUG;
  }
  return (DOC_FILE.exec(fileName)?.[2] ?? fileName).toLowerCase();
}

export function sectionOrder(fileName: string): number {
  if (/^readme\.md$/i.test(fileName)) {
    return 0;
  }
  return Number.parseInt(DOC_FILE.exec(fileName)?.[1] ?? "999", 10);
}

export function resolveDocLink(href: string, currentSlug: string): string | null {
  if (/^https?:\/\//i.test(href)) {
    try {
      const url = new URL(href);
      return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
    } catch {
      return null;
    }
  }

  if (href.startsWith("#")) {
    const anchor = href.slice(1);
    return anchor ? `#/${currentSlug}/${encodeURIComponent(anchor)}` : `#/${currentSlug}`;
  }

  const [file = "", anchor = ""] = href.split("#", 2);
  if (!DOC_FILE.test(file)) {
    return null;
  }
  const slug = sectionSlug(file);
  return anchor ? `#/${slug}/${encodeURIComponent(anchor)}` : `#/${slug}`;
}

function truncate(text: string, limit: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > limit ? `${clean.slice(0, limit - 1).trimEnd()}…` : clean;
}

function blockText(block: Block): string {
  switch (block.kind) {
    case "heading":
    case "paragraph":
      return plainText(block.content);
    case "code":
      return block.code;
    case "list":
      return block.items.map(plainText).join(" ");
    case "table":
      return [block.header, ...block.rows].map((row) => row.map(plainText).join(" ")).join(" ");
    case "callout":
      return block.blocks.map(blockText).join(" ");
    case "rule":
      return "";
  }
}

function codeNames(content: readonly Inline[]): { name: string; signature: string }[] {
  return content.flatMap((inline) => {
    if (inline.kind !== "code") {
      return [];
    }
    const name = apiName(inline.value);
    return name ? [{ name, signature: inline.value.trim() }] : [];
  });
}

function shortName(name: string): string {
  return name.split(/[.:]/).pop() ?? name;
}

function summaryAfter(blocks: readonly Block[], index: number): string {
  for (let cursor = index + 1; cursor < blocks.length; cursor += 1) {
    const block = blocks[cursor];
    if (block === undefined || block.kind === "heading") {
      return "";
    }
    if (block.kind === "paragraph") {
      return truncate(plainText(block.content).replace(/^(?:Что делает|What it does):\s*/u, ""), SUMMARY_LIMIT);
    }
  }
  return "";
}

function compileSection(document: SourceDocument): { section: Section; api: ApiEntry[]; chunks: SearchChunk[] } {
  const slug = sectionSlug(document.fileName);
  const blocks = parseMarkdown(document.markdown, (href) => resolveDocLink(href, slug));

  const titleBlock = blocks.find((block) => block.kind === "heading" && block.level === 1);
  const title = titleBlock?.kind === "heading" ? plainText(titleBlock.content) : slug;
  const firstParagraph = blocks.find((block) => block.kind === "paragraph");
  const summary = firstParagraph?.kind === "paragraph" ? truncate(plainText(firstParagraph.content), SUMMARY_LIMIT) : "";

  const headings: HeadingRef[] = [];
  const api: ApiEntry[] = [];
  const chunks: SearchChunk[] = [];
  let chunk = { anchor: "", heading: title, parts: [] as string[] };

  const pushChunk = (): void => {
    const text = truncate(chunk.parts.join(" "), CHUNK_LIMIT);
    if (text !== "" || chunk.anchor !== "") {
      chunks.push({ section: slug, anchor: chunk.anchor, heading: chunk.heading, text });
    }
  };

  blocks.forEach((block, index) => {
    if (block.kind !== "heading") {
      chunk.parts.push(blockText(block));
      return;
    }

    const headingTitle = plainText(block.content);
    if (block.level > 1) {
      headings.push({ id: block.id, level: block.level, title: headingTitle });
      pushChunk();
      chunk = { anchor: block.id, heading: headingTitle, parts: [] };
    }

    if (block.level === 3) {
      const summaryText = summaryAfter(blocks, index);
      for (const { name, signature } of codeNames(block.content)) {
        api.push({ name, short: shortName(name), signature, section: slug, anchor: block.id, summary: summaryText });
      }
    }
  });
  pushChunk();

  return { section: { slug, order: sectionOrder(document.fileName), title, summary, headings, blocks }, api, chunks };
}

export function compileDocs(documents: readonly SourceDocument[], version: string): DocsContent {
  const compiled = [...documents]
    .sort((a, b) => sectionOrder(a.fileName) - sectionOrder(b.fileName) || a.fileName.localeCompare(b.fileName))
    .map(compileSection);

  const slugs = new Set<string>();
  for (const { section } of compiled) {
    if (slugs.has(section.slug)) {
      throw new Error(`Duplicate documentation section slug: ${section.slug}`);
    }
    slugs.add(section.slug);
  }

  return {
    version,
    sections: compiled.map((entry) => entry.section),
    api: compiled.flatMap((entry) => entry.api),
    chunks: compiled.flatMap((entry) => entry.chunks),
  };
}
