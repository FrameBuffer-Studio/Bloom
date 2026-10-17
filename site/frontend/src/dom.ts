export type Child = Node | string | number | null | undefined | false;

export interface Props {
  readonly className?: string;
  readonly id?: string;
  readonly attrs?: Readonly<Record<string, string>>;
  readonly dataset?: Readonly<Record<string, string>>;
  readonly on?: { readonly [K in keyof HTMLElementEventMap]?: (event: HTMLElementEventMap[K]) => void };
}

const SAFE_INTERNAL = /^#\/[\p{L}\p{N}\-_/%.]*$/u;

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Props = {},
  ...children: readonly Child[]
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (props.className) {
    element.className = props.className;
  }
  if (props.id) {
    element.id = props.id;
  }
  for (const [name, value] of Object.entries(props.attrs ?? {})) {
    element.setAttribute(name, value);
  }
  for (const [name, value] of Object.entries(props.dataset ?? {})) {
    element.dataset[name] = value;
  }
  for (const [name, listener] of Object.entries(props.on ?? {})) {
    element.addEventListener(name, listener as EventListener);
  }
  append(element, children);
  return element;
}

export function append(parent: Node, children: readonly Child[]): void {
  for (const child of children) {
    if (child === null || child === undefined || child === false) {
      continue;
    }
    parent.appendChild(typeof child === "string" || typeof child === "number" ? document.createTextNode(String(child)) : child);
  }
}

export function fragment(...children: readonly Child[]): DocumentFragment {
  const result = document.createDocumentFragment();
  append(result, children);
  return result;
}

export function clear(element: Element): void {
  element.replaceChildren();
}

export function byId<T extends HTMLElement>(id: string, type: new () => T): T {
  const element = document.getElementById(id);
  if (!(element instanceof type)) {
    throw new Error(`Missing element #${id}`);
  }
  return element;
}

export function safeHref(href: string): { readonly href: string; readonly external: boolean } | null {
  if (SAFE_INTERNAL.test(href)) {
    return { href, external: false };
  }
  try {
    const url = new URL(href);
    return url.protocol === "https:" || url.protocol === "http:" ? { href: url.href, external: true } : null;
  } catch {
    return null;
  }
}

export function link(href: string, children: readonly Child[], className = ""): HTMLElement {
  const safe = safeHref(href);
  if (safe === null) {
    return h("span", { className }, ...children);
  }
  const attrs: Record<string, string> = { href: safe.href };
  if (safe.external) {
    attrs["target"] = "_blank";
    attrs["rel"] = "noopener noreferrer nofollow";
  }
  return h("a", { className, attrs }, ...children);
}

export function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function delay(milliseconds: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve();
      return;
    }
    const timer = window.setTimeout(resolve, milliseconds);
    signal?.addEventListener(
      "abort",
      () => {
        window.clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}
