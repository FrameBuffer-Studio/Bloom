export interface Route {
  readonly slug: string;
  readonly anchor: string;
}

const ROUTE = /^#\/([\p{L}\p{N}_-]+)(?:\/([^/]+))?\/?$/u;

export function parseRoute(hash: string): Route | null {
  const match = ROUTE.exec(hash);
  if (!match) {
    return null;
  }
  try {
    return { slug: (match[1] ?? "").toLowerCase(), anchor: match[2] ? decodeURIComponent(match[2]) : "" };
  } catch {
    return null;
  }
}

export function formatRoute(route: Route): string {
  return route.anchor ? `#/${route.slug}/${encodeURIComponent(route.anchor)}` : `#/${route.slug}`;
}

export function watchRoutes(onRoute: (route: Route | null) => void): (route: Route) => void {
  window.addEventListener("hashchange", () => onRoute(parseRoute(window.location.hash)));

  return (route: Route): void => {
    const target = formatRoute(route);
    if (window.location.hash === target) {
      onRoute(route);
    } else {
      window.location.hash = target;
    }
  };
}
