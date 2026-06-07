import { weatherCodeLabelFr } from "../../domain/weather-codes.js";
import type { WeatherState } from "../../domain/weather-state.js";
import { fetchJson } from "../http.js";

export interface OpenMeteoCurrentDto {
  time?: string;
  temperature_2m?: number | null;
  apparent_temperature?: number | null;
  relative_humidity_2m?: number | null;
  weather_code?: number | null;
  is_day?: number | null;
  wind_speed_10m?: number | null;
  wind_direction_10m?: number | null;
  precipitation?: number | null;
}

export interface OpenMeteoHourlyDto {
  time?: Array<string | null>;
  temperature_2m?: Array<number | null>;
  weather_code?: Array<number | null>;
  is_day?: Array<number | null>;
  precipitation_probability?: Array<number | null>;
}

export interface OpenMeteoDailyDto {
  time?: Array<string | null>;
  weather_code?: Array<number | null>;
  temperature_2m_min?: Array<number | null>;
  temperature_2m_max?: Array<number | null>;
  precipitation_probability_max?: Array<number | null>;
  sunrise?: Array<string | null>;
  sunset?: Array<string | null>;
}

export interface OpenMeteoForecastDto {
  latitude?: number;
  longitude?: number;
  timezone?: string;
  utc_offset_seconds?: number;
  current?: OpenMeteoCurrentDto;
  hourly?: OpenMeteoHourlyDto;
  daily?: OpenMeteoDailyDto;
}

const asNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const asString = (value: unknown): string | null =>
  typeof value === "string" ? value : null;

const arrayValue = (value: unknown, index: number): unknown =>
  Array.isArray(value) ? value[index] : undefined;

export function buildOpenMeteoUrl(latitude: number, longitude: number): URL {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(latitude));
  url.searchParams.set("longitude", String(longitude));
  url.searchParams.set(
    "current",
    "temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,is_day,wind_speed_10m,wind_direction_10m,precipitation",
  );
  url.searchParams.set(
    "hourly",
    "temperature_2m,weather_code,is_day,precipitation_probability",
  );
  url.searchParams.set(
    "daily",
    "weather_code,temperature_2m_min,temperature_2m_max,precipitation_probability_max,sunrise,sunset",
  );
  url.searchParams.set("forecast_days", "7");
  url.searchParams.set("timezone", "America/Toronto");
  return url;
}

export function mapOpenMeteo(
  data: unknown,
): Pick<WeatherState, "current" | "hourly" | "daily"> {
  const response = data as OpenMeteoForecastDto;
  const current = response.current ?? {};
  const hourly = response.hourly ?? {};
  const daily = response.daily ?? {};
  const hourlyTimes = Array.isArray(hourly.time) ? hourly.time : [];
  const dates = Array.isArray(daily.time) ? daily.time : [];
  const currentCode = asNumber(current.weather_code);
  const currentTime = asString(current.time);
  const firstHourlyIndex = Math.max(
    0,
    currentTime === null
      ? 0
      : hourlyTimes.findIndex(
          (time) => typeof time === "string" && time >= currentTime,
        ),
  );

  return {
    current: {
      source: "open-meteo",
      temperatureC: asNumber(current.temperature_2m),
      apparentTemperatureC: asNumber(current.apparent_temperature),
      humidityPct: asNumber(current.relative_humidity_2m),
      weatherCode: currentCode,
      isDay:
        current.is_day === 1 ? true : current.is_day === 0 ? false : null,
      conditionLabelFr: weatherCodeLabelFr(currentCode),
      windSpeedKmh: asNumber(current.wind_speed_10m),
      windDirectionDeg: asNumber(current.wind_direction_10m),
      precipitationMm: asNumber(current.precipitation),
    },
    hourly: hourlyTimes
      .slice(firstHourlyIndex, firstHourlyIndex + 24)
      .map((time, offset) => {
        const index = firstHourlyIndex + offset;
        const isDay = arrayValue(hourly.is_day, index);
        return {
          time: asString(time) ?? "",
          temperatureC: asNumber(arrayValue(hourly.temperature_2m, index)),
          weatherCode: asNumber(arrayValue(hourly.weather_code, index)),
          isDay: isDay === 1 ? true : isDay === 0 ? false : null,
          precipitationProbabilityPct: asNumber(
            arrayValue(hourly.precipitation_probability, index),
          ),
        };
      }),
    daily: dates.slice(0, 7).map((date, index) => {
      const code = asNumber(arrayValue(daily.weather_code, index));
      return {
        date: asString(date) ?? "",
        weatherCode: code,
        conditionLabelFr: weatherCodeLabelFr(code),
        temperatureMinC: asNumber(arrayValue(daily.temperature_2m_min, index)),
        temperatureMaxC: asNumber(arrayValue(daily.temperature_2m_max, index)),
        precipitationProbabilityMaxPct: asNumber(
          arrayValue(daily.precipitation_probability_max, index),
        ),
        sunriseAt: asString(arrayValue(daily.sunrise, index)),
        sunsetAt: asString(arrayValue(daily.sunset, index)),
      };
    }),
  };
}

export async function fetchOpenMeteo(
  latitude: number,
  longitude: number,
): Promise<Pick<WeatherState, "current" | "hourly" | "daily">> {
  return mapOpenMeteo(await fetchJson(buildOpenMeteoUrl(latitude, longitude)));
}
