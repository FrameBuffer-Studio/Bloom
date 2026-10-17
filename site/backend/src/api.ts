import type { DocsContent, Section } from "../../shared/content.ts";
import { DEFAULT_LANGUAGE, LANGUAGES, isLanguage } from "../../shared/languages.ts";
import type { Language } from "../../shared/languages.ts";
import { MAX_QUERY_LENGTH, findApi, rankApi, sanitizeQuery, searchDocs } from "../../shared/search.ts";

export interface ApiResponse {
  readonly status: number;
  readonly body: unknown;
  readonly cacheControl: string;
}

export type ApiHandler = (pathname: string, params: URLSearchParams) => ApiResponse;

const SLUG = /^[a-z0-9-]{1,64}$/;
const API_NAME = /^[A-Za-z_][\w.:]{0,79}$/;
const PUBLIC_CACHE = "public, max-age=300";
const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 50;

function ok(body: unknown, cacheControl = PUBLIC_CACHE): ApiResponse {
  return { status: 200, body, cacheControl };
}

function problem(status: number, error: string, message: string): ApiResponse {
  return { status, body: { error, message }, cacheControl: "no-store" };
}

function readQuery(params: URLSearchParams): string | ApiResponse {
  const raw = params.get("q") ?? "";
  if (raw.length > MAX_QUERY_LENGTH) {
    return problem(400, "query_too_long", `q must be at most ${MAX_QUERY_LENGTH} characters`);
  }
  return sanitizeQuery(raw);
}

function readLimit(params: URLSearchParams): number | ApiResponse {
  const raw = params.get("limit");
  if (raw === null) {
    return DEFAULT_LIMIT;
  }
  const limit = Number(raw);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    return problem(400, "invalid_limit", `limit must be an integer between 1 and ${MAX_LIMIT}`);
  }
  return limit;
}

function readLanguage(params: URLSearchParams): Language | ApiResponse {
  const raw = params.get("lang");
  if (raw === null) {
    return DEFAULT_LANGUAGE;
  }
  return isLanguage(raw) ? raw : problem(400, "invalid_lang", `lang must be one of: ${LANGUAGES.join(", ")}`);
}

interface LanguageIndex {
  readonly sections: ReadonlyMap<string, Section>;
  readonly list: readonly Pick<Section, "slug" | "order" | "title" | "summary">[];
}

function indexContent(content: DocsContent): LanguageIndex {
  return {
    sections: new Map(content.sections.map((section) => [section.slug, section])),
    list: content.sections.map(({ slug, order, title, summary }) => ({ slug, order, title, summary })),
  };
}

export function createApi(contents: Readonly<Record<Language, DocsContent>>, startedAt: number): ApiHandler {
  const indexes = new Map(LANGUAGES.map((language) => [language, indexContent(contents[language])]));

  return (pathname, params) => {
    const language = readLanguage(params);
    if (typeof language !== "string") {
      return language;
    }
    const content = contents[language];
    const { sections, list: index } = indexes.get(language) ?? indexContent(content);

    const parts = pathname.split("/").filter(Boolean);
    if (parts[0] !== "api" || parts[1] !== "v1") {
      return problem(404, "not_found", "Unknown API version");
    }
    const [resource, id, extra] = parts.slice(2);
    if (extra !== undefined) {
      return problem(404, "not_found", "Unknown API route");
    }

    switch (resource) {
      case "health":
        return ok(
          {
            status: "ok",
            version: content.version,
            languages: LANGUAGES,
            sections: content.sections.length,
            functions: content.api.length,
            uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
          },
          "no-store",
        );

      case "sections": {
        if (id === undefined) {
          return ok({ language, sections: index });
        }
        if (!SLUG.test(id)) {
          return problem(400, "invalid_slug", "Section slug may contain only a-z, 0-9 and '-'");
        }
        const section = sections.get(id);
        return section ? ok(section) : problem(404, "section_not_found", `No section named ${id}`);
      }

      case "functions": {
        if (id !== undefined) {
          if (!API_NAME.test(id)) {
            return problem(400, "invalid_name", "Function name may contain only letters, digits, '_', '.' and ':'");
          }
          const matches = findApi(content.api, id);
          return matches.length > 0 ? ok({ functions: matches }) : problem(404, "function_not_found", `No function matches ${id}`);
        }
        const query = readQuery(params);
        if (typeof query !== "string") {
          return query;
        }
        return ok({ functions: query === "" ? content.api : rankApi(content.api, query, MAX_LIMIT) });
      }

      case "search": {
        const query = readQuery(params);
        const limit = readLimit(params);
        if (typeof query !== "string") {
          return query;
        }
        if (typeof limit !== "number") {
          return limit;
        }
        if (query === "") {
          return problem(400, "missing_query", "Pass a search query as ?q=");
        }
        return ok({ language, query, results: searchDocs(content, query, limit) });
      }

      default:
        return problem(404, "not_found", "Unknown API route");
    }
  };
}
