import { readFileSync } from "node:fs";
import { join } from "node:path";

export type IconName =
  | "metric-humidity"
  | "metric-indoor"
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

const iconCache = new Map<IconName, string>();

export function renderIcon(
  name: IconName,
  x: number,
  y: number,
  size: number,
  color: string,
): string {
  let source = iconCache.get(name);
  if (!source) {
    source = readFileSync(join(__dirname, "../../assets/icons", `${name}.svg`), "utf8");
    iconCache.set(name, source);
  }

  return source
    .replace(
      /<svg[^>]*viewBox="([^"]+)"[^>]*>/,
      `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="$1" fill="${color}">`,
    )
    .replace(/fill="#[0-9a-fA-F]+"/g, `fill="${color}"`);
}
