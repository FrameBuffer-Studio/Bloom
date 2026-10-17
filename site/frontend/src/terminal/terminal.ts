import { clear, h } from "../dom.ts";
import { t } from "../i18n.ts";
import { readList, writeList } from "../storage.ts";

export interface Suggestion {
  readonly label: string;
  readonly detail: string;
  readonly insert: string;
  readonly submit: boolean;
  readonly icon: string;
  readonly group: string;
}

export interface PrintOptions {
  readonly echo?: string;
  readonly key?: string;
  readonly className?: string;
}

export interface Terminal {
  readonly print: (body: Node, options?: PrintOptions) => HTMLElement;
  readonly clear: () => void;
  readonly focus: () => void;
  readonly setValue: (value: string) => void;
  readonly history: () => readonly string[];
  readonly reveal: (element: HTMLElement) => void;
}

export interface TerminalOptions {
  readonly screen: HTMLElement;
  readonly output: HTMLElement;
  readonly input: HTMLInputElement;
  readonly suggestions: HTMLElement;
  readonly suggest: (value: string) => readonly Suggestion[];
  readonly execute: (value: string) => void;
}

const HISTORY_KEY = "history";
const HISTORY_LIMIT = 60;
const OUTPUT_LIMIT = 24;
const INPUT_LIMIT = 160;

export function createTerminal(options: TerminalOptions): Terminal {
  const { screen, output, input, suggestions } = options;
  const history = readList(HISTORY_KEY, HISTORY_LIMIT);
  let historyCursor = history.length;
  let draft = "";
  let items: readonly Suggestion[] = [];
  let selected = 0;

  input.maxLength = INPUT_LIMIT;

  const isOpen = (): boolean => !suggestions.hidden && items.length > 0;

  const close = (): void => {
    suggestions.hidden = true;
    items = [];
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
  };

  const highlightSelection = (): void => {
    const options = suggestions.querySelectorAll<HTMLElement>("[role='option']");
    options.forEach((option, index) => {
      const active = index === selected;
      option.setAttribute("aria-selected", String(active));
      if (active) {
        input.setAttribute("aria-activedescendant", option.id);
        option.scrollIntoView({ block: "nearest" });
      }
    });
  };

  const submit = (value: string): void => {
    const command = value.trim().slice(0, INPUT_LIMIT);
    input.value = "";
    draft = "";
    close();
    if (command === "") {
      return;
    }
    if (history[history.length - 1] !== command) {
      history.push(command);
      if (history.length > HISTORY_LIMIT) {
        history.shift();
      }
      writeList(HISTORY_KEY, history);
    }
    historyCursor = history.length;
    options.execute(command);
  };

  const apply = (suggestion: Suggestion): void => {
    if (suggestion.submit) {
      submit(suggestion.insert);
      return;
    }
    input.value = suggestion.insert;
    input.setSelectionRange(input.value.length, input.value.length);
    refresh();
  };

  const render = (): void => {
    clear(suggestions);
    let group = "";
    items.forEach((item, index) => {
      if (item.group !== group) {
        group = item.group;
        suggestions.append(h("div", { className: "suggestion-group", attrs: { role: "presentation" } }, group));
      }
      suggestions.append(
        h(
          "div",
          {
            id: `suggestion-${index}`,
            className: "suggestion",
            attrs: { role: "option", "aria-selected": "false" },
            on: {
              mousedown: (event) => event.preventDefault(),
              click: () => apply(item),
              mousemove: () => {
                if (selected !== index) {
                  selected = index;
                  highlightSelection();
                }
              },
            },
          },
          h("span", { className: "suggestion-icon", attrs: { "aria-hidden": "true" } }, item.icon),
          h("span", { className: "suggestion-label" }, item.label),
          h("span", { className: "suggestion-detail" }, item.detail),
        ),
      );
    });
    suggestions.append(
      h(
        "div",
        { className: "suggestion-help", attrs: { role: "presentation" } },
        h("kbd", {}, "↑↓"),
        ` ${t("suggest.select")}  `,
        h("kbd", {}, "Tab"),
        ` ${t("suggest.complete")}  `,
        h("kbd", {}, "Enter"),
        ` ${t("suggest.run")}  `,
        h("kbd", {}, "Esc"),
        ` ${t("suggest.close")}`,
      ),
    );
  };

  function refresh(): void {
    items = options.suggest(input.value);
    selected = 0;
    if (items.length === 0) {
      close();
      return;
    }
    render();
    suggestions.hidden = false;
    input.setAttribute("aria-expanded", "true");
    highlightSelection();
  }

  const recall = (direction: -1 | 1): void => {
    if (history.length === 0) {
      return;
    }
    if (historyCursor === history.length) {
      draft = input.value;
    }
    historyCursor = Math.min(history.length, Math.max(0, historyCursor + direction));
    input.value = historyCursor === history.length ? draft : (history[historyCursor] ?? "");
    input.setSelectionRange(input.value.length, input.value.length);
  };

  input.addEventListener("input", refresh);
  input.addEventListener("focus", () => {
    if (input.value !== "") {
      refresh();
    }
  });
  input.addEventListener("blur", close);
  input.addEventListener("keydown", (event) => {
    switch (event.key) {
      case "ArrowDown":
      case "ArrowUp": {
        event.preventDefault();
        const step = event.key === "ArrowDown" ? 1 : -1;
        if (isOpen()) {
          selected = (selected + step + items.length) % items.length;
          highlightSelection();
        } else {
          recall(step);
        }
        return;
      }
      case "Tab": {
        event.preventDefault();
        const item = items[selected];
        if (isOpen() && item) {
          apply({ ...item, submit: false });
        } else {
          refresh();
        }
        return;
      }
      case "Enter": {
        event.preventDefault();
        const item = items[selected];
        if (isOpen() && item && item.insert.trim() !== input.value.trim()) {
          apply(item);
        } else {
          submit(input.value);
        }
        return;
      }
      case "Escape":
        event.preventDefault();
        if (isOpen()) {
          close();
        } else {
          input.value = "";
        }
        return;
      default:
        return;
    }
  });

  const offsetWithin = (element: HTMLElement): number => {
    let top = 0;
    let node: HTMLElement | null = element;
    while (node !== null && node !== screen) {
      top += node.offsetTop;
      node = node.offsetParent instanceof HTMLElement ? node.offsetParent : null;
    }
    return top;
  };

  const reveal = (element: HTMLElement): void => {
    const top = Math.max(0, offsetWithin(element) - 12);
    screen.scrollTo({ top, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  };

  return {
    print(body, printOptions = {}) {
      if (printOptions.key) {
        output.querySelectorAll(`[data-key="${CSS.escape(printOptions.key)}"]`).forEach((entry) => entry.remove());
      }
      const entry = h(
        "article",
        { className: `entry ${printOptions.className ?? ""}`.trim(), dataset: printOptions.key ? { key: printOptions.key } : {} },
        printOptions.echo
          ? h("div", { className: "echo" }, h("span", { className: "echo-caret", attrs: { "aria-hidden": "true" } }, "❯"), printOptions.echo)
          : null,
        h("div", { className: "entry-body" }, body),
      );
      output.append(entry);
      while (output.childElementCount > OUTPUT_LIMIT) {
        output.firstElementChild?.remove();
      }
      reveal(entry);
      return entry;
    },
    clear() {
      clear(output);
    },
    focus() {
      input.focus({ preventScroll: true });
    },
    setValue(value) {
      input.value = value.slice(0, INPUT_LIMIT);
      input.focus({ preventScroll: true });
      refresh();
    },
    history: () => [...history],
    reveal,
  };
}
