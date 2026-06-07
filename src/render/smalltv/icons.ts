import { readFileSync } from "node:fs";
import { join } from "node:path";

export type IconName =
  | "metric-humidity"
  | "metric-indoor"
  | "metric-sunrise"
  | "metric-sunset"
  | "metric-temperature"
  | "metric-wind"
  | "weather-clear"
  | "weather-cloudy"
  | "weather-fog"
  | "weather-freezing-rain"
  | "weather-hail"
  | "weather-partly-cloudy-day"
  | "weather-partly-cloudy-night"
  | "weather-rain"
  | "weather-snow"
  | "weather-thunderstorm";

type Layer = {
  color: string;
  rect?: [x: number, y: number, width: number, height: number];
};

type IconSource = {
  viewBox: string;
  path: string;
};

const CLOUD = "#eef6fb";
const CLOUD_SHADOW = "#a9bfd0";
const RAIN = "#37b9ff";
const ICE = "#8ee8ff";
const SNOW = "#dff8ff";
const SUN = "#ffd43b";
const SUN_CORE = "#ffad1f";
const MOON = "#fff0b5";
const FOG = "#c5d1dc";
const LIGHTNING = "#ffca28";

const ICON_LAYERS: Record<IconName, Layer[]> = {
  "weather-clear": [
    { color: SUN },
    { color: SUN_CORE, rect: [245, -730, 470, 500] },
  ],
  "weather-cloudy": [
    { color: CLOUD },
    { color: CLOUD_SHADOW, rect: [0, -430, 960, 430] },
  ],
  "weather-fog": [
    { color: CLOUD, rect: [0, -960, 960, 635] },
    { color: FOG, rect: [0, -340, 960, 340] },
  ],
  "weather-freezing-rain": [
    { color: CLOUD, rect: [0, -960, 960, 635] },
    { color: ICE, rect: [0, -340, 960, 340] },
  ],
  "weather-hail": [
    { color: CLOUD, rect: [0, -960, 960, 635] },
    { color: ICE, rect: [0, -340, 960, 340] },
  ],
  "weather-partly-cloudy-day": [
    { color: SUN },
    { color: SUN_CORE, rect: [285, -760, 470, 520] },
    { color: CLOUD, rect: [0, -550, 580, 550] },
    { color: CLOUD_SHADOW, rect: [0, -285, 580, 285] },
  ],
  "weather-partly-cloudy-night": [
    { color: MOON },
    { color: CLOUD, rect: [0, -500, 580, 500] },
    { color: CLOUD_SHADOW, rect: [0, -260, 580, 260] },
  ],
  "weather-rain": [
    { color: CLOUD, rect: [0, -960, 960, 635] },
    { color: RAIN, rect: [0, -340, 960, 340] },
  ],
  "weather-snow": [
    { color: CLOUD, rect: [0, -960, 960, 595] },
    { color: SNOW, rect: [0, -380, 960, 380] },
  ],
  "weather-thunderstorm": [
    { color: CLOUD_SHADOW, rect: [0, -960, 960, 635] },
    { color: LIGHTNING, rect: [0, -340, 960, 340] },
  ],
  "metric-humidity": [{ color: "#43d3ff" }],
  "metric-indoor": [{ color: "#63e6be" }],
  "metric-sunrise": [
    { color: "#ffd43b" },
    { color: "#ff8a3d", rect: [0, -380, 960, 380] },
  ],
  "metric-sunset": [
    { color: "#fff0b5" },
    { color: "#bda8ff", rect: [420, -960, 540, 960] },
  ],
  "metric-temperature": [{ color: "#ff806b" }],
  "metric-wind": [{ color: "#8fd8ff" }],
};

const iconCache = new Map<IconName, IconSource>();
let clipSequence = 0;

function loadIcon(name: IconName): IconSource {
  const cached = iconCache.get(name);
  if (cached) return cached;

  const source = readFileSync(
    join(__dirname, "../../assets/icons", `${name}.svg`),
    "utf8",
  );
  const viewBox = source.match(/viewBox="([^"]+)"/)?.[1];
  const path = source.match(/<path d="([^"]+)"/)?.[1];
  if (!viewBox || !path) throw new Error(`Icône SVG invalide: ${name}`);

  const icon = { viewBox, path };
  iconCache.set(name, icon);
  return icon;
}

export function renderIcon(
  name: IconName,
  x: number,
  y: number,
  size: number,
  colorOverride?: string,
): string {
  const icon = loadIcon(name);
  const layers = colorOverride
    ? [{ color: colorOverride }]
    : ICON_LAYERS[name];
  const clipPrefix = `icon-${clipSequence++}`;
  const definitions = layers
    .map((layer, index) => {
      if (!layer.rect) return "";
      const [rectX, rectY, width, height] = layer.rect;
      return `<clipPath id="${clipPrefix}-${index}"><rect x="${rectX}" y="${rectY}" width="${width}" height="${height}"/></clipPath>`;
    })
    .join("");
  const paths = layers
    .map((layer, index) => {
      const clip = layer.rect ? ` clip-path="url(#${clipPrefix}-${index})"` : "";
      return `<path d="${icon.path}" fill="${layer.color}"${clip}/>`;
    })
    .join("");

  return `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="${icon.viewBox}">${definitions ? `<defs>${definitions}</defs>` : ""}${paths}</svg>`;
}
