import { getFirestore } from "firebase-admin/firestore";
import {
  fetchIntervalsWellness,
  type IntervalsWellness,
  type IntervalsWellnessResult,
} from "../intervals/client.js";

export const WELLNESS_ACCOUNTS = ["me", "partner"] as const;
export type WellnessAccountId = (typeof WELLNESS_ACCOUNTS)[number];
export type WellnessStatus = "available" | "pending" | "missing" | "error" | "invalidated";

type WellnessCacheDocument = {
  accountId: WellnessAccountId;
  date: string;
  status: WellnessStatus;
  wellness?: IntervalsWellness;
  sourceUpdatedAt?: string | null;
  fetchedAt?: string;
  expiresAt?: string;
  generation: number;
  invalidatedAt?: string;
};

export type DailyWellnessAccountResponse = {
  status: WellnessStatus;
  cache: {
    hit: boolean;
    stale: boolean;
    fetchedAt: string | null;
    expiresAt: string | null;
  };
  sourceUpdatedAt: string | null;
  wellness: IntervalsWellness | null;
};

const CACHE_COLLECTION = "wellnessCache";
const CACHE_TTL_MS: Record<Exclude<WellnessStatus, "invalidated">, number> = {
  available: 60 * 60 * 1_000,
  pending: 5 * 60 * 1_000,
  missing: 5 * 60 * 1_000,
  error: 2 * 60 * 1_000,
};

function cacheDocumentId(date: string, accountId: WellnessAccountId): string {
  return `${date}__${accountId}`;
}

function isWellnessStatus(value: unknown): value is WellnessStatus {
  return value === "available" || value === "pending" || value === "missing" || value === "error" || value === "invalidated";
}

function readCacheDocument(value: unknown): WellnessCacheDocument | null {
  if (typeof value !== "object" || value === null) return null;
  const document = value as Partial<WellnessCacheDocument>;
  if (
    (document.accountId !== "me" && document.accountId !== "partner") ||
    typeof document.date !== "string" ||
    !isWellnessStatus(document.status)
  ) {
    return null;
  }

  return {
    accountId: document.accountId,
    date: document.date,
    status: document.status,
    wellness: document.wellness,
    sourceUpdatedAt: document.sourceUpdatedAt ?? null,
    fetchedAt: document.fetchedAt,
    expiresAt: document.expiresAt,
    generation: typeof document.generation === "number" ? document.generation : 0,
    invalidatedAt: document.invalidatedAt,
  };
}

function isCacheValid(cache: WellnessCacheDocument | null, now: Date): boolean {
  return (
    cache !== null &&
    cache.status !== "invalidated" &&
    typeof cache.expiresAt === "string" &&
    Number.isFinite(Date.parse(cache.expiresAt)) &&
    Date.parse(cache.expiresAt) > now.getTime()
  );
}

function asResponse(
  cache: WellnessCacheDocument | null,
  options: { hit: boolean; stale: boolean },
): DailyWellnessAccountResponse {
  if (!cache) {
    return {
      status: "error",
      cache: { hit: options.hit, stale: options.stale, fetchedAt: null, expiresAt: null },
      sourceUpdatedAt: null,
      wellness: null,
    };
  }

  return {
    status: cache.status,
    cache: {
      hit: options.hit,
      stale: options.stale,
      fetchedAt: cache.fetchedAt ?? null,
      expiresAt: cache.expiresAt ?? null,
    },
    sourceUpdatedAt: cache.sourceUpdatedAt ?? null,
    wellness: cache.status === "available" && cache.wellness ? cache.wellness : null,
  };
}

function sourceUpdatedAt(wellness: IntervalsWellness): string | null {
  return typeof wellness.updated === "string" ? wellness.updated : null;
}

function nextExpiry(status: Exclude<WellnessStatus, "invalidated">, now: Date): string {
  return new Date(now.getTime() + CACHE_TTL_MS[status]).toISOString();
}

function recordFromProvider(
  result: IntervalsWellnessResult,
  accountId: WellnessAccountId,
  date: string,
  generation: number,
  now: Date,
  staleCache: WellnessCacheDocument | null,
): { document: WellnessCacheDocument; stale: boolean } {
  if (result.kind === "available") {
    return {
      document: {
        accountId,
        date,
        status: "available",
        wellness: result.wellness,
        sourceUpdatedAt: sourceUpdatedAt(result.wellness),
        fetchedAt: now.toISOString(),
        expiresAt: nextExpiry("available", now),
        generation,
      },
      stale: false,
    };
  }

  if (result.kind === "pending" || result.kind === "missing") {
    return {
      document: {
        accountId,
        date,
        status: result.kind,
        sourceUpdatedAt: null,
        fetchedAt: now.toISOString(),
        expiresAt: nextExpiry(result.kind, now),
        generation,
      },
      stale: false,
    };
  }

  if (staleCache?.status === "available" && staleCache.wellness) {
    return {
      document: {
        ...staleCache,
        expiresAt: nextExpiry("error", now),
        generation,
      },
      stale: true,
    };
  }

  return {
    document: {
      accountId,
      date,
      status: "error",
      sourceUpdatedAt: null,
      fetchedAt: now.toISOString(),
      expiresAt: nextExpiry("error", now),
      generation,
    },
    stale: false,
  };
}

async function loadCache(date: string, accountId: WellnessAccountId): Promise<WellnessCacheDocument | null> {
  const snapshot = await getFirestore().collection(CACHE_COLLECTION).doc(cacheDocumentId(date, accountId)).get();
  return snapshot.exists ? readCacheDocument(snapshot.data()) : null;
}

async function refreshAccount(
  accountId: WellnessAccountId,
  date: string,
  apiKey: string,
): Promise<DailyWellnessAccountResponse> {
  let cache = await loadCache(date, accountId);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const now = new Date();
    if (isCacheValid(cache, now)) return asResponse(cache, { hit: true, stale: false });

    const expectedGeneration = cache?.generation ?? 0;
    const providerResult = await fetchIntervalsWellness(apiKey, date);
    const next = recordFromProvider(providerResult, accountId, date, expectedGeneration, new Date(), cache);
    const reference = getFirestore().collection(CACHE_COLLECTION).doc(cacheDocumentId(date, accountId));
    const writeSucceeded = await getFirestore().runTransaction(async (transaction) => {
      const currentSnapshot = await transaction.get(reference);
      const current = currentSnapshot.exists ? readCacheDocument(currentSnapshot.data()) : null;
      const currentGeneration = current?.generation ?? 0;
      if (currentGeneration !== expectedGeneration) return false;

      transaction.set(reference, next.document);
      return true;
    });

    if (writeSucceeded) return asResponse(next.document, { hit: false, stale: next.stale });
    cache = await loadCache(date, accountId);
  }

  return asResponse(cache, { hit: false, stale: false });
}

export function currentDateInTimeZone(now: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export async function getDailyWellness(
  date: string,
  apiKeys: Record<WellnessAccountId, string>,
): Promise<Record<WellnessAccountId, DailyWellnessAccountResponse>> {
  const results = await Promise.all(
    WELLNESS_ACCOUNTS.map(async (accountId) => [
      accountId,
      await refreshAccount(accountId, date, apiKeys[accountId]),
    ] as const),
  );
  return Object.fromEntries(results) as Record<WellnessAccountId, DailyWellnessAccountResponse>;
}

export async function resetDailyWellness(
  date: string,
  accountId: WellnessAccountId,
): Promise<void> {
  const reference = getFirestore().collection(CACHE_COLLECTION).doc(cacheDocumentId(date, accountId));
  await getFirestore().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference);
    const current = snapshot.exists ? readCacheDocument(snapshot.data()) : null;
    transaction.set(reference, {
      accountId,
      date,
      status: "invalidated",
      generation: (current?.generation ?? 0) + 1,
      invalidatedAt: new Date().toISOString(),
    });
  });
}
