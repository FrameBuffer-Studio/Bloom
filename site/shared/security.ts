const DIRECTIVES: readonly (readonly [string, string])[] = [
  ["default-src", "'none'"],
  ["script-src", "'self'"],
  ["style-src", "'self'"],
  ["img-src", "'self' data:"],
  ["font-src", "'self'"],
  ["connect-src", "'self'"],
  ["manifest-src", "'self'"],
  ["base-uri", "'none'"],
  ["form-action", "'none'"],
  ["require-trusted-types-for", "'script'"],
  ["trusted-types", "'none'"],
];

export function contentSecurityPolicy(options: { readonly forHeader: boolean }): string {
  const directives = options.forHeader ? [...DIRECTIVES, ["frame-ancestors", "'none'"] as const] : DIRECTIVES;
  return directives.map(([name, value]) => `${name} ${value}`).join("; ");
}

export const SECURITY_HEADERS: Readonly<Record<string, string>> = {
  "Content-Security-Policy": contentSecurityPolicy({ forHeader: true }),
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Origin-Agent-Cluster": "?1",
  "Permissions-Policy": "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()",
  "Referrer-Policy": "no-referrer",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-Permitted-Cross-Domain-Policies": "none",
};
