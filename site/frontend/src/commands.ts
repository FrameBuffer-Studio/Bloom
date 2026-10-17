import { HOME_SLUG } from "../../shared/content.ts";
import type { DocsContent } from "../../shared/content.ts";
import type { Credits } from "../../shared/credits.ts";
import { findApi, fuzzyScore, rankApi, sanitizeQuery, searchDocs } from "../../shared/search.ts";
import { h } from "./dom.ts";
import { LANGUAGES, isLanguage, languageName, t } from "./i18n.ts";
import type { Language } from "./i18n.ts";
import type { Route } from "./router.ts";
import type { Suggestion, Terminal } from "./terminal/terminal.ts";
import { THEMES, applyTheme, currentTheme, effectsEnabled, findTheme, setEffects } from "./themes.ts";
import {
  apiView,
  choiceView,
  creditsView,
  errorView,
  helpView,
  historyView,
  neofetchView,
  searchView,
  themesView,
  treeView,
  welcomeView,
} from "./views.ts";
import type { CommandInfo } from "./views.ts";

export interface AppServices {
  readonly content: DocsContent;
  readonly credits: Credits;
  readonly language: Language;
  readonly terminal: Terminal;
  readonly navigate: (route: Route, echo: string) => void;
  readonly switchLanguage: (language: Language, echo: string) => void;
  readonly mode: () => "api" | "static";
}

interface Command extends CommandInfo {
  readonly complete?: (argument: string) => readonly Suggestion[];
  readonly run: (argument: string, raw: string) => void;
}

export interface CommandSet {
  readonly execute: (input: string) => void;
  readonly suggest: (input: string) => readonly Suggestion[];
}

const SUGGESTION_LIMIT = 9;

export function createCommands(app: AppServices): CommandSet {
  const { content, terminal } = app;
  const commands: Command[] = [];
  const lookup = new Map<string, Command>();
  const groupNav = t("group.nav");
  const groupDocs = t("group.docs");
  const groupSystem = t("group.system");

  const execute = (input: string): void => {
    const raw = sanitizeQuery(input);
    if (raw === "") {
      return;
    }
    if (!raw.startsWith("/")) {
      runSearch(raw, raw);
      return;
    }

    const [head = "", ...rest] = raw.slice(1).split(" ");
    const command = lookup.get(head.toLowerCase());
    if (command === undefined) {
      const guesses = commands
        .map((candidate) => ({ candidate, score: fuzzyScore(candidate.name, head) }))
        .filter(({ score }) => score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
        .map(({ candidate }) => `/${candidate.name}`);
      terminal.print(errorView(t("err.unknownCommand", { name: head }), guesses, execute), { echo: raw });
      return;
    }
    command.run(rest.join(" ").trim(), raw);
  };

  const register = (command: Command): void => {
    commands.push(command);
    for (const name of [command.name, ...command.aliases]) {
      lookup.set(name, command);
    }
  };

  const option = (label: string, detail: string, insert: string, icon: string, group: string): Suggestion => ({
    label,
    detail,
    insert,
    submit: true,
    icon,
    group,
  });

  const sectionSuggestions = (argument: string, prefix: string): Suggestion[] =>
    content.sections
      .map((section) => ({ section, score: Math.max(fuzzyScore(section.slug, argument), fuzzyScore(section.title, argument)) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score || a.section.order - b.section.order)
      .slice(0, SUGGESTION_LIMIT)
      .map(({ section }) => option(`${prefix}${section.slug}`, section.title, `${prefix}${section.slug}`, "§", groupDocs));

  const apiSuggestions = (argument: string): Suggestion[] =>
    rankApi(content.api, argument, SUGGESTION_LIMIT).map((entry) => option(entry.signature, entry.summary, `/fn ${entry.name}`, "ƒ", t("group.functions")));

  function runSearch(query: string, raw: string): void {
    const clean = sanitizeQuery(query);
    if (clean === "") {
      terminal.print(errorView(t("err.emptySearch"), [], execute), { echo: raw });
      return;
    }
    terminal.print(searchView(clean, searchDocs(content, clean), content), { echo: raw, key: "search" });
  }

  const openFunction = (argument: string, raw: string): void => {
    if (argument === "") {
      terminal.print(apiView(content), { echo: raw, key: "api" });
      return;
    }
    const matches = findApi(content.api, argument);
    const [first] = matches;
    if (first === undefined) {
      terminal.print(errorView(t("err.unknownFunction", { name: argument }), [`/search ${argument}`, "/api"], execute), { echo: raw });
    } else if (matches.every((entry) => entry.anchor === first.anchor && entry.section === first.section)) {
      app.navigate({ slug: first.section, anchor: first.anchor }, raw);
    } else {
      terminal.print(choiceView(argument, matches), { echo: raw, key: "choice" });
    }
  };

  register({
    name: "help",
    aliases: ["h", "commands"],
    usage: "/help",
    description: t("cmd.help"),
    group: groupSystem,
    run: (_, raw) => terminal.print(helpView(commands, execute), { echo: raw, key: "help" }),
  });
  register({
    name: "docs",
    aliases: ["ls", "tree"],
    usage: "/docs",
    description: t("cmd.docs"),
    group: groupNav,
    run: (_, raw) => terminal.print(treeView(content), { echo: raw, key: "tree" }),
  });
  register({
    name: "open",
    aliases: ["cd", "o"],
    usage: `/open ${t("arg.chapter")}`,
    description: t("cmd.open"),
    group: groupNav,
    complete: (argument) => sectionSuggestions(argument, "/open "),
    run: (argument, raw) => {
      const best = content.sections
        .map((candidate) => ({ candidate, score: Math.max(fuzzyScore(candidate.slug, argument), fuzzyScore(candidate.title, argument)) }))
        .sort((a, b) => b.score - a.score)[0];
      if (argument === "" || best === undefined || best.score === 0) {
        terminal.print(errorView(t("err.unknownChapter", { name: argument }), ["/docs"], execute), { echo: raw });
        return;
      }
      app.navigate({ slug: best.candidate.slug, anchor: "" }, raw);
    },
  });
  register({
    name: "fn",
    aliases: ["f", "func"],
    usage: `/fn ${t("arg.function")}`,
    description: t("cmd.fn"),
    group: groupNav,
    complete: apiSuggestions,
    run: openFunction,
  });
  register({
    name: "api",
    aliases: ["ref", "functions"],
    usage: "/api",
    description: t("cmd.api"),
    group: groupNav,
    run: (_, raw) => terminal.print(apiView(content), { echo: raw, key: "api" }),
  });
  register({
    name: "search",
    aliases: ["grep", "s", "find"],
    usage: `/search ${t("arg.text")}`,
    description: t("cmd.search"),
    group: groupNav,
    complete: (argument) => (argument === "" ? [] : [option(`/search ${argument}`, t("search.fullText"), `/search ${argument}`, "⌕", t("group.search"))]),
    run: (argument, raw) => runSearch(argument, raw),
  });
  register({
    name: "home",
    aliases: ["~", "index", "start"],
    usage: "/home",
    description: t("cmd.home"),
    group: groupNav,
    run: (_, raw) => app.navigate({ slug: HOME_SLUG, anchor: "" }, raw),
  });
  register({
    name: "lang",
    aliases: ["language", "locale"],
    usage: "/lang [ru|en]",
    description: t("cmd.lang"),
    group: groupSystem,
    complete: (argument) =>
      LANGUAGES.filter((language) => fuzzyScore(language, argument) > 0).map((language) =>
        option(`/lang ${language}`, languageName(language), `/lang ${language}`, "⇄", t("group.languages")),
      ),
    run: (argument, raw) => {
      const requested = argument.toLowerCase();
      if (requested !== "" && !isLanguage(requested)) {
        terminal.print(errorView(t("err.unknownLanguage", { name: argument }), LANGUAGES.map((language) => `/lang ${language}`), execute), { echo: raw });
        return;
      }
      const next = isLanguage(requested) ? requested : (LANGUAGES.find((language) => language !== app.language) ?? app.language);
      app.switchLanguage(next, raw);
    },
  });
  register({
    name: "credits",
    aliases: ["authors", "donate", "thanks"],
    usage: "/credits",
    description: t("cmd.credits"),
    group: groupSystem,
    run: (_, raw) => terminal.print(creditsView(app.credits), { echo: raw, key: "credits" }),
  });
  register({
    name: "theme",
    aliases: ["color", "skin"],
    usage: `/theme ${t("arg.name")}`,
    description: t("cmd.theme"),
    group: groupSystem,
    complete: (argument) =>
      THEMES.filter((theme) => fuzzyScore(theme.name, argument) > 0).map((theme) =>
        option(`/theme ${theme.name}`, t(theme.label), `/theme ${theme.name}`, "◐", t("group.themes")),
      ),
    run: (argument, raw) => {
      const theme = argument === "" ? undefined : findTheme(argument);
      if (theme) {
        applyTheme(theme);
      } else if (argument !== "") {
        terminal.print(errorView(t("err.unknownTheme", { name: argument }), THEMES.map((item) => `/theme ${item.name}`), execute), { echo: raw });
        return;
      }
      terminal.print(themesView(THEMES, currentTheme(), execute), { echo: raw, key: "themes" });
    },
  });
  register({
    name: "fx",
    aliases: ["crt", "effects"],
    usage: "/fx [on|off]",
    description: t("cmd.crt"),
    group: groupSystem,
    complete: () => (["on", "off"] as const).map((state) => option(`/fx ${state}`, t(state === "on" ? "crt.on" : "crt.off"), `/fx ${state}`, "✦", t("group.effects"))),
    run: (argument, raw) => {
      const enabled = argument === "on" ? true : argument === "off" ? false : !effectsEnabled();
      setEffects(enabled);
      terminal.print(h("p", { className: "muted" }, enabled ? t("crt.enabled") : t("crt.disabled")), { echo: raw, key: "crt" });
    },
  });
  register({
    name: "history",
    aliases: ["hist"],
    usage: "/history",
    description: t("cmd.history"),
    group: groupSystem,
    run: (_, raw) => terminal.print(historyView(terminal.history(), execute), { echo: raw, key: "history" }),
  });
  register({
    name: "about",
    aliases: ["neofetch", "version"],
    usage: "/about",
    description: t("cmd.about"),
    group: groupSystem,
    run: (_, raw) => terminal.print(neofetchView(content, app.mode(), currentTheme(), app.language), { echo: raw, key: "about" }),
  });
  register({
    name: "welcome",
    aliases: ["hello", "motd"],
    usage: "/welcome",
    description: t("cmd.welcome"),
    group: groupSystem,
    run: (_, raw) => terminal.print(welcomeView(content, execute), { echo: raw, key: "welcome" }),
  });
  register({
    name: "clear",
    aliases: ["cls", "reset"],
    usage: "/clear",
    description: t("cmd.clear"),
    group: groupSystem,
    run: () => terminal.clear(),
  });

  for (const section of content.sections) {
    if (lookup.has(section.slug)) {
      continue;
    }
    register({
      name: section.slug,
      aliases: [],
      usage: `/${section.slug}`,
      description: section.title,
      group: groupDocs,
      run: (argument, raw) => {
        const heading = argument === "" ? undefined : section.headings.find((item) => fuzzyScore(item.title, argument) > 0);
        app.navigate({ slug: section.slug, anchor: heading?.id ?? "" }, raw);
      },
    });
  }

  const suggest = (input: string): readonly Suggestion[] => {
    if (input.trim() === "") {
      return [];
    }

    if (!input.startsWith("/")) {
      return [option(input, t("search.everywhere"), `/search ${input}`, "⌕", t("group.search")), ...apiSuggestions(input).slice(0, SUGGESTION_LIMIT - 1)];
    }

    const body = input.slice(1);
    const space = body.indexOf(" ");
    if (space === -1) {
      return commands
        .map((command) => ({ command, score: Math.max(fuzzyScore(command.name, body), ...command.aliases.map((alias) => fuzzyScore(alias, body) - 5)) }))
        .filter(({ score }) => score > 0)
        .sort((a, b) => b.score - a.score || a.command.group.localeCompare(b.command.group))
        .slice(0, SUGGESTION_LIMIT)
        .map(({ command }) => ({
          label: command.usage,
          detail: command.description,
          insert: command.complete ? `/${command.name} ` : `/${command.name}`,
          submit: command.complete === undefined,
          icon: command.group === groupDocs ? "§" : "/",
          group: t("group.commands"),
        }));
    }

    const command = lookup.get(body.slice(0, space).toLowerCase());
    return command?.complete ? command.complete(body.slice(space + 1).trimStart()) : [];
  };

  return { execute, suggest };
}
