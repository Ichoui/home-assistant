export type WeatherState = {
  location: {
    name: string;
    region: string;
    country: string;
    latitude: number;
    longitude: number;
  };
  updatedAt: string;
  current: {
    source: "open-meteo";
    temperatureC: number | null;
    apparentTemperatureC: number | null;
    humidityPct: number | null;
    weatherCode: number | null;
    isDay: boolean | null;
    conditionLabelFr: string | null;
    windSpeedKmh: number | null;
    windDirectionDeg: number | null;
    precipitationMm: number | null;
  };
  hourly: Array<{
    time: string;
    temperatureC: number | null;
    weatherCode: number | null;
    isDay: boolean | null;
    precipitationProbabilityPct: number | null;
  }>;
  daily: Array<{
    date: string;
    weatherCode: number | null;
    conditionLabelFr: string | null;
    temperatureMinC: number | null;
    temperatureMaxC: number | null;
    precipitationProbabilityMaxPct: number | null;
  }>;
  alerts: Array<{
    source: "meteo-can";
    id: string;
    title: string | null;
    event: string | null;
    severity: string | null;
    riskColor: string | null;
    urgency: string | null;
    certainty: string | null;
    publishedAt: string | null;
    effectiveAt: string | null;
    expiresAt: string | null;
    areaDescription: string | null;
    instruction: string | null;
    description: string | null;
  }>;
  indoor?: {
    source: "govee";
    temperatureC: number | null;
    humidityPct: number | null;
    updatedAt: string | null;
  };
  outdoor?: {
    source: "govee";
    temperatureC: number | null;
    humidityPct: number | null;
    updatedAt: string | null;
  };
};
