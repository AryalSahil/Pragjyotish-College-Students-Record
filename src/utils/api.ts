/**
 * Utility to safely parse JSON responses from API calls.
 * Protects against non-JSON / HTML responses (such as Vercel 404/500 "The page could not be found")
 * preventing the runtime error:
 * "SyntaxError: Unexpected token 'T', 'The page c'... is not valid JSON"
 */

export async function parseJsonResponse<T = any>(res: Response): Promise<T> {
  const contentType = res.headers.get("content-type") || "";

  if (!contentType.includes("application/json")) {
    const text = await res.text();
    if (!res.ok) {
      if (text.includes("The page could not be found") || res.status === 404) {
        throw new Error("API endpoint not found (HTTP 404). Please verify that backend API routes are deployed.");
      }
      throw new Error(text.slice(0, 150) || `Server returned error (${res.status})`);
    }

    try {
      return JSON.parse(text);
    } catch {
      throw new Error("Server returned non-JSON response");
    }
  }

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error || data?.message || `Request failed with status ${res.status}`);
  }
  return data;
}

export async function safeFetch<T = any>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init);
  return parseJsonResponse<T>(res);
}
