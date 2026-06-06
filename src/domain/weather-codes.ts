const LABELS_FR: Record<number, string> = {
  0: "Ciel dégagé",
  1: "Généralement dégagé",
  2: "Partiellement nuageux",
  3: "Couvert",
  45: "Brouillard",
  48: "Brouillard givrant",
  51: "Bruine légère",
  53: "Bruine",
  55: "Bruine forte",
  56: "Bruine verglaçante",
  57: "Forte bruine verglaçante",
  61: "Pluie légère",
  63: "Pluie",
  65: "Pluie forte",
  66: "Pluie verglaçante",
  67: "Forte pluie verglaçante",
  71: "Neige légère",
  73: "Neige",
  75: "Neige forte",
  77: "Grains de neige",
  80: "Averses légères",
  81: "Averses",
  82: "Fortes averses",
  85: "Averses de neige",
  86: "Fortes averses de neige",
  95: "Orage",
  96: "Orage avec grêle",
  99: "Fort orage avec grêle",
};

export function weatherCodeLabelFr(code: number | null): string | null {
  return code === null ? null : (LABELS_FR[code] ?? "Conditions variables");
}

export type WeatherIconName =
  | "weather-clear"
  | "weather-partly-cloudy-day"
  | "weather-partly-cloudy-night"
  | "weather-cloudy"
  | "weather-fog"
  | "weather-rain"
  | "weather-freezing-rain"
  | "weather-snow"
  | "weather-thunderstorm"
  | "weather-hail";

export function weatherCodeIcon(
  code: number | null,
  isDay: boolean | null,
): WeatherIconName {
  if (code === 0) return "weather-clear";
  if (code === 1 || code === 2) {
    return isDay === false ? "weather-partly-cloudy-night" : "weather-partly-cloudy-day";
  }
  if (code === 3) return "weather-cloudy";
  if (code === 45 || code === 48) return "weather-fog";
  if ([56, 57, 66, 67].includes(code ?? -1)) return "weather-freezing-rain";
  if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code ?? -1)) return "weather-rain";
  if ([71, 73, 75, 77, 85, 86].includes(code ?? -1)) return "weather-snow";
  if (code === 96 || code === 99) return "weather-hail";
  if (code === 95) return "weather-thunderstorm";
  return "weather-cloudy";
}
