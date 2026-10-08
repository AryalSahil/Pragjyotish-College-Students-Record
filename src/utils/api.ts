/**
 * Utility to safely parse JSON responses from API calls.
 * Protects against non-JSON / HTML responses (such as Vercel 404/500 "The page could not be found")
 * preventing the runtime error:
 * "SyntaxError: Unexpected token 'T', 'The page c'... is not valid JSON"
 */

export async function parseJsonResponse<T = any>(res: Response): Promise<T> {
  const contentType = res.headers.get("content-type") || "";
  let rawText = "";

  try {
    rawText = await res.text();
  } catch (err: any) {
    throw new Error(`Failed to read response: ${err?.message || "Network error"}`);
  }

  let data: any = null;
  let isJson = false;

  if (rawText && rawText.trim().length > 0) {
    try {
      data = JSON.parse(rawText);
      isJson = true;
    } catch {
      isJson = false;
    }
  } else {
    // Empty body (e.g. 204 No Content or empty 200)
    data = {} as T;
    isJson = true;
  }

  if (!res.ok) {
    if (isJson && data && typeof data === "object") {
      const errMsg = data.error || data.message || `Request failed with status ${res.status}`;
      throw new Error(errMsg);
    }

    if (rawText.includes("The page could not be found") || res.status === 404) {
      throw new Error("API endpoint not found (HTTP 404). Please verify that backend API routes are deployed.");
    }
    if (rawText.includes("FUNCTION_INVOCATION_FAILED")) {
      throw new Error("Serverless function invocation failed. Please check your database connection credentials (DATABASE_URL or POSTGRES_URL) in Vercel project settings.");
    }
    if (rawText.includes("504 Gateway Time-out") || res.status === 504) {
      throw new Error("Server request timed out (HTTP 504). Please try again.");
    }
    if (rawText.includes("502 Bad Gateway") || res.status === 502) {
      throw new Error("Bad gateway (HTTP 502). Backend service is temporarily unavailable.");
    }

    // Strip HTML tags for clean error messaging if HTML error page was returned
    const cleanText = rawText.replace(/<[^>]*>?/gm, " ").replace(/\s+/g, " ").trim();
    const errorSnippet = cleanText.slice(0, 150);
    throw new Error(errorSnippet || `Request failed with status ${res.status}`);
  }

  if (!isJson) {
    throw new Error(`Server returned non-JSON response (${contentType || "plain text"}): ${rawText.slice(0, 100)}`);
  }

  return data as T;
}

export async function safeFetch<T = any>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init);
  return parseJsonResponse<T>(res);
}
