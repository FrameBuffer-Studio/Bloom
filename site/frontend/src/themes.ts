import type { MessageKey } from "./i18n.ts";
import { readValue, writeValue } from "./storage.ts";

export interface Theme {
  readonly name: string;
  readonly label: MessageKey;
  readonly palette: readonly string[];
}

export const THEMES: readonly Theme[] = [
  { name: "mono", label: "theme.mono", palette: ["#000000", "#6e6e6e", "#c2c2c2", "#ffffff"] },
  { name: "paper", label: "theme.paper", palette: ["#ffffff", "#c2c2c2", "#555555", "#000000"] },
];

const DEFAULT_THEME = "mono";

export function findTheme(name: string): Theme | undefined {
  return THEMES.find((theme) => theme.name === name.trim().toLowerCase());
}

export function currentTheme(): Theme {
  return findTheme(document.documentElement.dataset["theme"] ?? DEFAULT_THEME) ?? (THEMES[0] as Theme);
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset["theme"] = theme.name;
  writeValue("theme", theme.name);
  window.dispatchEvent(new CustomEvent("bloom:theme", { detail: theme }));
}

export function restoreTheme(): void {
  const saved = findTheme(readValue("theme") ?? DEFAULT_THEME);
  document.documentElement.dataset["theme"] = (saved ?? (THEMES[0] as Theme)).name;
}

export function setEffects(enabled: boolean): void {
  document.documentElement.dataset["effects"] = enabled ? "on" : "off";
  writeValue("effects", enabled ? "on" : "off");
}

export function restoreEffects(): void {
  document.documentElement.dataset["effects"] = readValue("effects") === "off" ? "off" : "on";
}

export function effectsEnabled(): boolean {
  return document.documentElement.dataset["effects"] !== "off";
}
