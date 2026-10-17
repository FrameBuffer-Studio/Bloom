import type { ApiEntry, Block, CalloutKind, Inline } from "../../../shared/content.ts";
import { apiName, plainText } from "../../../shared/markdown.ts";
import { h, link } from "../dom.ts";
import type { Child } from "../dom.ts";
import { t } from "../i18n.ts";
import type { MessageKey } from "../i18n.ts";
import { highlight } from "./highlight.ts";

export interface RenderContext {
  readonly slug: string;
  readonly findApi: (name: string) => ApiEntry | undefined;
  readonly onCopy: (code: string) => void;
}

const CALLOUT_LABELS: Readonly<Record<CalloutKind, MessageKey>> = {
  note: "callout.note",
  tip: "callout.tip",
  important: "callout.important",
  warning: "callout.warning",
  caution: "callout.caution",
  quote: "callout.quote",
};

const CALLOUT_GLYPHS: Readonly<Record<CalloutKind, string>> = {
  note: "ℹ",
  tip: "✿",
  important: "◆",
  warning: "▲",
  caution: "✖",
  quote: "❝",
};

export function anchorId(slug: string, anchor: string): string {
  return `doc-${slug}--${anchor}`;
}

function renderInlines(inlines: readonly Inline[], context: RenderContext, linkApi: boolean): Child[] {
  return inlines.map((inline): Child => {
    switch (inline.kind) {
      case "text":
        return inline.value;
      case "strong":
        return h("strong", {}, ...renderInlines(inline.children, context, linkApi));
      case "em":
        return h("em", {}, ...renderInlines(inline.children, context, linkApi));
      case "link":
        return link(inline.href, renderInlines(inline.children, context, false), "md-link");
      case "code": {
        const name = linkApi ? apiName(inline.value) : null;
        const entry = name ? context.findApi(name) : undefined;
        const code = h("code", { className: "inline-code" }, inline.value);
        if (entry === undefined) {
          return code;
        }
        return link(`#/${entry.section}/${encodeURIComponent(entry.anchor)}`, [code], "api-link");
      }
    }
  });
}

function renderCode(language: string, code: string, context: RenderContext): HTMLElement {
  const isDiagram = language === "text";
  const copy = h(
    "button",
    {
      className: "code-copy",
      attrs: { type: "button", "aria-label": t("aria.copy") },
      on: { click: () => context.onCopy(code) },
    },
    "copy",
  );

  return h(
    "figure",
    { className: isDiagram ? "code-block diagram" : "code-block" },
    h("figcaption", { className: "code-head" }, h("span", { className: "code-lang" }, isDiagram ? "ascii" : language), copy),
    h("pre", { attrs: { tabindex: "0" } }, h("code", {}, highlight(code, language))),
  );
}

function renderHeading(block: Extract<Block, { kind: "heading" }>, context: RenderContext): HTMLElement {
  const id = anchorId(context.slug, block.id);
  const isApi = block.level === 3 && block.content[0]?.kind === "code";

  if (block.level === 1) {
    const title = plainText(block.content);
    return h("h1", { id, className: "doc-title", dataset: { text: title } }, title);
  }

  if (isApi) {
    return h(
      "h3",
      { id, className: "api-heading" },
      h("span", { className: "api-badge" }, "fn"),
      h("span", { className: "api-signature" }, ...renderInlines(block.content, context, false)),
    );
  }

  const tag = block.level === 2 ? "h2" : block.level === 3 ? "h3" : "h4";
  return h(tag, { id, className: `doc-h${block.level}` }, ...renderInlines(block.content, context, true));
}

export function renderBlocks(blocks: readonly Block[], context: RenderContext): HTMLElement[] {
  return blocks.map((block): HTMLElement => {
    switch (block.kind) {
      case "heading":
        return renderHeading(block, context);
      case "paragraph":
        return h("p", {}, ...renderInlines(block.content, context, true));
      case "code":
        return renderCode(block.language, block.code, context);
      case "list": {
        const items = block.items.map((item) => h("li", {}, ...renderInlines(item, context, true)));
        return block.ordered
          ? h("ol", { attrs: block.start === 1 ? {} : { start: String(block.start) } }, ...items)
          : h("ul", {}, ...items);
      }
      case "table": {
        const cell = (tag: "th" | "td", content: readonly Inline[], column: number): HTMLElement => {
          const align = block.align[column];
          return h(tag, align ? { className: `align-${align}` } : {}, ...renderInlines(content, context, true));
        };
        return h(
          "div",
          { className: "table-wrap", attrs: { tabindex: "0" } },
          h(
            "table",
            {},
            h("thead", {}, h("tr", {}, ...block.header.map((content, column) => cell("th", content, column)))),
            h("tbody", {}, ...block.rows.map((row) => h("tr", {}, ...row.map((content, column) => cell("td", content, column))))),
          ),
        );
      }
      case "callout":
        return h(
          "aside",
          { className: `callout callout-${block.variant}` },
          h(
            "div",
            { className: "callout-label" },
            h("span", { className: "callout-glyph", attrs: { "aria-hidden": "true" } }, CALLOUT_GLYPHS[block.variant]),
            t(CALLOUT_LABELS[block.variant]),
          ),
          ...renderBlocks(block.blocks, context),
        );
      case "rule":
        return h("hr");
    }
  });
}
