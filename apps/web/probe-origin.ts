function normalizeOrigin(value: string): string | null {
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.pathname !== "/" || url.search || url.hash) return null;
    return url.origin;
  } catch { return null; }
}

export function allowedProbeOrigins(environment = process.env): string[] {
  const configured = [environment.APP_BASE_URL, ...(environment.PROBE_ALLOWED_ORIGINS ?? "").split(",")].filter((value): value is string => Boolean(value)).map(normalizeOrigin).filter((value): value is string => value !== null);
  if (configured.length) return [...new Set(configured)];
  return environment.NODE_ENV === "production" ? [] : ["http://localhost:3000"];
}

export function isAllowedProbeOrigin(origin: string | null, environment = process.env): boolean {
  if (!origin) return false;
  const normalized = normalizeOrigin(origin);
  return normalized !== null && allowedProbeOrigins(environment).includes(normalized);
}
