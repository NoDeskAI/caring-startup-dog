import { readTextFile } from "@tauri-apps/plugin-fs";
import { join, homeDir } from "@tauri-apps/api/path";

// ── Types ──

export interface ForecastEntry {
  dt: number;
  temp: number;
  feelsLike: number;
  humidity: number;
  description: string;
  icon: string;
  windSpeed: number;
  pop: number;
}

export interface WeatherResult {
  city: string;
  current: ForecastEntry;
  forecast: ForecastEntry[];
}

interface WeatherConfig {
  openweather_api_key: string;
  weather_city: string;
}

// ── Icon mapping ──

const WEATHER_ICONS: Record<string, string> = {
  "01d": "☀️",
  "01n": "🌙",
  "02d": "⛅",
  "02n": "☁️",
  "03d": "☁️",
  "03n": "☁️",
  "04d": "☁️",
  "04n": "☁️",
  "09d": "🌧️",
  "09n": "🌧️",
  "10d": "🌦️",
  "10n": "🌧️",
  "11d": "⛈️",
  "11n": "⛈️",
  "13d": "❄️",
  "13n": "❄️",
  "50d": "🌫️",
  "50n": "🌫️",
};

export function weatherIcon(code: string): string {
  return WEATHER_ICONS[code] ?? "🌤️";
}

// ── Config ──

export async function readWeatherConfig(): Promise<WeatherConfig | null> {
  try {
    const home = await homeDir();
    const cfgPath = await join(home, ".创业狗", "config.json");
    const raw = await readTextFile(cfgPath);
    const cfg = JSON.parse(raw) as Record<string, unknown>;
    const key = cfg.openweather_api_key;
    if (typeof key !== "string" || !key) return null;
    return {
      openweather_api_key: key,
      weather_city: (cfg.weather_city as string) || "Beijing",
    };
  } catch {
    return null;
  }
}

// ── Cache ──

let _cache: { data: WeatherResult; ts: number } | null = null;
const CACHE_TTL_MS = 10 * 60 * 1000;

// ── API ──

interface OWMForecastResponse {
  city: { name: string };
  list: Array<{
    dt: number;
    main: { temp: number; feels_like: number; humidity: number };
    weather: Array<{ description: string; icon: string }>;
    wind: { speed: number };
    pop: number;
  }>;
}

function parseEntry(item: OWMForecastResponse["list"][0]): ForecastEntry {
  return {
    dt: item.dt,
    temp: Math.round(item.main.temp),
    feelsLike: Math.round(item.main.feels_like),
    humidity: item.main.humidity,
    description: item.weather[0]?.description ?? "",
    icon: item.weather[0]?.icon ?? "01d",
    windSpeed: item.wind.speed,
    pop: Math.round((item.pop ?? 0) * 100),
  };
}

export async function fetchWeather(): Promise<WeatherResult | null> {
  if (_cache && Date.now() - _cache.ts < CACHE_TTL_MS) {
    return _cache.data;
  }

  const cfg = await readWeatherConfig();
  if (!cfg) return null;

  try {
    const url =
      `https://api.openweathermap.org/data/2.5/forecast` +
      `?q=${encodeURIComponent(cfg.weather_city)}` +
      `&appid=${cfg.openweather_api_key}` +
      `&lang=zh_cn&units=metric&cnt=4`;

    const res = await fetch(url);
    if (!res.ok) {
      console.error("[weather] API error:", res.status);
      return _cache?.data ?? null;
    }

    const json = (await res.json()) as OWMForecastResponse;
    if (!json.list || json.list.length === 0) return _cache?.data ?? null;

    const entries = json.list.map(parseEntry);
    const result: WeatherResult = {
      city: json.city.name,
      current: entries[0],
      forecast: entries.slice(1),
    };

    _cache = { data: result, ts: Date.now() };
    return result;
  } catch (err) {
    console.error("[weather] fetch failed:", err);
    return _cache?.data ?? null;
  }
}
