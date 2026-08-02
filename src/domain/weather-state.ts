export type OpenMeteoModel = "best_match";

export type WeatherForecast = {
  model: OpenMeteoModel;
  current: WeatherState["current"];
  hourly: WeatherState["hourly"];
  daily: WeatherState["daily"];
};

export type WeatherState = {
  location: {
    name: string;
    region: string;
    country: string;
    latitude: number;
    longitude: number;
  };
  updatedAt: string;
  forecastModel: OpenMeteoModel;
  current: {
    source: "open-meteo";
    temperatureC: number | null;
    apparentTemperatureC: number | null;
    humidityPct: number | null;
    dewPointC: number | null;
    weatherCode: number | null;
    isDay: boolean | null;
    conditionLabelFr: string | null;
    pressureHpa: number | null;
    surfacePressureHpa: number | null;
    cloudCoveragePct: number | null;
    visibilityM: number | null;
    windSpeedKmh: number | null;
    windDirectionDeg: number | null;
    windGustKmh: number | null;
    precipitationMm: number | null;
    uvIndex: number | null;
  };
  hourly: Array<{
    time: string;
    temperatureC: number | null;
    apparentTemperatureC: number | null;
    humidityPct: number | null;
    dewPointC: number | null;
    weatherCode: number | null;
    isDay: boolean | null;
    pressureHpa: number | null;
    surfacePressureHpa: number | null;
    cloudCoveragePct: number | null;
    visibilityM: number | null;
    windSpeedKmh: number | null;
    windDirectionDeg: number | null;
    windGustKmh: number | null;
    precipitationMm: number | null;
    precipitationProbabilityPct: number | null;
    uvIndex: number | null;
  }>;
  daily: Array<{
    date: string;
    weatherCode: number | null;
    conditionLabelFr: string | null;
    temperatureMinC: number | null;
    temperatureMaxC: number | null;
    apparentTemperatureMinC: number | null;
    apparentTemperatureMaxC: number | null;
    humidityMeanPct: number | null;
    dewPointMeanC: number | null;
    pressureMeanHpa: number | null;
    surfacePressureMeanHpa: number | null;
    cloudCoverageMeanPct: number | null;
    visibilityMeanM: number | null;
    precipitationSumMm: number | null;
    precipitationProbabilityMaxPct: number | null;
    windSpeedMaxKmh: number | null;
    windGustMaxKmh: number | null;
    windDirectionDominantDeg: number | null;
    uvIndexMax: number | null;
    daylightDurationSec: number | null;
    sunshineDurationSec: number | null;
    sunriseAt: string | null;
    sunsetAt: string | null;
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
