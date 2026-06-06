export async function fetchJson(url: URL, timeoutMs = 10_000): Promise<unknown> {
  const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });

  if (!response.ok) {
    throw new Error(`Requête météo échouée (${response.status}) pour ${url.origin}`);
  }

  return response.json();
}
