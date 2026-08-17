export type IntervalsWellness = {
  id: string;
  updated?: string | null;
  [key: string]: unknown;
};

export type IntervalsWellnessResult =
  | { kind: "available"; wellness: IntervalsWellness }
  | { kind: "pending" }
  | { kind: "missing" }
  | { kind: "error" };

const INTERVALS_API_ORIGIN = "https://intervals.icu";
const DEFAULT_TIMEOUT_MS = 10_000;

function isIntervalsWellness(value: unknown): value is IntervalsWellness {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    typeof (value as { id?: unknown }).id === "string" &&
    (value as { id: string }).id.length > 0
  );
}

/** Fetches a single local-day wellness record without exposing provider details to callers. */
export async function fetchIntervalsWellness(
  apiKey: string,
  date: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<IntervalsWellnessResult> {
  const url = new URL(`/api/v1/athlete/0/wellness/${encodeURIComponent(date)}`, INTERVALS_API_ORIGIN);
  const authorization = `Basic ${Buffer.from(`API_KEY:${apiKey}`).toString("base64")}`;

  try {
    const response = await fetch(url, {
      headers: { Authorization: authorization, Accept: "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (response.status === 404) return { kind: "missing" };
    if (response.status === 204) return { kind: "pending" };
    if (
      response.status === 401 ||
      response.status === 403 ||
      response.status === 429 ||
      response.status >= 500
    ) {
      return { kind: "error" };
    }
    if (!response.ok) return { kind: "error" };

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      return { kind: "error" };
    }

    return isIntervalsWellness(body)
      ? { kind: "available", wellness: body }
      : { kind: "pending" };
  } catch {
    return { kind: "error" };
  }
}
