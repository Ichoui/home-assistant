import sharp from "sharp";
import { TIME_ZONE } from "../../config.js";
import { weatherCodeIcon } from "../../domain/weather-codes.js";
import type { WeatherState } from "../../domain/weather-state.js";
import { renderIcon } from "./icons.js";

type HourlyPoint = WeatherState["hourly"][number];

type Palette = {
  backgroundTop: string;
  backgroundBottom: string;
  accent: string;
  accentSoft: string;
  glow: string;
};

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

const hourLabel = (time: string): string => {
  const match = time.match(/T(\d{2}):/);
  return match ? `${Number(match[1])}h` : "--";
};

export function windDirectionLabel(degrees: number | null): string {
  if (degrees === null) return "--";
  const directions = ["N", "NE", "E", "SE", "S", "SO", "O", "NO"];
  return directions[Math.round((((degrees % 360) + 360) % 360) / 45) % 8];
}

function windArrowRotation(degrees: number | null): number {
  return degrees === null ? 0 : ((degrees % 360) + 360) % 360;
}

function paletteFor(code: number | null, isDay: boolean | null): Palette {
  if (isDay === false) {
    return {
      backgroundTop: "#07101f",
      backgroundBottom: "#152743",
      accent: "#9cc7ff",
      accentSoft: "#5279b4",
      glow: "#234c88",
    };
  }
  if ([95, 96, 99].includes(code ?? -1)) {
    return {
      backgroundTop: "#17162e",
      backgroundBottom: "#3c315b",
      accent: "#d9c1ff",
      accentSoft: "#8b6dc1",
      glow: "#7252ac",
    };
  }
  if ([71, 73, 75, 77, 85, 86].includes(code ?? -1)) {
    return {
      backgroundTop: "#102432",
      backgroundBottom: "#3c6574",
      accent: "#e4f7ff",
      accentSoft: "#91c9d8",
      glow: "#77c4dc",
    };
  }
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code ?? -1)) {
    return {
      backgroundTop: "#071827",
      backgroundBottom: "#194c68",
      accent: "#78d6ff",
      accentSoft: "#2c8fba",
      glow: "#1b779f",
    };
  }
  if ([3, 45, 48].includes(code ?? -1)) {
    return {
      backgroundTop: "#101a28",
      backgroundBottom: "#35485d",
      accent: "#c8dded",
      accentSoft: "#708da4",
      glow: "#5c7f99",
    };
  }
  return {
    backgroundTop: "#09223a",
    backgroundBottom: "#176b8c",
    accent: "#ffd768",
    accentSoft: "#69c7e8",
    glow: "#49b8e2",
  };
}

function sampleHourly(points: HourlyPoint[]): HourlyPoint[] {
  if (points.length <= 6) return points;
  const lastIndex = points.length - 1;
  return [0, 5, 10, 15, 20, lastIndex].map((index) => points[index]);
}

function curveGeometry(points: HourlyPoint[]): {
  linePath: string;
  areaPath: string;
  coordinates: Array<{ x: number; y: number; point: HourlyPoint }>;
  minIndex: number;
  maxIndex: number;
} {
  const usable = points.filter((point) => point.temperatureC !== null);
  if (usable.length === 0) {
    return {
      linePath: "M14 132 L226 132",
      areaPath: "M14 132 L226 132 L226 151 L14 151 Z",
      coordinates: [],
      minIndex: -1,
      maxIndex: -1,
    };
  }

  const temperatures = usable.map((point) => point.temperatureC as number);
  const minimum = Math.min(...temperatures);
  const maximum = Math.max(...temperatures);
  const range = Math.max(4, maximum - minimum);
  const coordinates = usable.map((point, index) => ({
    x: 14 + (212 * index) / Math.max(1, usable.length - 1),
    y: 145 - (((point.temperatureC as number) - minimum) / range) * 28,
    point,
  }));

  const linePath = coordinates.reduce((path, coordinate, index) => {
    if (index === 0) return `M${coordinate.x.toFixed(1)} ${coordinate.y.toFixed(1)}`;
    const previous = coordinates[index - 1];
    const middleX = (previous.x + coordinate.x) / 2;
    return `${path} Q${middleX.toFixed(1)} ${previous.y.toFixed(1)} ${coordinate.x.toFixed(1)} ${coordinate.y.toFixed(1)}`;
  }, "");
  const areaPath = `${linePath} L226 151 L14 151 Z`;
  const minIndex = temperatures.indexOf(minimum);
  const maxIndex = temperatures.indexOf(maximum);

  return { linePath, areaPath, coordinates, minIndex, maxIndex };
}

function extremaLabels(
  geometry: ReturnType<typeof curveGeometry>,
): string {
  return geometry.coordinates
    .map((coordinate, index) => {
      if (index !== geometry.minIndex && index !== geometry.maxIndex) return "";
      const isMaximum = index === geometry.maxIndex;
      const x = Math.min(221, Math.max(19, coordinate.x));
      const y = isMaximum ? coordinate.y - 5 : coordinate.y + 10;
      return `<text x="${x}" y="${y}" text-anchor="middle" fill="#ffffff" font-family="Arial, sans-serif" font-size="7" font-weight="700">${isMaximum ? "↑" : "↓"}${displayNumber(coordinate.point.temperatureC)}°</text>`;
    })
    .join("");
}

function hourlyMarkers(points: HourlyPoint[], palette: Palette): string {
  const sampled = sampleHourly(points);
  return sampled
    .map((point, index) => {
      const x = 15 + (210 * index) / Math.max(1, sampled.length - 1);
      const precipitation = point.precipitationProbabilityPct ?? 0;
      return `${renderIcon(
        weatherCodeIcon(point.weatherCode, point.isDay),
        x - 7,
        98,
        14,
        index === 0 ? "#ffffff" : palette.accent,
      )}
        <text x="${x}" y="96" text-anchor="middle" fill="#dce8f2" font-family="Arial, sans-serif" font-size="6.5">${hourLabel(point.time)}</text>
        ${precipitation >= 30 ? `<text x="${x}" y="158" text-anchor="middle" fill="#8ddcff" font-family="Arial, sans-serif" font-size="6">${Math.round(precipitation)}%</text>` : ""}`;
    })
    .join("");
}

function sensorCard(
  x: number,
  label: "INT" | "EXT",
  temperatureC: number | null,
  humidityPct: number | null,
  accent: string,
): string {
  return `<rect x="${x}" y="166" width="103" height="34" rx="10" fill="url(#glass)" stroke="rgba(255,255,255,0.16)" stroke-width="0.7"/>
    ${renderIcon(label === "INT" ? "metric-indoor" : "metric-temperature", x + 7, 174, 17, accent)}
    <text x="${x + 28}" y="176" fill="#b8cad8" font-family="Arial, sans-serif" font-size="7" font-weight="700">${label}</text>
    ${renderIcon("metric-temperature", x + 28, 181, 11, "#dce8f2")}
    <text x="${x + 41}" y="191" fill="#ffffff" font-family="Arial, sans-serif" font-size="10" font-weight="700">${displayNumber(temperatureC)}°</text>
    ${renderIcon("metric-humidity", x + 64, 181, 11, "#dce8f2")}
    <text x="${x + 77}" y="191" fill="#ffffff" font-family="Arial, sans-serif" font-size="9" font-weight="700">${displayNumber(humidityPct)}%</text>`;
}

export function buildSmallTvSvg(state: WeatherState): string {
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
  const palette = paletteFor(state.current.weatherCode, state.current.isDay);
  const hourly = state.hourly ?? [];
  const geometry = curveGeometry(hourly);

  return `<svg width="240" height="240" viewBox="0 0 240 240" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="background" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${palette.backgroundTop}"/>
        <stop offset="1" stop-color="${palette.backgroundBottom}"/>
      </linearGradient>
      <linearGradient id="wave" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${palette.accent}" stop-opacity="0.42"/>
        <stop offset="1" stop-color="${palette.accentSoft}" stop-opacity="0.04"/>
      </linearGradient>
      <linearGradient id="glass" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#ffffff" stop-opacity="0.16"/>
        <stop offset="1" stop-color="#ffffff" stop-opacity="0.06"/>
      </linearGradient>
      <radialGradient id="glow">
        <stop offset="0" stop-color="${palette.glow}" stop-opacity="0.55"/>
        <stop offset="1" stop-color="${palette.glow}" stop-opacity="0"/>
      </radialGradient>
    </defs>

    <rect width="240" height="240" rx="18" fill="url(#background)"/>
    <circle cx="204" cy="22" r="78" fill="url(#glow)"/>
    <circle cx="20" cy="172" r="65" fill="url(#glow)" opacity="0.45"/>

    <text x="11" y="17" fill="#ffffff" font-family="Arial, sans-serif" font-size="10" font-weight="700">${escapeXml(state.location.name)}</text>
    <text x="229" y="17" text-anchor="end" fill="#d0dfeb" font-family="Arial, sans-serif" font-size="8">${time}</text>

    <rect x="10" y="25" width="220" height="64" rx="14" fill="url(#glass)" stroke="rgba(255,255,255,0.19)" stroke-width="0.8"/>
    ${renderIcon(weatherIcon, 18, 32, 45, palette.accent)}
    <text x="69" y="61" fill="#ffffff" font-family="Arial, sans-serif" font-size="30" font-weight="700">${displayNumber(state.current.temperatureC)}°</text>
    <text x="70" y="75" fill="${palette.accent}" font-family="Arial, sans-serif" font-size="9" font-weight="700">${escapeXml(condition.slice(0, 23))}</text>
    <text x="70" y="84" fill="#c3d4e1" font-family="Arial, sans-serif" font-size="7">Ressenti ${displayNumber(state.current.apparentTemperatureC)}°</text>

    ${renderIcon("metric-humidity", 151, 36, 15, palette.accent)}
    <text x="171" y="48" fill="#ffffff" font-family="Arial, sans-serif" font-size="10" font-weight="700">${displayNumber(state.current.humidityPct)}%</text>
    ${renderIcon("metric-wind", 151, 61, 15, palette.accent)}
    <text x="171" y="72" fill="#ffffff" font-family="Arial, sans-serif" font-size="9" font-weight="700">${displayNumber(state.current.windSpeedKmh)}</text>
    <text x="188" y="72" fill="#c3d4e1" font-family="Arial, sans-serif" font-size="6">km/h</text>
    <g transform="translate(216 67) rotate(${windArrowRotation(state.current.windDirectionDeg)})">
      <path d="M0 7 L0 -7 M0 -7 L-3.5 -2 M0 -7 L3.5 -2" stroke="${palette.accent}" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    </g>
    <text x="216" y="82" text-anchor="middle" fill="#ffffff" font-family="Arial, sans-serif" font-size="7" font-weight="700">${windDirection}</text>

    <rect x="10" y="93" width="220" height="68" rx="13" fill="url(#glass)" stroke="rgba(255,255,255,0.15)" stroke-width="0.7"/>
    ${hourlyMarkers(hourly, palette)}
    <path d="${geometry.areaPath}" fill="url(#wave)"/>
    <path d="${geometry.linePath}" fill="none" stroke="${palette.accent}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
    ${geometry.coordinates[0] ? `<circle cx="${geometry.coordinates[0].x}" cy="${geometry.coordinates[0].y}" r="3" fill="#ffffff" stroke="${palette.accent}" stroke-width="1.5"/>` : ""}
    ${extremaLabels(geometry)}

    ${sensorCard(10, "INT", state.indoor?.temperatureC ?? null, state.indoor?.humidityPct ?? null, palette.accent)}
    ${sensorCard(127, "EXT", state.outdoor?.temperatureC ?? null, state.outdoor?.humidityPct ?? null, palette.accent)}

    <rect x="10" y="207" width="220" height="23" rx="9" fill="${hasAlert ? "#a92835" : "rgba(7,16,31,0.28)"}" stroke="rgba(255,255,255,0.12)" stroke-width="0.6"/>
    <text x="120" y="222" text-anchor="middle" fill="${hasAlert ? "#ffffff" : "#b7c8d5"}" font-family="Arial, sans-serif" font-size="${hasAlert ? 8 : 7}" font-weight="${hasAlert ? 700 : 400}">${escapeXml(alertText.slice(0, 42))}</text>
  </svg>`;
}

export async function renderSmallTvPng(state: WeatherState): Promise<Buffer> {
  return sharp(Buffer.from(buildSmallTvSvg(state))).png().toBuffer();
}
