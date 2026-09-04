/**
 * Utility to safely fetch and parse JSON responses from API routes.
 * Prevents "Unexpected end of JSON input" or HTML error page crash.
 */
export async function safeFetchJson<T = any>(url: string, options?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, options);
  } catch (netErr: any) {
    throw new Error(netErr?.message || "Network error. Unable to connect to server.");
  }

  const contentType = response.headers.get("content-type") || "";
  const rawText = await response.text();

  let parsed: any = null;
  if (rawText && rawText.trim()) {
    try {
      parsed = JSON.parse(rawText);
    } catch {
      // Not valid JSON
      parsed = null;
    }
  }

  if (!response.ok) {
    if (parsed && typeof parsed === "object" && parsed.error) {
      throw new Error(parsed.error);
    }
    if (response.status === 404) {
      throw new Error("API endpoint not found (404). Please ensure the backend function is deployed.");
    }
    if (response.status === 500) {
      throw new Error(parsed?.error || "AI service internal error (500). Please check your Gemini API key.");
    }
    throw new Error(`Server returned HTTP ${response.status}: ${rawText.slice(0, 150) || "Empty response"}`);
  }

  if (parsed === null) {
    throw new Error("AI service returned an empty or non-JSON response. Please check server configuration and Gemini API Key.");
  }

  return parsed as T;
}
