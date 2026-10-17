import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ApiEntry, DocsContent } from "../shared/content.ts";
import { MAX_QUERY_LENGTH, findApi, fuzzyScore, rankApi, sanitizeQuery, searchDocs } from "../shared/search.ts";

const entry = (name: string, anchor = name.toLowerCase()): ApiEntry => ({
  name,
  short: name.split(/[.:]/).pop() ?? name,
  signature: `${name}()`,
  section: "s",
  anchor,
  summary: "x",
});

const api = [entry("canvas:Destroy"), entry("texture:Destroy"), entry("canvas:DrawLine"), entry("canvas:DrawLineAA")];

const content: DocsContent = {
  version: "1",
  sections: [],
  api,
  chunks: [
    { section: "a", anchor: "one", heading: "Память", text: "EditableImage тратит память устройства." },
    { section: "b", anchor: "two", heading: "Линии", text: "DrawLine рисует линию. Память не нужна." },
    { section: "c", anchor: "three", heading: "Ёжик", text: "ничего общего" },
  ],
};

describe("sanitizeQuery", () => {
  it("strips control characters and limits length", () => {
    assert.equal(sanitizeQuery(" a\u0000b \n c "), "a b c");
    assert.equal(sanitizeQuery("x".repeat(500)).length, MAX_QUERY_LENGTH);
  });
});

describe("searchDocs", () => {
  it("ranks heading matches first and highlights terms", () => {
    const [first, second] = searchDocs(content, "память");
    assert.equal(first?.anchor, "one");
    assert.equal(second?.anchor, "two");
    assert.ok((first?.snippet.ranges.length ?? 0) > 0);
  });

  it("requires every term and folds ё", () => {
    assert.deepEqual(searchDocs(content, "память линию").map((hit) => hit.anchor), ["two"]);
    assert.equal(searchDocs(content, "ежик")[0]?.anchor, "three");
  });

  it("returns nothing for empty queries", () => {
    assert.deepEqual(searchDocs(content, "   "), []);
  });

  it("treats regex characters literally", () => {
    assert.deepEqual(searchDocs(content, "(.*)+$"), []);
  });
});

describe("api lookup", () => {
  it("prefers exact names, then short names", () => {
    assert.deepEqual(findApi(api, "canvas:Destroy").map((item) => item.name), ["canvas:Destroy"]);
    assert.deepEqual(findApi(api, "Destroy").map((item) => item.name), ["canvas:Destroy", "texture:Destroy"]);
    assert.deepEqual(findApi(api, "drawline(x)").map((item) => item.name), ["canvas:DrawLine"]);
  });

  it("ranks fuzzy matches", () => {
    assert.equal(rankApi(api, "dla")[0]?.name, "canvas:DrawLineAA");
    assert.equal(fuzzyScore("DrawLine", "zzz"), 0);
  });
});
