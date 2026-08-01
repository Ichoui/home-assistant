import { getFirestore } from "firebase-admin/firestore";
import { HOME_LOCATION } from "../config.js";
import type { WeatherState } from "../domain/weather-state.js";
import { fetchMeteoCanAlerts } from "../providers/meteo-can";
import { fetchOpenMeteo } from "../providers/open-meteo";

const WEATHER_DOCUMENT = "weather/home";

export async function refreshWeatherState(): Promise<WeatherState> {
  const [forecast, alerts] = await Promise.all([
    fetchOpenMeteo(HOME_LOCATION.latitude, HOME_LOCATION.longitude, "best_match"),
    fetchMeteoCanAlerts(HOME_LOCATION.latitude, HOME_LOCATION.longitude),
  ]);
  const updatedAt = new Date().toISOString();
  const state: WeatherState = {
    location: { ...HOME_LOCATION },
    updatedAt,
    forecastModel: forecast.model,
    current: forecast.current,
    hourly: forecast.hourly,
    daily: forecast.daily,
    alerts,
  };

  await getFirestore().doc(WEATHER_DOCUMENT).set(state);
  return state;
}

export async function getWeatherState(): Promise<WeatherState | null> {
  const snapshot = await getFirestore().doc(WEATHER_DOCUMENT).get();
  return snapshot.exists ? (snapshot.data() as WeatherState) : null;
}
