export type Inline =
  | { readonly kind: "text"; readonly value: string }
  | { readonly kind: "code"; readonly value: string }
  | { readonly kind: "strong"; readonly children: readonly Inline[] }
  | { readonly kind: "em"; readonly children: readonly Inline[] }
  | { readonly kind: "link"; readonly href: string; readonly children: readonly Inline[] };

export type CalloutKind = "note" | "tip" | "important" | "warning" | "caution" | "quote";

export type TableAlign = "left" | "center" | "right" | null;

export type Block =
  | { readonly kind: "heading"; readonly level: number; readonly id: string; readonly content: readonly Inline[] }
  | { readonly kind: "paragraph"; readonly content: readonly Inline[] }
  | { readonly kind: "code"; readonly language: string; readonly code: string }
  | { readonly kind: "list"; readonly ordered: boolean; readonly start: number; readonly items: readonly (readonly Inline[])[] }
  | {
      readonly kind: "table";
      readonly align: readonly TableAlign[];
      readonly header: readonly (readonly Inline[])[];
      readonly rows: readonly (readonly (readonly Inline[])[])[];
    }
  | { readonly kind: "callout"; readonly variant: CalloutKind; readonly blocks: readonly Block[] }
  | { readonly kind: "rule" };

export interface HeadingRef {
  readonly id: string;
  readonly level: number;
  readonly title: string;
}

export interface Section {
  readonly slug: string;
  readonly order: number;
  readonly title: string;
  readonly summary: string;
  readonly headings: readonly HeadingRef[];
  readonly blocks: readonly Block[];
}

export interface ApiEntry {
  readonly name: string;
  readonly short: string;
  readonly signature: string;
  readonly section: string;
  readonly anchor: string;
  readonly summary: string;
}

export interface SearchChunk {
  readonly section: string;
  readonly anchor: string;
  readonly heading: string;
  readonly text: string;
}

export interface DocsContent {
  readonly version: string;
  readonly sections: readonly Section[];
  readonly api: readonly ApiEntry[];
  readonly chunks: readonly SearchChunk[];
}

export const HOME_SLUG = "index";
export const API_HEADER = "X-Bloom-Api";
export const API_VERSION = "v1";
