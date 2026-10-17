import type { DocsContent } from "../../shared/content.ts";
import { delay, h, prefersReducedMotion } from "./dom.ts";
import { t } from "./i18n.ts";
import { readValue, writeValue } from "./storage.ts";

interface BootLine {
  readonly status: "OK" | "INFO";
  readonly text: string;
}

function lines(content: DocsContent, mode: "api" | "static"): BootLine[] {
  const counts = { sections: content.sections.length, functions: content.api.length };
  return [
    { status: "OK", text: t("boot.vm") },
    { status: "OK", text: t("boot.probe") },
    { status: "OK", text: t("boot.granted") },
    { status: "OK", text: t("boot.tiles") },
    { status: "OK", text: t("boot.mount", counts) },
    { status: "INFO", text: mode === "api" ? t("boot.api") : t("boot.static") },
  ];
}

export async function boot(output: HTMLElement, content: DocsContent, mode: "api" | "static"): Promise<void> {
  const fast = prefersReducedMotion() || readValue("booted", "session") === "1";
  writeValue("booted", "1", "session");

  const controller = new AbortController();
  const skip = (): void => controller.abort();
  window.addEventListener("keydown", skip, { once: true });
  window.addEventListener("pointerdown", skip, { once: true });

  const log = h("div", { className: "boot", attrs: { "aria-hidden": "true" } });
  output.append(log);

  for (const line of fast ? [] : lines(content, mode)) {
    await delay(110 + Math.random() * 140, controller.signal);
    log.append(
      h(
        "div",
        { className: "boot-line" },
        h("span", { className: `boot-status ${line.status === "OK" ? "ok" : "info"}` }, `[ ${line.status.padEnd(4)} ]`),
        line.text,
      ),
    );
  }

  if (!fast) {
    await delay(260, controller.signal);
  }
  window.removeEventListener("keydown", skip);
  window.removeEventListener("pointerdown", skip);
  log.remove();
}
