import { initializeApp } from "firebase-admin/app";
import { logger } from "firebase-functions";
import { defineSecret, defineString } from "firebase-functions/params";
import { onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { timingSafeEqual } from "node:crypto";
import { TIME_ZONE } from "./config.js";
import {
  currentDateInTimeZone,
  getDailyWellness as getDailyWellnessForDate,
  resetDailyWellness as resetDailyWellnessForDate,
  WELLNESS_ACCOUNTS,
  type WellnessAccountId,
} from "./services/daily-wellness.js";
import { mapWeatherStateForHomeAssistant } from "./services/home-assistant-weather.js";
import { getWeatherState, refreshWeatherState } from "./services/weather.js";

initializeApp();

const HOME_ASSISTANT_WEATHER_TOKEN = defineSecret("HOME_ASSISTANT_WEATHER_TOKEN");
const INTERVALS_API_KEY_ME = defineSecret("INTERVALS_API_KEY_ME");
const INTERVALS_API_KEY_PARTNER = defineSecret("INTERVALS_API_KEY_PARTNER");
const HOME_ASSISTANT_WELLNESS_ENDPOINT_TOKEN = defineSecret("HOME_ASSISTANT_WELLNESS_ENDPOINT_TOKEN");
const WELLNESS_TIMEZONE = defineString("WELLNESS_TIMEZONE", { default: TIME_ZONE });
const FUNCTION_REGION = "northamerica-northeast1";

function isAuthorizedForHomeAssistant(authorizationHeader?: string): boolean {
  return isAuthorized(authorizationHeader, HOME_ASSISTANT_WEATHER_TOKEN.value());
}

function isAuthorized(authorizationHeader: string | undefined, expectedToken: string): boolean {
  const token = authorizationHeader?.match(/^Bearer\s+(.+)$/i)?.[1] ?? "";

  if (!expectedToken || !token) return false;

  const expected = Buffer.from(expectedToken);
  const received = Buffer.from(token);
  return (
    expected.length === received.length && timingSafeEqual(expected, received)
  );
}

function isWellnessAccount(value: unknown): value is WellnessAccountId {
  return typeof value === "string" && (WELLNESS_ACCOUNTS as readonly string[]).includes(value);
}

export const refreshWeather = onSchedule(
  { schedule: "every 15 minutes", timeZone: "America/Toronto", region: FUNCTION_REGION },
  async () => {
    const state = await refreshWeatherState();
    logger.info("Weather state refreshed", {
      updatedAt: state.updatedAt,
      alerts: state.alerts.length,
    });
  },
);

export const getWeather = onRequest(
  { region: FUNCTION_REGION, cors: true },
  async (_request, response) => {
    const state = await getWeatherState();
    if (!state) {
      response.status(503).json({ error: "Les données météo ne sont pas encore disponibles." });
      return;
    }
    response.set("Cache-Control", "public, max-age=300").json(state);
  },
);

export const getHomeAssistantWeather = onRequest(
  {
    region: FUNCTION_REGION,
    cors: true,
    secrets: [HOME_ASSISTANT_WEATHER_TOKEN],
  },
  async (request, response) => {
    if (!isAuthorizedForHomeAssistant(request.get("authorization"))) {
      response.status(401).json({ error: "Unauthorized" });
      return;
    }

    const state = await getWeatherState();
    if (!state) {
      response.status(503).json({ error: "Les données météo ne sont pas encore disponibles." });
      return;
    }

    response
      .set("Cache-Control", "private, max-age=300")
      .json(mapWeatherStateForHomeAssistant(state));
  },
);

export const getDailyWellness = onRequest(
  {
    region: FUNCTION_REGION,
    secrets: [INTERVALS_API_KEY_ME, INTERVALS_API_KEY_PARTNER, HOME_ASSISTANT_WELLNESS_ENDPOINT_TOKEN],
  },
  async (request, response) => {
    if (!isAuthorized(request.get("authorization"), HOME_ASSISTANT_WELLNESS_ENDPOINT_TOKEN.value())) {
      response.status(401).json({ error: "Unauthorized" });
      return;
    }
    if (request.method !== "GET") {
      response.set("Allow", "GET").status(405).json({ error: "Method Not Allowed" });
      return;
    }

    try {
      const timeZone = WELLNESS_TIMEZONE.value();
      const date = currentDateInTimeZone(new Date(), timeZone);
      const accounts = await getDailyWellnessForDate(date, {
        me: INTERVALS_API_KEY_ME.value(),
        partner: INTERVALS_API_KEY_PARTNER.value(),
      });
      response.set("Cache-Control", "private, no-store").status(200).json({
        apiVersion: "1",
        date,
        timezone: timeZone,
        generatedAt: new Date().toISOString(),
        accounts,
      });
    } catch {
      logger.error("Daily wellness request failed");
      response.status(500).json({ error: "Internal Server Error" });
    }
  },
);

export const resetDailyWellness = onRequest(
  { region: FUNCTION_REGION, secrets: [HOME_ASSISTANT_WELLNESS_ENDPOINT_TOKEN] },
  async (request, response) => {
    if (!isAuthorized(request.get("authorization"), HOME_ASSISTANT_WELLNESS_ENDPOINT_TOKEN.value())) {
      response.status(401).json({ error: "Unauthorized" });
      return;
    }
    if (request.method !== "DELETE") {
      response.set("Allow", "DELETE").status(405).json({ error: "Method Not Allowed" });
      return;
    }
    if (!isWellnessAccount(request.query.account)) {
      response.status(400).json({ error: "account must be me or partner" });
      return;
    }

    try {
      const date = currentDateInTimeZone(new Date(), WELLNESS_TIMEZONE.value());
      await resetDailyWellnessForDate(date, request.query.account);
      response.set("Cache-Control", "private, no-store").status(200).json({
        ok: true,
        account: request.query.account,
        date,
        status: "invalidated",
      });
    } catch {
      logger.error("Daily wellness reset failed");
      response.status(500).json({ error: "Internal Server Error" });
    }
  },
);
