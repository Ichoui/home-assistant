import { initializeApp } from "firebase-admin/app";
import { logger } from "firebase-functions";
import { defineSecret } from "firebase-functions/params";
import { onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { timingSafeEqual } from "node:crypto";
import { renderSmallTvPng } from "./render/smalltv";
import { mapWeatherStateForHomeAssistant } from "./services/home-assistant-weather.js";
import { getWeatherState, refreshWeatherState } from "./services/weather.js";

initializeApp();

const HOME_ASSISTANT_WEATHER_TOKEN = defineSecret("HOME_ASSISTANT_WEATHER_TOKEN");
const FUNCTION_REGION = "northamerica-northeast1";

function isAuthorizedForHomeAssistant(authorizationHeader?: string): boolean {
  const expectedToken = HOME_ASSISTANT_WEATHER_TOKEN.value();
  const token = authorizationHeader?.match(/^Bearer\s+(.+)$/i)?.[1] ?? "";

  if (!expectedToken || !token) return false;

  const expected = Buffer.from(expectedToken);
  const received = Buffer.from(token);
  return (
    expected.length === received.length && timingSafeEqual(expected, received)
  );
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

export const getSmallTvImage = onRequest(
  { region: FUNCTION_REGION, cors: true },
  async (_request, response) => {
    const state = await getWeatherState();
    if (!state) {
      response.status(503).send("Les données météo ne sont pas encore disponibles.");
      return;
    }
    const image = await renderSmallTvPng(state);
    response
      .set("Content-Type", "image/png")
      .set("Cache-Control", "public, max-age=300")
      .status(200)
      .send(image);
  },
);
