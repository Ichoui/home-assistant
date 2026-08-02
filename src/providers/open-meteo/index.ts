import { weatherCodeLabelFr } from "../../domain/weather-codes.js";
import type {
  OpenMeteoModel,
  WeatherForecast,
} from "../../domain/weather-state.js";
import { fetchJson } from "../http.js";

export interface OpenMeteoCurrentDto {
  time?: string;
  temperature_2m?: number | null;
  apparent_temperature?: number | null;
  relative_humidity_2m?: number | null;
  dew_point_2m?: number | null;
  weather_code?: number | null;
  is_day?: number | null;
  pressure_msl?: number | null;
  surface_pressure?: number | null;
  cloud_cover?: number | null;
  visibility?: number | null;
  wind_speed_10m?: number | null;
  wind_direction_10m?: number | null;
  wind_gusts_10m?: number | null;
  precipitation?: number | null;
  uv_index?: number | null;
}

export interface OpenMeteoHourlyDto {
  time?: Array<string | null>;
  temperature_2m?: Array<number | null>;
  apparent_temperature?: Array<number | null>;
  relative_humidity_2m?: Array<number | null>;
  dew_point_2m?: Array<number | null>;
  weather_code?: Array<number | null>;
  is_day?: Array<number | null>;
  pressure_msl?: Array<number | null>;
  surface_pressure?: Array<number | null>;
  cloud_cover?: Array<number | null>;
  visibility?: Array<number | null>;
  wind_speed_10m?: Array<number | null>;
  wind_direction_10m?: Array<number | null>;
  wind_gusts_10m?: Array<number | null>;
  precipitation?: Array<number | null>;
  precipitation_probability?: Array<number | null>;
  uv_index?: Array<number | null>;
}

export interface OpenMeteoDailyDto {
  time?: Array<string | null>;
  weather_code?: Array<number | null>;
  temperature_2m_min?: Array<number | null>;
  temperature_2m_max?: Array<number | null>;
  apparent_temperature_min?: Array<number | null>;
  apparent_temperature_max?: Array<number | null>;
  relative_humidity_2m_mean?: Array<number | null>;
  dew_point_2m_mean?: Array<number | null>;
  pressure_msl_mean?: Array<number | null>;
  surface_pressure_mean?: Array<number | null>;
  cloud_cover_mean?: Array<number | null>;
  visibility_mean?: Array<number | null>;
  precipitation_sum?: Array<number | null>;
  precipitation_probability_max?: Array<number | null>;
  wind_speed_10m_max?: Array<number | null>;
  wind_gusts_10m_max?: Array<number | null>;
  wind_direction_10m_dominant?: Array<number | null>;
  uv_index_max?: Array<number | null>;
  daylight_duration?: Array<number | null>;
  sunshine_duration?: Array<number | null>;
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

export function buildOpenMeteoUrl(
  latitude: number,
  longitude: number,
  model: OpenMeteoModel = "best_match",
): URL {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(latitude));
  url.searchParams.set("longitude", String(longitude));
  url.searchParams.set(
    "current",
    "temperature_2m,apparent_temperature,relative_humidity_2m,dew_point_2m,weather_code,is_day,pressure_msl,surface_pressure,cloud_cover,visibility,wind_speed_10m,wind_direction_10m,wind_gusts_10m,precipitation,uv_index",
  );
  url.searchParams.set(
    "hourly",
    "temperature_2m,apparent_temperature,relative_humidity_2m,dew_point_2m,weather_code,is_day,pressure_msl,surface_pressure,cloud_cover,visibility,wind_speed_10m,wind_direction_10m,wind_gusts_10m,precipitation,precipitation_probability,uv_index",
  );
  url.searchParams.set(
    "daily",
    "weather_code,temperature_2m_min,temperature_2m_max,apparent_temperature_min,apparent_temperature_max,relative_humidity_2m_mean,dew_point_2m_mean,pressure_msl_mean,surface_pressure_mean,cloud_cover_mean,visibility_mean,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant,uv_index_max,daylight_duration,sunshine_duration,sunrise,sunset",
  );
  url.searchParams.set("forecast_days", "7");
  url.searchParams.set("timezone", "America/Toronto");
  url.searchParams.set("models", model);
  return url;
}

export function mapOpenMeteo(
  data: unknown,
  model: OpenMeteoModel = "best_match",
): WeatherForecast {
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
    model,
    current: {
      source: "open-meteo",
      temperatureC: asNumber(current.temperature_2m),
      apparentTemperatureC: asNumber(current.apparent_temperature),
      humidityPct: asNumber(current.relative_humidity_2m),
      dewPointC: asNumber(current.dew_point_2m),
      weatherCode: currentCode,
      isDay:
        current.is_day === 1 ? true : current.is_day === 0 ? false : null,
      conditionLabelFr: weatherCodeLabelFr(currentCode),
      pressureHpa: asNumber(current.pressure_msl),
      surfacePressureHpa: asNumber(current.surface_pressure),
      cloudCoveragePct: asNumber(current.cloud_cover),
      visibilityM: asNumber(current.visibility),
      windSpeedKmh: asNumber(current.wind_speed_10m),
      windDirectionDeg: asNumber(current.wind_direction_10m),
      windGustKmh: asNumber(current.wind_gusts_10m),
      precipitationMm: asNumber(current.precipitation),
      uvIndex: asNumber(current.uv_index),
    },
    hourly: hourlyTimes
      .slice(firstHourlyIndex, firstHourlyIndex + 24)
      .map((time, offset) => {
        const index = firstHourlyIndex + offset;
        const isDay = arrayValue(hourly.is_day, index);
        return {
          time: asString(time) ?? "",
          temperatureC: asNumber(arrayValue(hourly.temperature_2m, index)),
          apparentTemperatureC: asNumber(
            arrayValue(hourly.apparent_temperature, index),
          ),
          humidityPct: asNumber(arrayValue(hourly.relative_humidity_2m, index)),
          dewPointC: asNumber(arrayValue(hourly.dew_point_2m, index)),
          weatherCode: asNumber(arrayValue(hourly.weather_code, index)),
          isDay: isDay === 1 ? true : isDay === 0 ? false : null,
          pressureHpa: asNumber(arrayValue(hourly.pressure_msl, index)),
          surfacePressureHpa: asNumber(
            arrayValue(hourly.surface_pressure, index),
          ),
          cloudCoveragePct: asNumber(arrayValue(hourly.cloud_cover, index)),
          visibilityM: asNumber(arrayValue(hourly.visibility, index)),
          windSpeedKmh: asNumber(arrayValue(hourly.wind_speed_10m, index)),
          windDirectionDeg: asNumber(
            arrayValue(hourly.wind_direction_10m, index),
          ),
          windGustKmh: asNumber(arrayValue(hourly.wind_gusts_10m, index)),
          precipitationMm: asNumber(arrayValue(hourly.precipitation, index)),
          precipitationProbabilityPct: asNumber(
            arrayValue(hourly.precipitation_probability, index),
          ),
          uvIndex: asNumber(arrayValue(hourly.uv_index, index)),
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
        apparentTemperatureMinC: asNumber(
          arrayValue(daily.apparent_temperature_min, index),
        ),
        apparentTemperatureMaxC: asNumber(
          arrayValue(daily.apparent_temperature_max, index),
        ),
        humidityMeanPct: asNumber(
          arrayValue(daily.relative_humidity_2m_mean, index),
        ),
        dewPointMeanC: asNumber(arrayValue(daily.dew_point_2m_mean, index)),
        pressureMeanHpa: asNumber(arrayValue(daily.pressure_msl_mean, index)),
        surfacePressureMeanHpa: asNumber(
          arrayValue(daily.surface_pressure_mean, index),
        ),
        cloudCoverageMeanPct: asNumber(
          arrayValue(daily.cloud_cover_mean, index),
        ),
        visibilityMeanM: asNumber(arrayValue(daily.visibility_mean, index)),
        precipitationSumMm: asNumber(
          arrayValue(daily.precipitation_sum, index),
        ),
        precipitationProbabilityMaxPct: asNumber(
          arrayValue(daily.precipitation_probability_max, index),
        ),
        windSpeedMaxKmh: asNumber(arrayValue(daily.wind_speed_10m_max, index)),
        windGustMaxKmh: asNumber(arrayValue(daily.wind_gusts_10m_max, index)),
        windDirectionDominantDeg: asNumber(
          arrayValue(daily.wind_direction_10m_dominant, index),
        ),
        uvIndexMax: asNumber(arrayValue(daily.uv_index_max, index)),
        daylightDurationSec: asNumber(
          arrayValue(daily.daylight_duration, index),
        ),
        sunshineDurationSec: asNumber(
          arrayValue(daily.sunshine_duration, index),
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
  model: OpenMeteoModel = "best_match",
): Promise<WeatherForecast> {
  return mapOpenMeteo(
    await fetchJson(buildOpenMeteoUrl(latitude, longitude, model)),
    model,
  );
}
