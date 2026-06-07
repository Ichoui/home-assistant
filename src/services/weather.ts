import { getFirestore } from "firebase-admin/firestore";
import { HOME_LOCATION } from "../config.js";
import type {
  WeatherComparisonState,
  WeatherForecast,
  WeatherState,
} from "../domain/weather-state.js";
import { fetchMeteoCanAlerts } from "../providers/meteo-can";
import { fetchOpenMeteo } from "../providers/open-meteo";

const WEATHER_DOCUMENT = "weather/home";
const GEM_COMPARISON_DOCUMENT = "weatherComparisons/gem-seamless";

function comparisonState(
  forecast: WeatherForecast,
  updatedAt: string,
): WeatherComparisonState {
  return {
    location: { ...HOME_LOCATION },
    updatedAt,
    forecastModel: forecast.model,
    current: forecast.current,
    hourly: forecast.hourly,
    daily: forecast.daily,
  };
}

export async function refreshWeatherState(): Promise<WeatherState> {
  const [forecast, alerts, gemForecast] = await Promise.all([
    fetchOpenMeteo(HOME_LOCATION.latitude, HOME_LOCATION.longitude, "best_match"),
    fetchMeteoCanAlerts(HOME_LOCATION.latitude, HOME_LOCATION.longitude),
    fetchOpenMeteo(
      HOME_LOCATION.latitude,
      HOME_LOCATION.longitude,
      "gem_seamless",
    ).catch((error: unknown) => {
      console.warn("GEM seamless comparison unavailable", error);
      return null;
    }),
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

  const writes: Array<Promise<FirebaseFirestore.WriteResult>> = [
    getFirestore().doc(WEATHER_DOCUMENT).set(state),
  ];
  if (gemForecast) {
    writes.push(
      getFirestore()
        .doc(GEM_COMPARISON_DOCUMENT)
        .set(comparisonState(gemForecast, updatedAt)),
    );
  }
  await Promise.all(writes);
  return state;
}

export async function getWeatherState(): Promise<WeatherState | null> {
  const snapshot = await getFirestore().doc(WEATHER_DOCUMENT).get();
  return snapshot.exists ? (snapshot.data() as WeatherState) : null;
}
