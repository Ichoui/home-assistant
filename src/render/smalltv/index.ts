import sharp from "sharp";
import { TIME_ZONE } from "../../config.js";
import { weatherCodeIcon } from "../../domain/weather-codes.js";
import type { WeatherState } from "../../domain/weather-state.js";
import { renderIcon } from "./icons.js";

const escapeXml = (value: string): string =>
  value.replace(/[<>&"']/g, (character) => {
    const entities: Record<string, string> = {
      "<": "&lt;",
      ">": "&gt;",
      "&": "&amp;",
      '"': "&quot;",
      "'": "&apos;",
    };
    return entities[character];
  });

const displayNumber = (value: number | null): string =>
  value === null ? "--" : String(Math.round(value));

export function windDirectionLabel(degrees: number | null): string {
  if (degrees === null) return "--";
  const directions = ["N", "NE", "E", "SE", "S", "SO", "O", "NO"];
  return directions[Math.round((((degrees % 360) + 360) % 360) / 45) % 8];
}

function windArrowRotation(degrees: number | null): number {
  return degrees === null ? 0 : ((degrees % 360) + 360) % 360;
}

function sensorCard(
  x: number,
  label: "INT" | "EXT",
  temperatureC: number | null,
  humidityPct: number | null,
): string {
  return `<rect x="${x}" y="157" width="103" height="40" rx="8" fill="#13263b"/>
    ${renderIcon(label === "INT" ? "metric-indoor" : "metric-temperature", x + 7, 164, 18, "#7dd3fc")}
    <text x="${x + 29}" y="170" fill="#94a3b8" font-family="Arial, sans-serif" font-size="8" font-weight="700">${label}</text>
    ${renderIcon("metric-temperature", x + 28, 176, 13, "#cbd5e1")}
    <text x="${x + 43}" y="187" fill="#f8fafc" font-family="Arial, sans-serif" font-size="12" font-weight="700">${displayNumber(temperatureC)}°</text>
    ${renderIcon("metric-humidity", x + 65, 176, 13, "#cbd5e1")}
    <text x="${x + 80}" y="187" fill="#f8fafc" font-family="Arial, sans-serif" font-size="11" font-weight="700">${displayNumber(humidityPct)}%</text>`;
}

export function buildSmallTvSvg(state: WeatherState): string {
  const today = state.daily[0];
  const time = new Intl.DateTimeFormat("fr-CA", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(state.updatedAt));
  const alertText = state.alerts[0]?.title ?? "Aucun avis météo";
  const hasAlert = state.alerts.length > 0;
  const condition = state.current.conditionLabelFr ?? "Conditions indisponibles";
  const windDirection = windDirectionLabel(state.current.windDirectionDeg);
  const weatherIcon = weatherCodeIcon(state.current.weatherCode, state.current.isDay);
  const indoorTemperature = state.indoor?.temperatureC ?? null;
  const indoorHumidity = state.indoor?.humidityPct ?? null;
  const outdoorTemperature = state.outdoor?.temperatureC ?? null;
  const outdoorHumidity = state.outdoor?.humidityPct ?? null;

  return `<svg width="240" height="240" viewBox="0 0 240 240" xmlns="http://www.w3.org/2000/svg">
    <rect width="240" height="240" rx="18" fill="#0b1727"/>

    <text x="12" y="18" fill="#f8fafc" font-family="Arial, sans-serif" font-size="11" font-weight="700">${escapeXml(state.location.name)}</text>
    <text x="228" y="18" text-anchor="end" fill="#94a3b8" font-family="Arial, sans-serif" font-size="9">${time}</text>

    ${renderIcon(weatherIcon, 12, 29, 58, "#7dd3fc")}
    <text x="79" y="65" fill="#ffffff" font-family="Arial, sans-serif" font-size="36" font-weight="700">${displayNumber(state.current.temperatureC)}°</text>
    <text x="79" y="82" fill="#7dd3fc" font-family="Arial, sans-serif" font-size="11" font-weight="700">${escapeXml(condition.slice(0, 24))}</text>
    <text x="79" y="97" fill="#94a3b8" font-family="Arial, sans-serif" font-size="9">Ressenti ${displayNumber(state.current.apparentTemperatureC)}°</text>

    <line x1="12" y1="106" x2="228" y2="106" stroke="#24364d"/>
    ${renderIcon("metric-humidity", 13, 114, 18, "#7dd3fc")}
    <text x="35" y="128" fill="#e2e8f0" font-family="Arial, sans-serif" font-size="12" font-weight="700">${displayNumber(state.current.humidityPct)}%</text>
    ${renderIcon("metric-wind", 82, 114, 18, "#7dd3fc")}
    <text x="104" y="128" fill="#e2e8f0" font-family="Arial, sans-serif" font-size="11" font-weight="700">${displayNumber(state.current.windSpeedKmh)} km/h</text>
    <g transform="translate(184 121) rotate(${windArrowRotation(state.current.windDirectionDeg)})">
      <path d="M0 8 L0 -8 M0 -8 L-4 -3 M0 -8 L4 -3" stroke="#7dd3fc" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    </g>
    <text x="228" y="128" text-anchor="end" fill="#e2e8f0" font-family="Arial, sans-serif" font-size="11" font-weight="700">${windDirection}</text>
    <text x="12" y="148" fill="#94a3b8" font-family="Arial, sans-serif" font-size="10">↓ ${displayNumber(today?.temperatureMinC ?? null)}°</text>
    <text x="68" y="148" fill="#94a3b8" font-family="Arial, sans-serif" font-size="10">↑ ${displayNumber(today?.temperatureMaxC ?? null)}°</text>
    <text x="228" y="148" text-anchor="end" fill="#94a3b8" font-family="Arial, sans-serif" font-size="9">Vent provenant du ${windDirection}</text>

    ${sensorCard(12, "INT", indoorTemperature, indoorHumidity)}
    ${sensorCard(125, "EXT", outdoorTemperature, outdoorHumidity)}

    <rect x="0" y="207" width="240" height="33" fill="${hasAlert ? "#b91c1c" : "#12304a"}"/>
    <text x="120" y="228" text-anchor="middle" fill="#ffffff" font-family="Arial, sans-serif" font-size="11" font-weight="700">${escapeXml(alertText.slice(0, 36))}</text>
  </svg>`;
}

export async function renderSmallTvPng(state: WeatherState): Promise<Buffer> {
  return sharp(Buffer.from(buildSmallTvSvg(state))).png().toBuffer();
}
