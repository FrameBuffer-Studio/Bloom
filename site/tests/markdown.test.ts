import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Block } from "../shared/content.ts";
import { headingSlug, parseInline, parseMarkdown, plainText, slugify, splitTableRow } from "../shared/markdown.ts";

const keep = (href: string): string => href;

describe("parseInline", () => {
  it("parses code, strong, emphasis and links", () => {
    assert.deepEqual(parseInline("a `x` **b** *c* [d](e)", keep), [
      { kind: "text", value: "a " },
      { kind: "code", value: "x" },
      { kind: "text", value: " " },
      { kind: "strong", children: [{ kind: "text", value: "b" }] },
      { kind: "text", value: " " },
      { kind: "em", children: [{ kind: "text", value: "c" }] },
      { kind: "text", value: " " },
      { kind: "link", href: "e", children: [{ kind: "text", value: "d" }] },
    ]);
  });

  it("keeps underscores inside identifiers as text", () => {
    assert.deepEqual(parseInline("tile_size and res_x", keep), [{ kind: "text", value: "tile_size and res_x" }]);
  });

  it("drops links that the resolver rejects but keeps their text", () => {
    assert.deepEqual(parseInline("[click](javascript:alert(1))", () => null), [{ kind: "text", value: "click" }]);
  });

  it("unescapes punctuation", () => {
    assert.equal(plainText(parseInline("a \\| b \\*c\\*", keep)), "a | b *c*");
  });
});

describe("splitTableRow", () => {
  it("ignores pipes inside code spans and escaped pipes", () => {
    assert.deepEqual(splitTableRow("| `a | b` | c \\| d |"), ["`a | b`", "c \\| d"]);
  });
});

describe("parseMarkdown", () => {
  it("builds headings with API-aware ids and deduplicates them", () => {
    const blocks = parseMarkdown("# Title\n\n### `canvas:DrawLine(x0, y0)`\n\n## Title\n\n## Title", keep);
    const ids = blocks.filter((block): block is Extract<Block, { kind: "heading" }> => block.kind === "heading").map((block) => block.id);
    assert.deepEqual(ids, ["title", "canvas-drawline", "title-2", "title-3"]);
  });

  it("parses fenced code without touching its content", () => {
    const [block] = parseMarkdown("```lua\nlocal x = `a` -- **b**\n```", keep);
    assert.deepEqual(block, { kind: "code", language: "lua", code: "local x = `a` -- **b**" });
  });

  it("parses GitHub callouts", () => {
    const [block] = parseMarkdown("> [!WARNING]\n> Be careful.", keep);
    assert.equal(block?.kind, "callout");
    assert.equal(block?.kind === "callout" ? block.variant : null, "warning");
  });

  it("parses tables with alignment", () => {
    const [block] = parseMarkdown("| a | b |\n|:--|--:|\n| 1 | 2 |", keep);
    assert.equal(block?.kind, "table");
    if (block?.kind === "table") {
      assert.deepEqual(block.align, ["left", "right"]);
      assert.equal(block.rows.length, 1);
    }
  });

  it("parses ordered lists with a start number", () => {
    const [block] = parseMarkdown("3. three\n4. four", keep);
    assert.equal(block?.kind === "list" ? block.start : 0, 3);
  });
});

describe("slugify", () => {
  it("keeps Cyrillic and folds ё", () => {
    assert.equal(slugify("Ёлка и Холст!"), "елка-и-холст");
    assert.equal(headingSlug([{ kind: "code", value: "Bloom.Create(resolution)" }]), "bloom-create");
  });
});
