import { API_HEADER, API_VERSION, HOME_SLUG } from "../../shared/content.ts";
import type { ApiEntry, DocsContent } from "../../shared/content.ts";
import { CREDITS_FILE, EMPTY_CREDITS, parseCredits } from "../../shared/credits.ts";
import type { Credits } from "../../shared/credits.ts";
import { contentFile } from "../../shared/languages.ts";
import { startBackdrop } from "./backdrop.ts";
import { boot } from "./boot.ts";
import { createChrome } from "./chrome.ts";
import { createCommands } from "./commands.ts";
import type { CommandSet } from "./commands.ts";
import { byId, h } from "./dom.ts";
import { initialLanguage, setLanguage, t } from "./i18n.ts";
import type { Language } from "./i18n.ts";
import { anchorId } from "./render/markdown.ts";
import { parseRoute, watchRoutes } from "./router.ts";
import type { Route } from "./router.ts";
import { createTerminal } from "./terminal/terminal.ts";
import { restoreEffects, restoreTheme } from "./themes.ts";
import { sectionView, welcomeView } from "./views.ts";

type Mode = "api" | "static";

interface LoadedContent {
  readonly content: DocsContent;
  readonly mode: Mode;
}

function isDocsContent(value: unknown): value is DocsContent {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Partial<Record<keyof DocsContent, unknown>>;
  return (
    typeof candidate.version === "string" &&
    Array.isArray(candidate.sections) &&
    Array.isArray(candidate.api) &&
    Array.isArray(candidate.chunks)
  );
}

const contentCache = new Map<Language, Promise<LoadedContent>>();

function loadContent(language: Language): Promise<LoadedContent> {
  const cached = contentCache.get(language);
  if (cached) {
    return cached;
  }
  const request = (async (): Promise<LoadedContent> => {
    const file = contentFile(language);
    const response = await fetch(`./${file}`, { credentials: "same-origin" });
    if (!response.ok) {
      throw new Error(`${file}: HTTP ${response.status}`);
    }
    const data: unknown = await response.json();
    if (!isDocsContent(data)) {
      throw new Error(`${file} has an unexpected shape`);
    }
    return { content: data, mode: response.headers.get(API_HEADER) === API_VERSION ? "api" : "static" };
  })();
  request.catch(() => contentCache.delete(language));
  contentCache.set(language, request);
  return request;
}

async function loadCredits(): Promise<Credits> {
  try {
    const response = await fetch(`./${CREDITS_FILE}`, { credentials: "same-origin" });
    return response.ok ? parseCredits(await response.json()) : EMPTY_CREDITS;
  } catch {
    return EMPTY_CREDITS;
  }
}

function isTyping(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || (target instanceof HTMLElement && target.isContentEditable);
}

async function start(): Promise<void> {
  restoreTheme();
  restoreEffects();
  setLanguage(initialLanguage());

  const screen = byId("screen", HTMLElement);
  const output = byId("output", HTMLElement);
  const input = byId("prompt", HTMLInputElement);
  startBackdrop(byId("backdrop", HTMLCanvasElement));

  const creditsPromise = loadCredits();
  let loaded: LoadedContent;
  try {
    loaded = await loadContent(initialLanguage());
  } catch (error) {
    output.append(h("p", { className: "error-line" }, h("span", { className: "error-tag" }, "FATAL"), t("app.fatal", { error: String(error) })));
    return;
  }

  const credits = await creditsPromise;
  const mode = loaded.mode;
  let content = loaded.content;
  let language = initialLanguage();
  let sections = new Map<string, DocsContent["sections"][number]>();
  let apiByName = new Map<string, ApiEntry>();
  let pendingEcho: string | null = null;
  let commands: CommandSet | null = null;

  const terminal = createTerminal({
    screen,
    output,
    input,
    suggestions: byId("suggestions", HTMLElement),
    suggest: (value) => commands?.suggest(value) ?? [],
    execute: (value) => commands?.execute(value),
  });

  const copy = (code: string): void => {
    navigator.clipboard
      .writeText(code)
      .then(() => chrome.toast(t("app.copied")))
      .catch(() => chrome.toast(t("app.copyDenied")));
  };

  const echoFor = (route: Route): string => {
    const entry = content.api.find((item) => item.section === route.slug && item.anchor === route.anchor);
    if (entry) {
      return `/fn ${entry.name}`;
    }
    return route.slug === HOME_SLUG ? "/home" : `/${route.slug}`;
  };

  const openSection = (route: Route, echo: string): void => {
    const section = sections.get(route.slug);
    if (section === undefined) {
      commands?.execute(`/${route.slug}`);
      return;
    }

    const order = content.sections.indexOf(section);
    const view = sectionView(
      section,
      { slug: section.slug, findApi: (name) => apiByName.get(name), onCopy: copy },
      content.sections[order - 1],
      content.sections[order + 1],
    );
    const entry = terminal.print(view, { echo, key: `doc:${section.slug}`, className: "entry-doc" });
    chrome.setActive(section, route.anchor);

    const target = route.anchor ? document.getElementById(anchorId(section.slug, route.anchor)) : null;
    if (target) {
      terminal.reveal(target);
      target.classList.remove("flash");
      window.requestAnimationFrame(() => target.classList.add("flash"));
    } else {
      terminal.reveal(entry);
    }
  };

  const handleRoute = (route: Route | null): void => {
    if (route === null) {
      return;
    }
    const echo = pendingEcho ?? echoFor(route);
    pendingEcho = null;
    openSection(route, echo);
  };

  const navigate = watchRoutes(handleRoute);

  const showWelcome = (): void => {
    terminal.print(welcomeView(content, (command) => commands?.execute(command)), { key: "welcome" });
    chrome.setActive(undefined, "");
  };

  const mount = (): void => {
    sections = new Map(content.sections.map((section) => [section.slug, section]));
    apiByName = new Map(content.api.map((entry) => [entry.name, entry]));
    chrome.render(content, credits);
    commands = createCommands({
      content,
      credits,
      language,
      terminal,
      navigate: (route, echo) => {
        pendingEcho = echo;
        navigate(route);
      },
      switchLanguage: (next, echo) => void switchLanguage(next, echo),
      mode: () => mode,
    });
  };

  const switchLanguage = async (next: Language, echo: string): Promise<void> => {
    try {
      const nextContent = (await loadContent(next)).content;
      language = next;
      content = nextContent;
      setLanguage(next);
      mount();
      terminal.clear();
      terminal.print(h("p", { className: "muted" }, t("lang.switched")), { echo, key: "lang" });
      const route = parseRoute(window.location.hash);
      if (route && sections.has(route.slug)) {
        const anchor = route.anchor && content.sections.find((section) => section.slug === route.slug)?.headings.some((heading) => heading.id === route.anchor) ? route.anchor : "";
        openSection({ slug: route.slug, anchor }, echoFor({ slug: route.slug, anchor }));
      } else {
        showWelcome();
      }
    } catch (error) {
      chrome.toast(t("app.fatal", { error: String(error) }));
    }
  };

  const chrome = createChrome(
    {
      sidebar: byId("sidebar", HTMLElement),
      statusbar: byId("statusbar", HTMLElement),
      titlePath: byId("title-path", HTMLElement),
      promptPath: byId("prompt-path", HTMLElement),
      prompt: input,
      suggestions: byId("suggestions", HTMLElement),
      toaster: byId("toast", HTMLElement),
      menuToggle: byId("menu-toggle", HTMLButtonElement),
      languageToggle: byId("lang-toggle", HTMLButtonElement),
      repositoryLink: byId("repo-link", HTMLAnchorElement),
    },
    (next) => commands?.execute(`/lang ${next}`),
  );

  mount();

  document.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();
    if ((event.ctrlKey || event.metaKey) && key === "k") {
      event.preventDefault();
      terminal.focus();
    } else if ((event.ctrlKey || event.metaKey) && key === "l") {
      event.preventDefault();
      terminal.clear();
    } else if (event.key === "/" && !isTyping(event.target)) {
      event.preventDefault();
      terminal.setValue("/");
    }
  });

  document.addEventListener("click", (event) => {
    const anchor = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href^='#/']") : null;
    if (anchor && anchor.getAttribute("href") === window.location.hash) {
      event.preventDefault();
      handleRoute(parseRoute(window.location.hash));
    }
  });

  screen.addEventListener("click", (event) => {
    const selection = window.getSelection();
    const interactive = event.target instanceof Element && event.target.closest("a, button, pre, input, .table-wrap");
    if (!interactive && (selection === null || selection.isCollapsed)) {
      terminal.focus();
    }
  });

  chrome.setMode(mode);
  await boot(output, content, mode);

  const initial = parseRoute(window.location.hash);
  if (initial) {
    handleRoute(initial);
  } else {
    showWelcome();
  }
  terminal.focus();
}

void start();
