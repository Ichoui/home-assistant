import { TIME_ZONE } from "../config.js";
import type { WeatherState } from "../domain/weather-state.js";

type HomeAssistantCondition =
  | "clear-night"
  | "cloudy"
  | "exceptional"
  | "fog"
  | "hail"
  | "lightning"
  | "lightning-rainy"
  | "partlycloudy"
  | "pouring"
  | "rainy"
  | "snowy"
  | "snowy-rainy"
  | "sunny"
  | "windy"
  | "windy-variant";

type HomeAssistantCurrentWeather = {
  condition: HomeAssistantCondition;
  cloud_coverage: number | null;
  native_temperature: number | null;
  native_temperature_unit: "°C";
  native_apparent_temperature: number | null;
  native_dew_point: number | null;
  humidity: number | null;
  native_precipitation: number | null;
  native_precipitation_unit: "mm";
  native_pressure: number | null;
  native_pressure_unit: "hPa";
  native_visibility: number | null;
  native_visibility_unit: "km";
  native_wind_speed: number | null;
  native_wind_gust_speed: number | null;
  native_wind_speed_unit: "km/h";
  uv_index: number | null;
  wind_bearing: number | null;
};

type HomeAssistantForecast = {
  datetime: string;
  is_daytime?: boolean | null;
  cloud_coverage?: number | null;
  condition: HomeAssistantCondition;
  humidity?: number | null;
  native_apparent_temperature?: number | null;
  native_dew_point?: number | null;
  native_precipitation?: number | null;
  native_pressure?: number | null;
  native_temperature: number | null;
  native_templow?: number | null;
  native_wind_speed?: number | null;
  native_wind_gust_speed?: number | null;
  precipitation_probability: number | null;
  uv_index?: number | null;
  wind_bearing?: number | null;
};

type SupplementalWeatherData = {
  forecast_model: WeatherState["forecastModel"];
  source_updated_at: string;
  location: WeatherState["location"];
  current: {
    source: WeatherState["current"]["source"];
    weather_code: number | null;
    condition_label_fr: string | null;
    is_day: boolean | null;
    surface_pressure_hpa: number | null;
    visibility_m: number | null;
    precipitation_mm: number | null;
  };
  hourly: Array<{
    time: string;
    weather_code: number | null;
    is_day: boolean | null;
    surface_pressure_hpa: number | null;
    visibility_m: number | null;
  }>;
  daily: Array<{
    date: string;
    weather_code: number | null;
    condition_label_fr: string | null;
    sunrise_at: string | null;
    sunset_at: string | null;
    visibility_mean_m: number | null;
    surface_pressure_mean_hpa: number | null;
    daylight_duration_sec: number | null;
    sunshine_duration_sec: number | null;
  }>;
  alerts: WeatherState["alerts"];
  sensors: {
    indoor?: WeatherState["indoor"];
    outdoor?: WeatherState["outdoor"];
  };
};

export type HomeAssistantWeatherState = {
  location: WeatherState["location"];
  updated_at: string;
  attribution: string;
  current: HomeAssistantCurrentWeather;
  forecast: {
    hourly: HomeAssistantForecast[];
    daily: HomeAssistantForecast[];
  };
  supplemental: SupplementalWeatherData;
};

const formatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function conditionFromWeatherCode(
  code: number | null,
  isDay: boolean | null,
): HomeAssistantCondition {
  if (code === 0) return isDay === false ? "clear-night" : "sunny";
  if (code === 1 || code === 2) return "partlycloudy";
  if (code === 3) return "cloudy";
  if (code === 45 || code === 48) return "fog";
  if ([56, 57, 66, 67].includes(code ?? -1)) return "snowy-rainy";
  if ([51, 53, 55, 61, 63].includes(code ?? -1)) return "rainy";
  if ([65, 80, 81, 82].includes(code ?? -1)) return "pouring";
  if ([71, 73, 75, 77, 85, 86].includes(code ?? -1)) return "snowy";
  if (code === 95) return "lightning-rainy";
  if (code === 96 || code === 99) return "hail";
  return "exceptional";
}

function formatInTimeZone(date: Date): Record<string, number> {
  const parts = formatter.formatToParts(date);
  return Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );
}

function timeZoneOffsetMs(date: Date): number {
  const parts = formatInTimeZone(date);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return asUtc - date.getTime();
}

function zonedTimeToUtcIso(value: string): string | null {
  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/,
  );
  if (!match) return null;

  const [, yearValue, monthValue, dayValue, hourValue = "00", minuteValue = "00"] =
    match;
  const year = Number(yearValue);
  const month = Number(monthValue);
  const day = Number(dayValue);
  const hour = Number(hourValue);
  const minute = Number(minuteValue);
  let utc = Date.UTC(year, month - 1, day, hour, minute, 0);

  for (let index = 0; index < 2; index += 1) {
    utc =
      Date.UTC(year, month - 1, day, hour, minute, 0) -
      timeZoneOffsetMs(new Date(utc));
  }

  return new Date(utc).toISOString();
}

function forecastWithDatetime<T extends { time?: string; date?: string }>(
  item: T,
): string | null {
  return zonedTimeToUtcIso(item.time ?? item.date ?? "");
}

function metersToKilometers(value: number | null): number | null {
  return value === null ? null : value / 1000;
}

function nullable<T>(value: T | null | undefined): T | null {
  return value ?? null;
}

export function mapWeatherStateForHomeAssistant(
  state: WeatherState,
): HomeAssistantWeatherState {
  return {
    location: state.location,
    updated_at: state.updatedAt,
    attribution: "Weather data from Open-Meteo and alerts from Environment and Climate Change Canada.",
    current: {
      condition: conditionFromWeatherCode(
        state.current.weatherCode,
        state.current.isDay,
      ),
      cloud_coverage: nullable(state.current.cloudCoveragePct),
      native_temperature: state.current.temperatureC,
      native_temperature_unit: "°C",
      native_apparent_temperature: state.current.apparentTemperatureC,
      native_dew_point: nullable(state.current.dewPointC),
      humidity: state.current.humidityPct,
      native_precipitation: state.current.precipitationMm,
      native_precipitation_unit: "mm",
      native_pressure: nullable(state.current.pressureHpa),
      native_pressure_unit: "hPa",
      native_visibility: metersToKilometers(nullable(state.current.visibilityM)),
      native_visibility_unit: "km",
      native_wind_speed: state.current.windSpeedKmh,
      native_wind_gust_speed: nullable(state.current.windGustKmh),
      native_wind_speed_unit: "km/h",
      uv_index: nullable(state.current.uvIndex),
      wind_bearing: state.current.windDirectionDeg,
    },
    forecast: {
      hourly: state.hourly.flatMap((hour) => {
        const datetime = forecastWithDatetime(hour);
        return datetime === null
          ? []
          : [
              {
                datetime,
                is_daytime: hour.isDay,
                cloud_coverage: nullable(hour.cloudCoveragePct),
                condition: conditionFromWeatherCode(hour.weatherCode, hour.isDay),
                humidity: nullable(hour.humidityPct),
                native_apparent_temperature: nullable(hour.apparentTemperatureC),
                native_dew_point: nullable(hour.dewPointC),
                native_precipitation: nullable(hour.precipitationMm),
                native_pressure: nullable(hour.pressureHpa),
                native_temperature: hour.temperatureC,
                native_wind_speed: nullable(hour.windSpeedKmh),
                native_wind_gust_speed: nullable(hour.windGustKmh),
                precipitation_probability: hour.precipitationProbabilityPct,
                uv_index: nullable(hour.uvIndex),
                wind_bearing: nullable(hour.windDirectionDeg),
              },
            ];
      }),
      daily: state.daily.flatMap((day) => {
        const datetime = forecastWithDatetime(day);
        return datetime === null
          ? []
          : [
              {
                datetime,
                cloud_coverage: nullable(day.cloudCoverageMeanPct),
                condition: conditionFromWeatherCode(day.weatherCode, true),
                humidity: nullable(day.humidityMeanPct),
                native_apparent_temperature: nullable(
                  day.apparentTemperatureMaxC,
                ),
                native_dew_point: nullable(day.dewPointMeanC),
                native_precipitation: nullable(day.precipitationSumMm),
                native_pressure: nullable(day.pressureMeanHpa),
                native_temperature: day.temperatureMaxC,
                native_templow: day.temperatureMinC,
                native_wind_speed: nullable(day.windSpeedMaxKmh),
                native_wind_gust_speed: nullable(day.windGustMaxKmh),
                precipitation_probability: day.precipitationProbabilityMaxPct,
                uv_index: nullable(day.uvIndexMax),
                wind_bearing: nullable(day.windDirectionDominantDeg),
              },
            ];
      }),
    },
    supplemental: {
      forecast_model: state.forecastModel,
      source_updated_at: state.updatedAt,
      location: state.location,
      current: {
        source: state.current.source,
        weather_code: state.current.weatherCode,
        condition_label_fr: state.current.conditionLabelFr,
        is_day: state.current.isDay,
        surface_pressure_hpa: nullable(state.current.surfacePressureHpa),
        visibility_m: nullable(state.current.visibilityM),
        precipitation_mm: state.current.precipitationMm,
      },
      hourly: state.hourly.map((hour) => ({
        time: hour.time,
        weather_code: hour.weatherCode,
        is_day: hour.isDay,
        surface_pressure_hpa: nullable(hour.surfacePressureHpa),
        visibility_m: nullable(hour.visibilityM),
      })),
      daily: state.daily.map((day) => ({
        date: day.date,
        weather_code: day.weatherCode,
        condition_label_fr: day.conditionLabelFr,
        sunrise_at: day.sunriseAt,
        sunset_at: day.sunsetAt,
        visibility_mean_m: nullable(day.visibilityMeanM),
        surface_pressure_mean_hpa: nullable(day.surfacePressureMeanHpa),
        daylight_duration_sec: nullable(day.daylightDurationSec),
        sunshine_duration_sec: nullable(day.sunshineDurationSec),
      })),
      alerts: state.alerts,
      sensors: {
        indoor: state.indoor,
        outdoor: state.outdoor,
      },
    },
  };
}
