import { useEffect, useState } from "react";
import { useDogStore } from "../store/dogStore";
import {
  fetchWeather,
  weatherIcon,
  readWeatherConfig,
} from "../services/weatherService";
import type { WeatherResult } from "../services/weatherService";

function formatHour(unix: number): string {
  const d = new Date(unix * 1000);
  return `${String(d.getHours()).padStart(2, "0")}:00`;
}

export function DailyReport() {
  const visible = useDogStore((s) => s.showDailyReport);
  const setVisible = useDogStore((s) => s.setShowDailyReport);

  const [weather, setWeather] = useState<WeatherResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [noKey, setNoKey] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    setNoKey(false);

    (async () => {
      const cfg = await readWeatherConfig();
      if (!cfg) {
        setNoKey(true);
        setLoading(false);
        return;
      }
      const data = await fetchWeather();
      setWeather(data);
      setLoading(false);
    })();
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const dismiss = (e: PointerEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("[data-daily-report]")) return;
      setVisible(false);
    };
    const timer = setTimeout(() => {
      window.addEventListener("pointerdown", dismiss);
    }, 100);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("pointerdown", dismiss);
    };
  }, [visible, setVisible]);

  if (!visible) return null;

  return (
    <>
      <div
        onClick={() => setVisible(false)}
        style={{ position: "fixed", inset: 0, zIndex: 399 }}
      />
      <div
        data-daily-report
        className="pixel-box hide-scrollbar"
        style={{
          position: "absolute",
          left: "50%",
          transform: "translateX(-50%)",
          top: 6,
          bottom: 80,
          padding: "10px 12px",
          zIndex: 400,
          width: 240,
          overflowY: "auto",
          fontSize: 10,
        }}
      >
        <div
          style={{
            textAlign: "center",
            fontWeight: "bold",
            fontSize: 12,
            marginBottom: 8,
            borderBottom: "2px solid var(--pixel-border)",
            paddingBottom: 6,
          }}
        >
          - 天气预报 -
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: 20, opacity: 0.6 }}>
            查询中...
          </div>
        ) : noKey ? (
          <div
            style={{
              textAlign: "center",
              padding: "16px 8px",
              lineHeight: 1.8,
              opacity: 0.7,
            }}
          >
            <div style={{ fontSize: 20, marginBottom: 6 }}>🔑</div>
            <div>还没配置天气~</div>
            <div style={{ fontSize: 9, marginTop: 6 }}>
              在 ~/.创业狗/config.json 中添加：
            </div>
            <div
              style={{
                fontFamily: "monospace",
                fontSize: 8,
                marginTop: 4,
                padding: "4px 6px",
                backgroundColor: "var(--pixel-bg-dark)",
                border: "1px solid var(--pixel-border)",
                textAlign: "left",
                lineHeight: 1.6,
              }}
            >
              "openweather_api_key": "你的key"
              <br />
              "weather_city": "Beijing"
            </div>
          </div>
        ) : !weather ? (
          <div style={{ textAlign: "center", padding: 20, opacity: 0.5 }}>
            天气数据获取失败...
          </div>
        ) : (
          <>
            {/* Current weather */}
            <div
              style={{
                padding: "8px",
                backgroundColor: "var(--pixel-bg-dark)",
                border: "1px solid var(--pixel-border)",
                marginBottom: 10,
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 11, marginBottom: 4, fontWeight: "bold" }}>
                {weather.city}
              </div>
              <div style={{ fontSize: 24, lineHeight: 1.2 }}>
                {weatherIcon(weather.current.icon)}
              </div>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: "bold",
                  margin: "2px 0",
                }}
              >
                {weather.current.temp}°
              </div>
              <div style={{ fontSize: 10, opacity: 0.8 }}>
                {weather.current.description}
              </div>
              <div
                style={{
                  fontSize: 9,
                  opacity: 0.6,
                  marginTop: 4,
                  display: "flex",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                <span>体感 {weather.current.feelsLike}°</span>
                <span>💧 {weather.current.humidity}%</span>
                <span>💨 {weather.current.windSpeed}m/s</span>
              </div>
            </div>

            {/* Forecast list */}
            {weather.forecast.length > 0 && (
              <>
                <div
                  style={{
                    fontWeight: "bold",
                    marginBottom: 4,
                    color: "var(--pixel-text-light)",
                  }}
                >
                  接下来:
                </div>
                <div>
                  {weather.forecast.map((entry) => (
                    <div
                      key={entry.dt}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "4px 0",
                        borderBottom: "1px solid rgba(139,94,52,0.15)",
                      }}
                    >
                      <span
                        style={{
                          fontFamily: "monospace",
                          color: "var(--pixel-text-light)",
                          minWidth: 34,
                          fontSize: 10,
                        }}
                      >
                        {formatHour(entry.dt)}
                      </span>
                      <span style={{ minWidth: 18, textAlign: "center" }}>
                        {weatherIcon(entry.icon)}
                      </span>
                      <span style={{ fontWeight: "bold", minWidth: 28 }}>
                        {entry.temp}°
                      </span>
                      <span
                        style={{
                          flex: 1,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          opacity: 0.8,
                        }}
                      >
                        {entry.description}
                      </span>
                      {entry.pop > 0 && (
                        <span
                          style={{
                            fontSize: 9,
                            opacity: 0.6,
                            whiteSpace: "nowrap",
                          }}
                        >
                          🌧{entry.pop}%
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </>
  );
}
