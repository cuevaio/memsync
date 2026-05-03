const UUID_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i;

function extractUuid(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const match = value.match(UUID_PATTERN);
  return match?.[0] ?? null;
}

function deepSearchForUuid(value: unknown, seen = new WeakSet<object>()): string | null {
  if (typeof value === "string") {
    return extractUuid(value);
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  if (seen.has(value)) {
    return null;
  }

  seen.add(value);

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = deepSearchForUuid(item, seen);
      if (found) {
        return found;
      }
    }

    return null;
  }

  const record = value as Record<string, unknown>;

  for (const [key, nestedValue] of Object.entries(record)) {
    if (key.toLowerCase().includes("organization") || key.toLowerCase().includes("org")) {
      const direct = deepSearchForUuid(nestedValue, seen);
      if (direct) {
        return direct;
      }
    }
  }

  for (const nestedValue of Object.values(record)) {
    const found = deepSearchForUuid(nestedValue, seen);
    if (found) {
      return found;
    }
  }

  return null;
}

function getCookie(name: string): string | null {
  const entries = document.cookie.split(";").map(part => part.trim());
  for (const entry of entries) {
    if (!entry.startsWith(`${name}=`)) {
      continue;
    }

    return decodeURIComponent(entry.slice(name.length + 1));
  }

  return null;
}

export function deriveOrgId(): string {
  const fromCookie = extractUuid(getCookie("lastActiveOrg"));
  if (fromCookie) {
    return fromCookie;
  }

  const fromStorage = extractUuid(window.localStorage.getItem("lastActiveOrg") ?? window.sessionStorage.getItem("lastActiveOrg"));
  if (fromStorage) {
    return fromStorage;
  }

  const fromLocation = [window.location.search, window.location.hash].map(part => extractUuid(part)).find(Boolean);

  if (fromLocation) {
    return fromLocation;
  }

  const nextData = (window as typeof window & { __NEXT_DATA__?: unknown }).__NEXT_DATA__;
  const fromNextData = deepSearchForUuid(nextData);
  if (fromNextData) {
    return fromNextData;
  }

  for (const script of document.querySelectorAll('script[type="application/json"], script[id*="__NEXT_DATA__"]')) {
    try {
      const parsed = JSON.parse(script.textContent ?? "null");
      const found = deepSearchForUuid(parsed);
      if (found) {
        return found;
      }
    } catch {
      continue;
    }
  }

  for (const element of document.querySelectorAll<HTMLAnchorElement>("a[href], [data-testid], [data-org-id]")) {
    const found = extractUuid(element.getAttribute("href") ?? element.getAttribute("data-org-id") ?? element.outerHTML);
    if (found) {
      return found;
    }
  }

  throw new Error("Could not determine the active Claude organization ID on this page.");
}
