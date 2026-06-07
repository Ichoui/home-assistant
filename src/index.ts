import { initializeApp } from "firebase-admin/app";
import { logger } from "firebase-functions";
import { onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { renderSmallTvPng } from "./render/smalltv";
import {getWeatherState, refreshWeatherState} from "./services/weather.js";

initializeApp();

export const refreshWeather = onSchedule(
  { schedule: "every 15 minutes", timeZone: "America/Toronto", region: "northamerica-northeast1" },
  async () => {
    const state = await refreshWeatherState();
    logger.info("Weather state refreshed", {
      updatedAt: state.updatedAt,
      alerts: state.alerts.length,
    });
  },
);

export const getWeather = onRequest(
  { region: "northamerica-northeast1", cors: true },
  async (_request, response) => {
    const state = await getWeatherState();
    if (!state) {
      response.status(503).json({ error: "Les données météo ne sont pas encore disponibles." });
      return;
    }
    response.set("Cache-Control", "public, max-age=300").json(state);
  },
);

export const getSmallTvImage = onRequest(
  { region: "northamerica-northeast1", cors: true },
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
