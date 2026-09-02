export type UrlStateValue = string | number | boolean | null | undefined;

export interface UrlStateLocation {
  pathname: string;
  search?: string | URLSearchParams;
  hash?: string;
}

/**
 * Build an App-local href after changing only the supplied query keys.
 *
 * App state belongs in the App URL so Kylon can preserve it in a canonical
 * `/p/` link. `null` and `undefined` remove a key; empty strings, zero, and
 * false remain explicit values. Unrelated query state and the fragment are
 * preserved.
 */
export function buildUrlStateHref(
  location: UrlStateLocation,
  patch: Readonly<Record<string, UrlStateValue>>,
): string {
  if (
    !/^\/(?![\/\\])/.test(location.pathname) ||
    /[\u0000-\u001f\u007f\\]/.test(location.pathname)
  ) {
    throw new Error("URL-state pathname must be App-relative and start with '/'.");
  }

  const search =
    location.search instanceof URLSearchParams
      ? new URLSearchParams(location.search)
      : new URLSearchParams((location.search ?? "").replace(/^\?/, ""));

  for (const [key, value] of Object.entries(patch)) {
    if (!key) throw new Error("URL-state keys must be non-empty.");
    if (value == null) search.delete(key);
    else search.set(key, String(value));
  }

  const query = search.toString();
  const hash = (location.hash ?? "").replace(/^#/, "");
  return `${location.pathname}${query ? `?${query}` : ""}${hash ? `#${hash}` : ""}`;
}

/** Read one query value only when it is one of the route's supported states. */
export function readUrlState<T extends string>(
  search: string | URLSearchParams,
  key: string,
  allowed: readonly T[],
  fallback: T,
): T {
  const params =
    search instanceof URLSearchParams
      ? search
      : new URLSearchParams(search.replace(/^\?/, ""));
  const value = params.get(key);
  return value !== null && allowed.includes(value as T) ? (value as T) : fallback;
}
