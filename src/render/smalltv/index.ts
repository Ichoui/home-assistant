import sharp from "sharp";
import { TIME_ZONE } from "../../config.js";
import { weatherCodeIcon } from "../../domain/weather-codes.js";
import type { WeatherState } from "../../domain/weather-state.js";
import { renderIcon } from "./icons.js";

type HourlyPoint = WeatherState["hourly"][number];

type Palette = {
  backgroundTop: string;
  backgroundMiddle: string;
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

const solarTimeLabel = (time: string | null | undefined): string => {
  if (!time) return "--:--";
  return time.match(/T(\d{2}:\d{2})/)?.[1] ?? "--:--";
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
      backgroundTop: "#050b18",
      backgroundMiddle: "#0d2240",
      backgroundBottom: "#18365a",
      accent: "#a8ceff",
      accentSoft: "#5279b4",
      glow: "#315f9f",
    };
  }
  if ([95, 96, 99].includes(code ?? -1)) {
    return {
      backgroundTop: "#100d22",
      backgroundMiddle: "#292044",
      backgroundBottom: "#4b3967",
      accent: "#dfc9ff",
      accentSoft: "#8b6dc1",
      glow: "#825fc2",
    };
  }
  if ([71, 73, 75, 77, 85, 86].includes(code ?? -1)) {
    return {
      backgroundTop: "#0b1c28",
      backgroundMiddle: "#285163",
      backgroundBottom: "#72a5b4",
      accent: "#e9faff",
      accentSoft: "#91c9d8",
      glow: "#a7e7f5",
    };
  }
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code ?? -1)) {
    return {
      backgroundTop: "#06131f",
      backgroundMiddle: "#0e3852",
      backgroundBottom: "#23769a",
      accent: "#83dcff",
      accentSoft: "#2c8fba",
      glow: "#37a8d1",
    };
  }
  if ([3, 45, 48].includes(code ?? -1)) {
    return {
      backgroundTop: "#0d1723",
      backgroundMiddle: "#293d50",
      backgroundBottom: "#60788c",
      accent: "#d4e6f2",
      accentSoft: "#7895ab",
      glow: "#8aabc1",
    };
  }
  return {
    backgroundTop: "#10253a",
    backgroundMiddle: "#287692",
    backgroundBottom: "#e1a83f",
    accent: "#ffdd6e",
    accentSoft: "#67c9e9",
    glow: "#ffd45e",
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
      linePath: "M5 146 L235 146",
      areaPath: "M5 146 L235 146 L235 169 L5 169 Z",
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
    x: 5 + (230 * index) / Math.max(1, usable.length - 1),
    y: 158 - (((point.temperatureC as number) - minimum) / range) * 34,
    point,
  }));

  const linePath = coordinates.reduce((path, coordinate, index) => {
    if (index === 0) return `M${coordinate.x.toFixed(1)} ${coordinate.y.toFixed(1)}`;
    const previous = coordinates[index - 1];
    const middleX = (previous.x + coordinate.x) / 2;
    return `${path} Q${middleX.toFixed(1)} ${previous.y.toFixed(1)} ${coordinate.x.toFixed(1)} ${coordinate.y.toFixed(1)}`;
  }, "");

  return {
    linePath,
    areaPath: `${linePath} L235 169 L5 169 Z`,
    coordinates,
    minIndex: temperatures.indexOf(minimum),
    maxIndex: temperatures.indexOf(maximum),
  };
}

function extremaLabels(geometry: ReturnType<typeof curveGeometry>): string {
  return geometry.coordinates
    .map((coordinate, index) => {
      if (index !== geometry.minIndex && index !== geometry.maxIndex) return "";
      const isMaximum = index === geometry.maxIndex;
      const x = Math.min(234, Math.max(8, coordinate.x));
      const y = isMaximum ? coordinate.y - 5 : coordinate.y + 10;
      return `<text x="${x}" y="${y}" text-anchor="middle" fill="#ffffff" font-family="Arial, sans-serif" font-size="7" font-weight="700">${isMaximum ? "↑" : "↓"}${displayNumber(coordinate.point.temperatureC)}°</text>`;
    })
    .join("");
}

function hourlyMarkers(points: HourlyPoint[], palette: Palette): string {
  const sampled = sampleHourly(points);
  return sampled
    .map((point, index) => {
      const x = 8 + (224 * index) / Math.max(1, sampled.length - 1);
      const precipitation = point.precipitationProbabilityPct ?? 0;
      return `<text x="${x}" y="96" text-anchor="middle" fill="#dce8f2" font-family="Arial, sans-serif" font-size="6.5">${hourLabel(point.time)}</text>
        ${renderIcon(
          weatherCodeIcon(point.weatherCode, point.isDay),
          x - 7,
          99,
          14,
        )}
        ${precipitation >= 30 ? `<text x="${x}" y="168" text-anchor="middle" fill="#a9e6ff" font-family="Arial, sans-serif" font-size="6">${Math.round(precipitation)}%</text>` : ""}`;
    })
    .join("");
}

function sensorZone(
  x: number,
  label: "INT" | "EXT",
  temperatureC: number | null,
  humidityPct: number | null,
): string {
  return `${renderIcon(label === "INT" ? "metric-indoor" : "metric-temperature", x, 180, 16)}
    <text x="${x + 20}" y="184" fill="#c8d8e4" font-family="Arial, sans-serif" font-size="7" font-weight="700">${label}</text>
    ${renderIcon("metric-temperature", x + 20, 189, 11)}
    <text x="${x + 34}" y="199" fill="#ffffff" font-family="Arial, sans-serif" font-size="10" font-weight="700">${displayNumber(temperatureC)}°</text>
    ${renderIcon("metric-humidity", x + 59, 189, 11)}
    <text x="${x + 73}" y="199" fill="#ffffff" font-family="Arial, sans-serif" font-size="9" font-weight="700">${displayNumber(humidityPct)}%</text>`;
}

function alertPresentation(alert: WeatherState["alerts"][number] | undefined): {
  background: string;
  text: string;
  label: string;
  published: string | null;
} | null {
  if (!alert) return null;
  const normalizedColor = alert.riskColor?.trim().toLowerCase() ?? "";
  const colors: Record<string, { background: string; text: string; label: string }> = {
    jaune: { background: "#f4c542", text: "#302500", label: "jaune" },
    yellow: { background: "#f4c542", text: "#302500", label: "jaune" },
    orange: { background: "#f08a24", text: "#281300", label: "orange" },
    rouge: { background: "#c93645", text: "#ffffff", label: "rouge" },
    red: { background: "#c93645", text: "#ffffff", label: "rouge" },
  };
  const color = colors[normalizedColor] ?? {
    background: "#ffffff",
    text: "#0b1727",
    label: "",
  };
  const event = alert.event ?? alert.title ?? "Alerte météo";
  const titlePrefix = alert.title?.toLowerCase().startsWith("avertissement")
    ? "Avertissement"
    : "Alerte";
  const label = color.label
    ? `${titlePrefix} ${color.label} · ${event}`
    : `${titlePrefix} · ${event}`;
  let published: string | null = null;
  if (alert.publishedAt) {
    const publicationDate = new Date(alert.publishedAt);
    if (!Number.isNaN(publicationDate.getTime())) {
      published = new Intl.DateTimeFormat("fr-CA", {
        timeZone: TIME_ZONE,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(publicationDate);
    }
  }
  return { ...color, label, published };
}

export function buildSmallTvSvg(state: WeatherState): string {
  const time = new Intl.DateTimeFormat("fr-CA", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(state.updatedAt));
  const alert = alertPresentation(state.alerts[0]);
  const condition = state.current.conditionLabelFr ?? "Conditions indisponibles";
  const windDirection = windDirectionLabel(state.current.windDirectionDeg);
  const weatherIcon = weatherCodeIcon(state.current.weatherCode, state.current.isDay);
  const palette = paletteFor(state.current.weatherCode, state.current.isDay);
  const hourly = state.hourly ?? [];
  const geometry = curveGeometry(hourly);
  const today = state.daily?.[0];
  const sunrise = solarTimeLabel(today?.sunriseAt);
  const sunset = solarTimeLabel(today?.sunsetAt);

  return `<svg width="240" height="240" viewBox="0 0 240 240" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="background" x1="0" y1="0" x2="0.85" y2="1">
        <stop offset="0" stop-color="${palette.backgroundTop}"/>
        <stop offset="0.58" stop-color="${palette.backgroundMiddle}"/>
        <stop offset="1" stop-color="${palette.backgroundBottom}"/>
      </linearGradient>
      <linearGradient id="glassOverlay" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#ffffff" stop-opacity="0.14"/>
        <stop offset="0.42" stop-color="#ffffff" stop-opacity="0.035"/>
        <stop offset="1" stop-color="#ffffff" stop-opacity="0.09"/>
      </linearGradient>
      <linearGradient id="wave" x1="0" y1="118" x2="0" y2="169" gradientUnits="userSpaceOnUse">
        <stop offset="0" stop-color="${palette.accent}" stop-opacity="0.48"/>
        <stop offset="1" stop-color="${palette.accentSoft}" stop-opacity="0.04"/>
      </linearGradient>
      <radialGradient id="topGlow">
        <stop offset="0" stop-color="${palette.glow}" stop-opacity="0.62"/>
        <stop offset="1" stop-color="${palette.glow}" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="bottomGlow">
        <stop offset="0" stop-color="#ffffff" stop-opacity="0.13"/>
        <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
      </radialGradient>
      <clipPath id="waveClip">
        <rect x="3" y="91" width="234" height="79" rx="3"/>
      </clipPath>
    </defs>

    <rect width="240" height="240" fill="url(#background)"/>
    <circle cx="207" cy="14" r="92" fill="url(#topGlow)"/>
    <circle cx="19" cy="206" r="82" fill="url(#bottomGlow)"/>
    <rect width="240" height="240" fill="url(#glassOverlay)"/>
    <path d="M-20 46 Q70 12 151 34 T270 12" fill="none" stroke="#ffffff" stroke-opacity="0.08" stroke-width="18"/>

    <text x="5" y="13" fill="#ffffff" font-family="Arial, sans-serif" font-size="9" font-weight="700">${escapeXml(state.location.name)}</text>
    <text x="235" y="13" text-anchor="end" fill="#d9e6ef" font-family="Arial, sans-serif" font-size="7">${time}</text>

    ${renderIcon("metric-sunrise", 148, 12, 14)}
    <text x="163" y="22" fill="#fff0c7" font-family="Arial, sans-serif" font-size="6.5" font-weight="700">${sunrise}</text>
    ${renderIcon("metric-sunset", 193, 12, 14)}
    <text x="208" y="22" fill="#ece4ff" font-family="Arial, sans-serif" font-size="6.5" font-weight="700">${sunset}</text>

    ${renderIcon(weatherIcon, 6, 22, 48)}
    <text x="58" y="54" fill="#ffffff" font-family="Arial, sans-serif" font-size="32" font-weight="700">${displayNumber(state.current.temperatureC)}°</text>
    <text x="59" y="68" fill="${palette.accent}" font-family="Arial, sans-serif" font-size="9" font-weight="700">${escapeXml(condition.slice(0, 23))}</text>
    <text x="59" y="79" fill="#d0dee8" font-family="Arial, sans-serif" font-size="7">Ressenti ${displayNumber(state.current.apparentTemperatureC)}°</text>

    ${renderIcon("metric-humidity", 151, 28, 15)}
    <text x="171" y="40" fill="#ffffff" font-family="Arial, sans-serif" font-size="10" font-weight="700">${displayNumber(state.current.humidityPct)}%</text>
    ${renderIcon("metric-wind", 151, 55, 15)}
    <text x="171" y="66" fill="#ffffff" font-family="Arial, sans-serif" font-size="9" font-weight="700">${displayNumber(state.current.windSpeedKmh)}</text>
    <text x="188" y="66" fill="#d0dee8" font-family="Arial, sans-serif" font-size="6">km/h</text>
    <g transform="translate(220 58) rotate(${windArrowRotation(state.current.windDirectionDeg)})">
      <path d="M0 8 L0 -8 M0 -8 L-4 -2 M0 -8 L4 -2" stroke="${palette.accent}" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    </g>
    <text x="220" y="77" text-anchor="middle" fill="#ffffff" font-family="Arial, sans-serif" font-size="7" font-weight="700">${windDirection}</text>

    <line x1="5" y1="86" x2="235" y2="86" stroke="#ffffff" stroke-opacity="0.16" stroke-width="0.7"/>
    <g clip-path="url(#waveClip)">
      <path d="${geometry.areaPath}" fill="url(#wave)"/>
      <path d="${geometry.linePath}" fill="none" stroke="${palette.accent}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
      ${geometry.coordinates[0] ? `<circle cx="${geometry.coordinates[0].x}" cy="${geometry.coordinates[0].y}" r="3" fill="#ffffff" stroke="${palette.accent}" stroke-width="1.4"/>` : ""}
      ${extremaLabels(geometry)}
    </g>
    ${hourlyMarkers(hourly, palette)}

    <line x1="5" y1="174" x2="235" y2="174" stroke="#ffffff" stroke-opacity="0.15" stroke-width="0.7"/>
    ${sensorZone(8, "INT", state.indoor?.temperatureC ?? null, state.indoor?.humidityPct ?? null)}
    <line x1="120" y1="179" x2="120" y2="203" stroke="#ffffff" stroke-opacity="0.13" stroke-width="0.7"/>
    ${sensorZone(127, "EXT", state.outdoor?.temperatureC ?? null, state.outdoor?.humidityPct ?? null)}

    ${alert ? `<rect x="0" y="224" width="240" height="16" fill="${alert.background}" fill-opacity="0.94"/>
      <text x="5" y="235" fill="${alert.text}" font-family="Arial, sans-serif" font-size="7" font-weight="700">${escapeXml(alert.label.slice(0, 43))}</text>
      ${alert.published ? `<text x="235" y="235" text-anchor="end" fill="${alert.text}" fill-opacity="0.8" font-family="Arial, sans-serif" font-size="6">${alert.published}</text>` : ""}` : `<text x="120" y="237" text-anchor="middle" fill="#d0dee8" fill-opacity="0.54" font-family="Arial, sans-serif" font-size="5.5">Aucun avis</text>`}
  </svg>`;
}

export async function renderSmallTvPng(state: WeatherState): Promise<Buffer> {
  return sharp(Buffer.from(buildSmallTvSvg(state))).png().toBuffer();
}
