import type { ApiEntry, DocsContent, Section } from "../../shared/content.ts";
import { hasCredits } from "../../shared/credits.ts";
import type { CreditLink, CreditPerson, Credits } from "../../shared/credits.ts";
import type { Highlighted, SearchHit } from "../../shared/search.ts";
import { fragment, h, link } from "./dom.ts";
import type { Child } from "./dom.ts";
import { t } from "./i18n.ts";
import { renderBlocks } from "./render/markdown.ts";
import type { RenderContext } from "./render/markdown.ts";
import type { Theme } from "./themes.ts";

export type Runner = (command: string) => void;

export interface CommandInfo {
  readonly name: string;
  readonly usage: string;
  readonly description: string;
  readonly group: string;
  readonly aliases: readonly string[];
}

export const LOGO = [
  "██████╗ ██╗      ██████╗  ██████╗ ███╗   ███╗",
  "██╔══██╗██║     ██╔═══██╗██╔═══██╗████╗ ████║",
  "██████╔╝██║     ██║   ██║██║   ██║██╔████╔██║",
  "██╔══██╗██║     ██║   ██║██║   ██║██║╚██╔╝██║",
  "██████╔╝███████╗╚██████╔╝╚██████╔╝██║ ╚═╝ ██║",
  "╚═════╝ ╚══════╝ ╚═════╝  ╚═════╝ ╚═╝     ╚═╝",
].join("\n");

export function chip(command: string, run: Runner, label = command): HTMLButtonElement {
  return h("button", { className: "chip", attrs: { type: "button" }, on: { click: () => run(command) } }, label);
}

function sectionRoute(section: Section): string {
  return `#/${section.slug}`;
}

function apiRoute(entry: ApiEntry): string {
  return `#/${entry.section}/${encodeURIComponent(entry.anchor)}`;
}

function titled(title: string, ...children: readonly Child[]): DocumentFragment {
  return fragment(h("div", { className: "view-title" }, title), ...children);
}

function code(value: string): HTMLElement {
  return h("code", { className: "inline-code" }, value);
}

export function welcomeView(content: DocsContent, run: Runner): DocumentFragment {
  return fragment(
    h("pre", { className: "logo", attrs: { "aria-label": "Bloom" } }, LOGO),
    h(
      "p",
      { className: "welcome" },
      `${t("welcome.lead")} `,
      code("EditableImage"),
      ` ${t("welcome.and")} `,
      code("buffer"),
      `. ${t("welcome.count", { sections: content.sections.length, functions: content.api.length })}`,
    ),
    h("p", { className: "welcome-hint" }, `${t("welcome.hintBefore")} `, h("kbd", {}, "/"), ` ${t("welcome.hintAfter")}`),
    h(
      "div",
      { className: "chips" },
      chip("/what-is-bloom", run, `/what-is-bloom ✿ ${t("welcome.start")}`),
      chip("/setup", run),
      chip("/first-picture", run),
      chip("/fn DrawLine", run),
      chip("/api", run),
      chip("/lang", run),
      chip("/credits", run),
      chip("/help", run),
    ),
  );
}

export function helpView(commands: readonly CommandInfo[], run: Runner): DocumentFragment {
  const groups = new Map<string, CommandInfo[]>();
  for (const command of commands) {
    groups.set(command.group, [...(groups.get(command.group) ?? []), command]);
  }

  return titled(
    t("view.commands"),
    ...[...groups].map(([group, list]) =>
      h(
        "section",
        { className: "help-group" },
        h("div", { className: "help-group-title" }, group),
        h(
          "div",
          { className: "help-grid" },
          ...list.flatMap((command) => [
            h("button", { className: "help-usage", attrs: { type: "button" }, on: { click: () => run(`/${command.name}`) } }, command.usage),
            h(
              "span",
              { className: "help-description" },
              command.description,
              command.aliases.length > 0 ? h("span", { className: "help-aliases" }, ` · ${command.aliases.map((alias) => `/${alias}`).join(" ")}`) : null,
            ),
          ]),
        ),
      ),
    ),
    h(
      "p",
      { className: "muted" },
      `${t("view.hotkeys")} `,
      h("kbd", {}, "/"),
      ` ${t("view.hotkeyOr")} `,
      h("kbd", {}, "Ctrl K"),
      ` ${t("view.hotkeyFocus")} `,
      h("kbd", {}, "Ctrl L"),
      ` ${t("view.hotkeyClear")} `,
      h("kbd", {}, "↑ ↓"),
      ` ${t("view.hotkeyHistory")}`,
    ),
  );
}

export function treeView(content: DocsContent): DocumentFragment {
  const last = content.sections.length - 1;
  return titled(
    "ls -la docs/",
    h(
      "div",
      { className: "tree" },
      h("div", { className: "tree-root" }, "docs/"),
      ...content.sections.map((section, index) =>
        h(
          "div",
          { className: "tree-row" },
          h("span", { className: "tree-branch", attrs: { "aria-hidden": "true" } }, index === last ? "└── " : "├── "),
          link(sectionRoute(section), [h("span", { className: "tree-command" }, `/${section.slug}`)], "tree-link"),
          h("span", { className: "tree-title" }, section.title),
        ),
      ),
    ),
  );
}

function apiRow(entry: ApiEntry): HTMLElement {
  return h(
    "div",
    { className: "api-row" },
    link(apiRoute(entry), [h("code", {}, entry.signature)], "api-row-link"),
    h("span", { className: "api-row-summary" }, entry.summary),
  );
}

export function apiView(content: DocsContent): DocumentFragment {
  const titles = new Map(content.sections.map((section) => [section.slug, section.title]));
  const groups = new Map<string, ApiEntry[]>();
  for (const entry of content.api) {
    groups.set(entry.section, [...(groups.get(entry.section) ?? []), entry]);
  }

  return titled(
    t("view.reference", { count: content.api.length }),
    ...[...groups].map(([slug, entries]) =>
      h("section", { className: "api-group" }, h("div", { className: "api-group-title" }, `§ ${titles.get(slug) ?? slug}`), ...entries.map(apiRow)),
    ),
  );
}

export function choiceView(query: string, entries: readonly ApiEntry[]): DocumentFragment {
  return titled(t("view.choice", { query }), ...entries.map(apiRow));
}

function marked(snippet: Highlighted): DocumentFragment {
  const result = fragment();
  let cursor = 0;
  for (const [start, end] of snippet.ranges) {
    result.append(snippet.text.slice(cursor, start), h("mark", {}, snippet.text.slice(start, end)));
    cursor = end;
  }
  result.append(snippet.text.slice(cursor));
  return result;
}

export function searchView(query: string, hits: readonly SearchHit[], content: DocsContent): DocumentFragment {
  const titles = new Map(content.sections.map((section) => [section.slug, section.title]));
  if (hits.length === 0) {
    return titled(`grep «${query}»`, h("p", { className: "muted" }, t("search.nothing")));
  }

  return titled(
    `grep «${query}» · ${hits.length}`,
    ...hits.map((hit) =>
      link(
        hit.anchor ? `#/${hit.section}/${encodeURIComponent(hit.anchor)}` : `#/${hit.section}`,
        [
          h("span", { className: "hit-path" }, `${titles.get(hit.section) ?? hit.section} › ${hit.heading}`),
          h("span", { className: "hit-snippet" }, marked(hit.snippet)),
        ],
        "hit",
      ),
    ),
  );
}

export function errorView(message: string, suggestions: readonly string[], run: Runner): DocumentFragment {
  return fragment(
    h("p", { className: "error-line" }, h("span", { className: "error-tag" }, "ERR"), message),
    suggestions.length > 0
      ? h("div", { className: "chips" }, h("span", { className: "muted" }, `${t("err.didYouMean")} `), ...suggestions.map((command) => chip(command, run)))
      : null,
  );
}

export function themesView(themes: readonly Theme[], current: Theme, run: Runner): DocumentFragment {
  return titled(
    t("view.themes"),
    h(
      "div",
      { className: "themes" },
      ...themes.map((theme) =>
        h(
          "button",
          {
            className: theme.name === current.name ? "theme-card active" : "theme-card",
            attrs: { type: "button" },
            dataset: { preview: theme.name },
            on: { click: () => run(`/theme ${theme.name}`) },
          },
          h("span", { className: "theme-swatches", attrs: { "aria-hidden": "true" } }, ...theme.palette.map(() => h("i"))),
          h("span", { className: "theme-name" }, theme.name),
          h("span", { className: "theme-label" }, t(theme.label)),
        ),
      ),
    ),
  );
}

export function historyView(history: readonly string[], run: Runner): DocumentFragment {
  if (history.length === 0) {
    return titled("history", h("p", { className: "muted" }, t("view.historyEmpty")));
  }
  return titled(
    "history",
    h(
      "ol",
      { className: "history" },
      ...history.map((command) => h("li", {}, h("button", { className: "history-item", attrs: { type: "button" }, on: { click: () => run(command) } }, command))),
    ),
  );
}

export function neofetchView(content: DocsContent, mode: string, theme: Theme, language: string): DocumentFragment {
  const rows: [string, string][] = [
    ["library", "Bloom · CPU rasterizer"],
    ["target", "Roblox EditableImage + buffer"],
    ["docs", `v${content.version} · ${language}`],
    ["sections", String(content.sections.length)],
    ["functions", String(content.api.length)],
    ["backend", mode === "api" ? t("about.backendApi") : t("about.backendStatic")],
    ["theme", `${theme.name} - ${t(theme.label)}`],
    ["tile", "≤ 1024 × 1024 px"],
    ["pixel", "RGBA · 0xAABBGGRR"],
  ];

  return fragment(
    h(
      "div",
      { className: "neofetch" },
      h("pre", { className: "logo small", attrs: { "aria-hidden": "true" } }, LOGO),
      h(
        "dl",
        { className: "neofetch-info" },
        ...rows.flatMap(([key, value]) => [h("dt", {}, key), h("dd", {}, value)]),
        h("dt", {}, "palette"),
        h("dd", { className: "palette" }, ...Array.from({ length: 8 }, (_, index) => h("i", { className: `p${index}` }))),
      ),
    ),
  );
}

function creditLink(entry: CreditLink): HTMLElement {
  return link(entry.url, [entry.label], "md-link");
}

function creditPerson(person: CreditPerson): HTMLElement {
  return h(
    "li",
    {},
    person.url ? link(person.url, [person.name], "md-link") : h("strong", {}, person.name),
    person.role ? h("span", { className: "muted" }, ` - ${person.role}`) : null,
  );
}

function creditGroup(title: string, ...children: readonly Child[]): HTMLElement {
  return h("section", { className: "credits-group" }, h("div", { className: "help-group-title" }, title), ...children);
}

export function creditsView(credits: Credits): DocumentFragment {
  if (!hasCredits(credits)) {
    return titled(t("credits.title"), h("p", { className: "credits-empty" }, t("credits.empty")));
  }

  return titled(
    t("credits.title"),
    h(
      "div",
      { className: "credits" },
      creditGroup(t("credits.project"), h("p", {}, h("strong", {}, credits.project), credits.license ? h("span", { className: "muted" }, ` · ${t("credits.license")}: ${credits.license}`) : null)),
      credits.repository ? creditGroup(t("credits.repository"), h("p", {}, link(credits.repository, [credits.repository], "md-link"))) : null,
      credits.authors.length > 0 ? creditGroup(t("credits.authors"), h("ul", { className: "credits-list" }, ...credits.authors.map(creditPerson))) : null,
      credits.donations.length > 0
        ? creditGroup(t("credits.donations"), h("div", { className: "chips" }, ...credits.donations.map((entry) => link(entry.url, [`♥ ${entry.label}`], "chip"))))
        : null,
      credits.links.length > 0 ? creditGroup(t("credits.links"), h("ul", { className: "credits-list" }, ...credits.links.map((entry) => h("li", {}, creditLink(entry))))) : null,
      credits.thanks.length > 0 ? creditGroup(t("credits.thanks"), h("ul", { className: "credits-list" }, ...credits.thanks.map(creditPerson))) : null,
    ),
  );
}

export function sectionView(section: Section, context: RenderContext, previous: Section | undefined, next: Section | undefined): HTMLElement {
  const toc = section.headings.filter((heading) => heading.level === 2);
  return h(
    "div",
    { className: "doc" },
    h("div", { className: "doc-path" }, `docs/${section.slug}.md`, h("span", { className: "doc-meta" }, t("view.sections", { count: section.headings.length }))),
    ...renderBlocks(section.blocks.slice(0, 1), context),
    toc.length > 1
      ? h(
          "nav",
          { className: "toc", attrs: { "aria-label": t("aria.toc") } },
          ...toc.map((heading) => link(`#/${section.slug}/${encodeURIComponent(heading.id)}`, [heading.title], "toc-link")),
        )
      : null,
    ...renderBlocks(section.blocks.slice(1), context),
    h(
      "nav",
      { className: "pager", attrs: { "aria-label": t("aria.pager") } },
      previous ? link(sectionRoute(previous), [h("small", {}, t("view.back")), previous.title], "pager-link") : h("span"),
      next ? link(sectionRoute(next), [h("small", {}, t("view.next")), next.title], "pager-link next") : h("span"),
    ),
  );
}
