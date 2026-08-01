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
  native_temperature: number | null;
  native_temperature_unit: "°C";
  native_apparent_temperature: number | null;
  humidity: number | null;
  native_precipitation: number | null;
  native_precipitation_unit: "mm";
  native_wind_speed: number | null;
  native_wind_speed_unit: "km/h";
  wind_bearing: number | null;
};

type HomeAssistantForecast = {
  datetime: string;
  condition: HomeAssistantCondition;
  native_temperature: number | null;
  native_templow?: number | null;
  precipitation_probability: number | null;
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
      native_temperature: state.current.temperatureC,
      native_temperature_unit: "°C",
      native_apparent_temperature: state.current.apparentTemperatureC,
      humidity: state.current.humidityPct,
      native_precipitation: state.current.precipitationMm,
      native_precipitation_unit: "mm",
      native_wind_speed: state.current.windSpeedKmh,
      native_wind_speed_unit: "km/h",
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
                condition: conditionFromWeatherCode(hour.weatherCode, hour.isDay),
                native_temperature: hour.temperatureC,
                precipitation_probability: hour.precipitationProbabilityPct,
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
                condition: conditionFromWeatherCode(day.weatherCode, true),
                native_temperature: day.temperatureMaxC,
                native_templow: day.temperatureMinC,
                precipitation_probability: day.precipitationProbabilityMaxPct,
              },
            ];
      }),
    },
  };
}
