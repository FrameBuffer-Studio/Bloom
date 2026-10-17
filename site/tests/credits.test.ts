import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hasCredits, parseCredits } from "../shared/credits.ts";

describe("parseCredits", () => {
  it("drops empty template entries", () => {
    const credits = parseCredits({
      repository: "",
      authors: [{ name: "", role: "", url: "" }],
      donations: [{ label: "", url: "" }],
    });
    assert.equal(hasCredits(credits), false);
    assert.equal(credits.project, "Bloom");
  });

  it("keeps filled entries", () => {
    const credits = parseCredits({
      repository: "https://github.com/example/bloom",
      authors: [{ name: "Ann", role: "author", url: "https://example.com" }],
      donations: [{ label: "Boosty", url: "https://boosty.to/example" }],
    });
    assert.equal(hasCredits(credits), true);
    assert.equal(credits.authors[0]?.name, "Ann");
    assert.equal(credits.donations[0]?.url, "https://boosty.to/example");
  });

  it("adds https:// to bare addresses", () => {
    const credits = parseCredits({ authors: [{ name: "TheExe", url: "github.com/TheExeDEV" }] });
    assert.equal(credits.authors[0]?.url, "https://github.com/TheExeDEV");
  });

  it("rejects unsafe or invalid URLs", () => {
    assert.throws(() => parseCredits({ repository: "javascript:alert(1)" }), /https/);
    assert.throws(() => parseCredits({ repository: "http://example.com" }), /https/);
    assert.throws(() => parseCredits({ links: [{ label: "x", url: "not a url" }] }), /valid URL/);
  });

  it("rejects oversized or multi-line text", () => {
    assert.throws(() => parseCredits({ project: "x".repeat(500) }), /at most/);
    assert.throws(() => parseCredits({ license: "MIT\nevil" }), /single-line/);
    assert.throws(() => parseCredits({ authors: Array.from({ length: 31 }, () => ({ name: "a" })) }), /at most/);
  });
});
