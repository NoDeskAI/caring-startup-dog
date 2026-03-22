import { readTextFile } from "@tauri-apps/plugin-fs";
import { join, homeDir } from "@tauri-apps/api/path";

// ── Types ──

export interface ForecastEntry {
  time: string;
  temp: number;
  feelsLike: number;
  humidity: number;
  description: string;
  windSpeed: number;
  chanceOfRain: number;
}

export interface WeatherResult {
  ts: string;
  city: string;
  current: Omit<ForecastEntry, "time" | "chanceOfRain">;
  forecast: ForecastEntry[];
}

// ── Weather description → emoji ──

const DESC_ICON_MAP: [RegExp, string][] = [
  [/雷/, "⛈️"],
  [/暴雨|大雨/, "🌧️"],
  [/雨/, "🌦️"],
  [/雪|冰/, "❄️"],
  [/雾|霾|霜/, "🌫️"],
  [/阴/, "☁️"],
  [/多云/, "⛅"],
  [/晴/, "☀️"],
];

export function weatherEmoji(desc: string): string {
  for (const [re, icon] of DESC_ICON_MAP) {
    if (re.test(desc)) return icon;
  }
  return "🌤️";
}

// ── Read local weather file ──

let _cache: { data: WeatherResult; readAt: number } | null = null;
const READ_COOLDOWN_MS = 30_000;

export async function fetchWeather(): Promise<WeatherResult | null> {
  if (_cache && Date.now() - _cache.readAt < READ_COOLDOWN_MS) {
    return _cache.data;
  }

  try {
    const home = await homeDir();
    const weatherPath = await join(home, ".创业狗", "weather.json");
    const raw = await readTextFile(weatherPath);
    const data = JSON.parse(raw) as WeatherResult;

    if (!data.current || !data.city) return null;

    _cache = { data, readAt: Date.now() };
    return data;
  } catch {
    return _cache?.data ?? null;
  }
}
