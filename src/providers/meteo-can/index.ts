import type { WeatherState } from "../../domain/weather-state.js";
import { fetchJson } from "../http.js";

type Properties = Record<string, unknown>;
type Feature = { id?: unknown; properties?: Properties };
type FeatureCollection = { features?: unknown };
type Alert = WeatherState["alerts"][number];

const firstString = (properties: Properties, keys: string[]): string | null => {
  for (const key of keys) {
    const value = properties[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return null;
};

export function buildMeteoCanUrl(latitude: number, longitude: number): URL {
  const url = new URL("https://api.weather.gc.ca/collections/weather-alerts/items");
  url.searchParams.set("f", "json");
  url.searchParams.set("lang", "fr");
  url.searchParams.set("filter-lang", "cql-text");
  url.searchParams.set("filter", `INTERSECTS(geometry,POINT(${longitude} ${latitude}))`);
  return url;
}

export function mapMeteoCan(data: unknown): Alert[] {
  const collection = data as FeatureCollection;
  if (!Array.isArray(collection.features)) return [];

  return collection.features.map((item, index) => {
    const feature = item as Feature;
    const properties = feature.properties ?? {};
    const id =
      (typeof feature.id === "string" && feature.id) ||
      firstString(properties, ["id", "feature_id", "identifier", "alert_id"]) ||
      `meteo-can-${index}`;

    return {
      source: "meteo-can",
      id,
      title: firstString(properties, ["alert_name_fr", "headline", "title", "event"]),
      event: firstString(properties, ["alert_short_name_fr", "alert_type", "event"]),
      severity: firstString(properties, ["impact_fr", "severity"]),
      riskColor: firstString(properties, ["risk_colour_fr", "risk_colour_en"]),
      urgency: firstString(properties, ["urgency"]),
      certainty: firstString(properties, ["confidence_fr", "certainty"]),
      publishedAt: firstString(properties, ["publication_datetime", "sent"]),
      effectiveAt: firstString(properties, ["validity_datetime", "effective", "sent", "onset"]),
      expiresAt: firstString(properties, ["expiration_datetime", "expires", "expiry"]),
      areaDescription: firstString(properties, ["feature_name_fr", "areaDesc", "area_description", "area"]),
      instruction: firstString(properties, ["instruction"]),
      description: firstString(properties, ["alert_text_fr", "description"]),
    };
  });
}

export async function fetchMeteoCanAlerts(
  latitude: number,
  longitude: number,
): Promise<Alert[]> {
  return mapMeteoCan(await fetchJson(buildMeteoCanUrl(latitude, longitude)));
}
