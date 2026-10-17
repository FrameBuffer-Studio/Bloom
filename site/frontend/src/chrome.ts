import type { DocsContent, Section } from "../../shared/content.ts";
import type { Credits } from "../../shared/credits.ts";
import { clear, h, link } from "./dom.ts";
import { LANGUAGES, currentLanguage, t } from "./i18n.ts";
import type { Language } from "./i18n.ts";
import { currentTheme } from "./themes.ts";

export interface Chrome {
  readonly render: (content: DocsContent, credits: Credits) => void;
  readonly setActive: (section: Section | undefined, anchor: string) => void;
  readonly setMode: (mode: "api" | "static") => void;
  readonly toast: (message: string) => void;
}

export interface ChromeElements {
  readonly sidebar: HTMLElement;
  readonly statusbar: HTMLElement;
  readonly titlePath: HTMLElement;
  readonly promptPath: HTMLElement;
  readonly prompt: HTMLInputElement;
  readonly suggestions: HTMLElement;
  readonly toaster: HTMLElement;
  readonly menuToggle: HTMLButtonElement;
  readonly languageToggle: HTMLButtonElement;
  readonly repositoryLink: HTMLAnchorElement;
}

const TOAST_MS = 2200;

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function createChrome(elements: ChromeElements, onLanguage: (language: Language) => void): Chrome {
  const { sidebar, statusbar, titlePath, promptPath, prompt, suggestions, toaster, menuToggle, languageToggle, repositoryLink } = elements;
  const sectionLinks = new Map<string, HTMLElement>();
  let activeSection: Section | undefined;
  let activeAnchor = "";

  const setOpen = (open: boolean): void => {
    document.body.dataset["sidebar"] = open ? "open" : "closed";
    menuToggle.setAttribute("aria-expanded", String(open));
  };
  menuToggle.addEventListener("click", () => setOpen(document.body.dataset["sidebar"] !== "open"));
  sidebar.addEventListener("click", (event) => {
    if (event.target instanceof Element && event.target.closest("a")) {
      setOpen(false);
    }
  });
  languageToggle.addEventListener("click", () => {
    const next = LANGUAGES.find((language) => language !== currentLanguage());
    if (next) {
      onLanguage(next);
    }
  });

  const section = h("span", { className: "status-section" }, "~");
  const mode = h("span", { className: "status-mode" }, "◌ static");
  const language = h("span", { className: "status-language" }, currentLanguage());
  const theme = h("span", { className: "status-theme" }, currentTheme().name);
  const clock = h("span", { className: "status-clock" }, "--:--");
  statusbar.append(
    h("span", { className: "status-badge" }, "bloom"),
    h("span", { className: "status-window" }, "0:docs*"),
    section,
    h("span", { className: "status-spacer" }),
    mode,
    language,
    theme,
    clock,
  );

  const tick = (): void => {
    const now = new Date();
    clock.textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  };
  tick();
  window.setInterval(tick, 15_000);
  window.addEventListener("bloom:theme", () => {
    theme.textContent = currentTheme().name;
  });

  const renderLanguageToggle = (): void => {
    clear(languageToggle);
    languageToggle.append(
      ...LANGUAGES.flatMap((code, index) => [
        index > 0 ? h("span", { className: "lang-separator", attrs: { "aria-hidden": "true" } }, "/") : null,
        h("span", { className: code === currentLanguage() ? "lang-code active" : "lang-code" }, code.toUpperCase()),
      ]).filter((node): node is HTMLElement => node !== null),
    );
    languageToggle.setAttribute("aria-label", t("aria.language"));
    language.textContent = currentLanguage();
  };

  const renderSidebar = (content: DocsContent, credits: Credits): void => {
    sectionLinks.clear();
    clear(sidebar);
    const [donation] = credits.donations;
    sidebar.append(
      h("div", { className: "sidebar-title" }, "~/docs"),
      ...content.sections.map((entry) => {
        const item = link(
          `#/${entry.slug}`,
          [h("span", { className: "nav-index" }, pad(entry.order)), h("span", { className: "nav-name" }, entry.title)],
          "nav-link",
        );
        sectionLinks.set(entry.slug, item);
        return item;
      }),
      h(
        "div",
        { className: "sidebar-credits" },
        link("#/credits", [`✦ ${t("credits.sidebar")}`], "credits-link"),
        credits.repository ? link(credits.repository, ["git ↗"], "credits-link") : null,
        donation ? link(donation.url, [t("credits.donate")], "credits-link") : null,
      ),
      h("div", { className: "sidebar-foot" }, h("span", {}, `${content.api.length} fn`), h("span", {}, `v${content.version}`)),
    );
  };

  const applyActive = (): void => {
    for (const [slug, item] of sectionLinks) {
      if (slug === activeSection?.slug) {
        item.setAttribute("aria-current", "page");
      } else {
        item.removeAttribute("aria-current");
      }
    }
    titlePath.textContent = activeSection ? `~/docs/${activeSection.slug}${activeAnchor ? `#${activeAnchor}` : ""}` : "~/docs";
    section.textContent = activeSection ? activeSection.title : "~";
    promptPath.textContent = activeSection ? `~/${activeSection.slug}` : "~";
    document.title = activeSection ? t("app.docTitle", { title: activeSection.title }) : t("app.title");
  };

  let toastTimer = 0;

  return {
    render(content, credits) {
      renderSidebar(content, credits);
      renderLanguageToggle();
      repositoryLink.hidden = credits.repository === "";
      if (credits.repository) {
        repositoryLink.href = credits.repository;
      }
      prompt.placeholder = t("prompt.placeholder");
      suggestions.setAttribute("aria-label", t("aria.suggestions"));
      sidebar.setAttribute("aria-label", t("aria.sidebar"));
      menuToggle.setAttribute("aria-label", t("aria.menu"));
      activeSection = activeSection ? content.sections.find((entry) => entry.slug === activeSection?.slug) : undefined;
      applyActive();
    },
    setActive(next, anchor) {
      activeSection = next;
      activeAnchor = anchor;
      applyActive();
    },
    setMode(value) {
      mode.textContent = value === "api" ? "◉ api" : "◌ static";
      mode.dataset["mode"] = value;
    },
    toast(message) {
      window.clearTimeout(toastTimer);
      toaster.textContent = message;
      toaster.hidden = false;
      toastTimer = window.setTimeout(() => {
        toaster.hidden = true;
      }, TOAST_MS);
    },
  };
}
