type CachedFetchResponse = {
  body: ArrayBuffer;
  headers: [string, string][];
  status: number;
  statusText: string;
  timestamp: number;
};

const DEFAULT_TTL_MS = 5 * 60 * 1000;
const MAX_CACHE_ITEMS = 150;
const cache = new Map<string, CachedFetchResponse>();
const inFlight = new Map<string, Promise<Response>>();
let installed = false;

const isSupabaseReadRequest = (url: string, method: string) => {
  if (method !== "GET" && method !== "HEAD") return false;
  if (!url.includes(".supabase.co")) return false;
  return url.includes("/rest/v1/") || url.includes("/rpc/");
};

const getCacheKey = (url: string, init?: RequestInit) => {
  const headers = new Headers(init?.headers);
  return [
    url,
    headers.get("authorization") ?? "",
    headers.get("apikey") ?? "",
    headers.get("range") ?? "",
  ].join("::");
};

const cloneFromCache = (cached: CachedFetchResponse) =>
  new Response(cached.body.slice(0), {
    status: cached.status,
    statusText: cached.statusText,
    headers: cached.headers,
  });

const trimCache = () => {
  while (cache.size > MAX_CACHE_ITEMS) {
    const firstKey = cache.keys().next().value;
    if (!firstKey) break;
    cache.delete(firstKey);
  }
};

export const installSupabaseEgressGuard = (ttlMs = DEFAULT_TTL_MS) => {
  if (installed || typeof window === "undefined" || typeof window.fetch !== "function") return;
  installed = true;
  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : null;
    const url = request?.url ?? String(input);
    const method = (init?.method ?? request?.method ?? "GET").toUpperCase();

    if (!isSupabaseReadRequest(url, method)) {
      return originalFetch(input, init);
    }

    const cacheKey = getCacheKey(url, init ?? (request ? { headers: request.headers } : undefined));
    const now = Date.now();
    const cached = cache.get(cacheKey);

    if (cached && now - cached.timestamp < ttlMs) {
      return cloneFromCache(cached);
    }

    const current = inFlight.get(cacheKey);
    if (current) {
      const response = await current;
      return response.clone();
    }

    const fetchPromise = originalFetch(input, init);
    inFlight.set(cacheKey, fetchPromise);

    try {
      const response = await fetchPromise;
      if (response.ok && (method === "GET" || method === "HEAD")) {
        const cloned = response.clone();
        const body = await cloned.arrayBuffer();
        cache.set(cacheKey, {
          body,
          headers: Array.from(cloned.headers.entries()),
          status: cloned.status,
          statusText: cloned.statusText,
          timestamp: now,
        });
        trimCache();
      }
      return response;
    } finally {
      inFlight.delete(cacheKey);
    }
  };
};
