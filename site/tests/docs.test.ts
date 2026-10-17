import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import type { Block, DocsContent, Inline } from "../shared/content.ts";
import { compileDocs, resolveDocLink, sectionSlug } from "../shared/compile.ts";
import { LANGUAGES } from "../shared/languages.ts";
import type { Language } from "../shared/languages.ts";

const docsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "docs");

async function loadDocs(language: Language): Promise<DocsContent> {
  const directory = path.join(docsDir, language);
  const files = (await readdir(directory)).filter((file) => file.endsWith(".md"));
  const documents = await Promise.all(files.map(async (fileName) => ({ fileName, markdown: await readFile(path.join(directory, fileName), "utf8") })));
  return compileDocs(documents, "test");
}

function collectLinks(blocks: readonly Block[]): string[] {
  const fromInlines = (inlines: readonly Inline[]): string[] =>
    inlines.flatMap((inline) =>
      inline.kind === "link" ? [inline.href, ...fromInlines(inline.children)] : inline.kind === "strong" || inline.kind === "em" ? fromInlines(inline.children) : [],
    );

  return blocks.flatMap((block) => {
    switch (block.kind) {
      case "heading":
      case "paragraph":
        return fromInlines(block.content);
      case "list":
        return block.items.flatMap(fromInlines);
      case "table":
        return [...block.header, ...block.rows.flat()].flatMap(fromInlines);
      case "callout":
        return collectLinks(block.blocks);
      default:
        return [];
    }
  });
}

describe("compile helpers", () => {
  it("derives section slugs from file names", () => {
    assert.equal(sectionSlug("README.md"), "index");
    assert.equal(sectionSlug("04-canvas.md"), "canvas");
  });

  it("resolves only safe links", () => {
    assert.equal(resolveDocLink("04-canvas.md#bloom-create", "index"), "#/canvas/bloom-create");
    assert.equal(resolveDocLink("#x", "fonts"), "#/fonts/x");
    assert.equal(resolveDocLink("https://create.roblox.com/", "index"), "https://create.roblox.com/");
    assert.equal(resolveDocLink("javascript:alert(1)", "index"), null);
    assert.equal(resolveDocLink("data:text/html,x", "index"), null);
  });

  it("rejects duplicate section slugs", () => {
    assert.throws(() => compileDocs([{ fileName: "01-a.md", markdown: "# A" }, { fileName: "02-a.md", markdown: "# B" }], "x"), /Duplicate/);
  });
});

for (const language of LANGUAGES) {
  describe(`documentation (${language})`, async () => {
    const content = await loadDocs(language);
    const sections = new Map(content.sections.map((section) => [section.slug, section]));

    it("starts with the index and keeps chapters ordered", () => {
      assert.equal(content.sections[0]?.slug, "index");
      const orders = content.sections.map((section) => section.order);
      assert.deepEqual(orders, [...orders].sort((a, b) => a - b));
    });

    it("gives every section a title", () => {
      for (const section of content.sections) {
        assert.ok(section.title.length > 0, section.slug);
      }
    });

    it("has no broken internal links", () => {
      for (const section of content.sections) {
        for (const href of collectLinks(section.blocks).filter((link) => link.startsWith("#/"))) {
          const [, slug = "", anchor] = href.split("/");
          const target = sections.get(slug);
          assert.ok(target, `${section.slug}: ${href} points to a missing section`);
          if (anchor) {
            const id = decodeURIComponent(anchor);
            assert.ok(target.headings.some((heading) => heading.id === id), `${section.slug}: ${href} points to a missing heading`);
          }
        }
      }
    });

    it("documents the core API with summaries", () => {
      const names = new Set(content.api.map((entry) => entry.name));
      for (const name of ["Bloom.Create", "Bloom.CheckSupport", "Bloom.IsSupported", "canvas:DrawLine", "canvas:DrawText", "Texture.New", "Font.FromString"]) {
        assert.ok(names.has(name), name);
      }
      for (const entry of content.api) {
        assert.ok(entry.summary.length > 0, `${entry.name} has no summary`);
      }
    });
  });
}

describe("translations", async () => {
  const [ru, en] = await Promise.all([loadDocs("ru"), loadDocs("en")]);

  it("have the same chapters", () => {
    assert.deepEqual(
      en.sections.map((section) => section.slug),
      ru.sections.map((section) => section.slug),
    );
  });

  it("document the same functions with the same anchors", () => {
    const signature = (content: DocsContent): string[] => content.api.map((entry) => `${entry.section}#${entry.anchor}:${entry.name}`);
    assert.deepEqual(signature(en), signature(ru));
  });
});
