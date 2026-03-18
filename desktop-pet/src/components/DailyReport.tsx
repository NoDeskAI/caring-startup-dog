import { useEffect, useState } from "react";
import { useDogStore } from "../store/dogStore";
import { getTodayMoodLogs, getTodaySummary } from "../db";
import type { MoodLogEntry, DailySummaryData } from "../db";

function formatTime(ts: string): string {
  try {
    const d = new Date(ts.includes("T") ? ts : ts + "T00:00:00");
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  } catch {
    return ts.slice(11, 16) || "--:--";
  }
}

function scoreFace(score: number): string {
  if (score >= 0.5) return "^o^";
  if (score >= 0) return "^_^";
  if (score >= -0.5) return "-_-";
  return ">_<";
}

function scoreLabel(score: number): string {
  if (score >= 0.5) return "不错";
  if (score >= 0) return "还行";
  if (score >= -0.5) return "一般";
  return "低落";
}

export function DailyReport() {
  const visible = useDogStore((s) => s.showDailyReport);
  const setVisible = useDogStore((s) => s.setShowDailyReport);
  const energy = useDogStore((s) => s.energy);
  const statusData = useDogStore((s) => s.statusData);

  const [logs, setLogs] = useState<MoodLogEntry[]>([]);
  const [summary, setSummary] = useState<DailySummaryData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    Promise.all([getTodayMoodLogs(), getTodaySummary()])
      .then(([l, s]) => {
        setLogs(l);
        setSummary(s);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
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

  const avgStr = summary
    ? (Math.round(summary.avg_emotion * 10) / 10).toFixed(1)
    : "0";

  return (
    <div
      data-daily-report
      className="pixel-box"
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
        - 今日报告 -
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 20, opacity: 0.6 }}>
          读取中...
        </div>
      ) : (
        <>
          {/* summary stats */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-around",
              marginBottom: 8,
              padding: "6px 0",
              backgroundColor: "var(--pixel-bg-dark)",
              border: "1px solid var(--pixel-border)",
            }}
          >
            <StatBlock label="记录" value={String(summary?.count ?? 0)} />
            <StatBlock
              label="心情"
              value={`${avgStr} ${summary ? scoreFace(summary.avg_emotion) : ""}`}
            />
            <StatBlock label="能量" value={`${energy}`} />
          </div>

          {/* work summary */}
          {statusData?.work_summary && (
            <div
              style={{
                marginBottom: 8,
                padding: "4px 6px",
                backgroundColor: "var(--pixel-bg-dark)",
                border: "1px solid var(--pixel-border)",
                fontSize: 9,
                lineHeight: 1.5,
              }}
            >
              <div
                style={{
                  fontWeight: "bold",
                  marginBottom: 2,
                  color: "var(--pixel-text-light)",
                }}
              >
                最近工作:
              </div>
              {statusData.work_summary}
            </div>
          )}

          {/* mood timeline */}
          <div
            style={{
              fontWeight: "bold",
              marginBottom: 4,
              color: "var(--pixel-text-light)",
            }}
          >
            心情时间线:
          </div>

          {logs.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: 12,
                opacity: 0.5,
              }}
            >
              今天还没有记录
            </div>
          ) : (
            <div>
              {logs.map((log) => (
                <div
                  key={log.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "3px 0",
                    borderBottom: "1px solid rgba(139,94,52,0.15)",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "monospace",
                      color: "var(--pixel-text-light)",
                      minWidth: 36,
                    }}
                  >
                    {formatTime(log.ts)}
                  </span>
                  <span style={{ minWidth: 24, textAlign: "center" }}>
                    {scoreFace(log.emotion_score)}
                  </span>
                  <span
                    style={{
                      flex: 1,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {log.emotion_label || scoreLabel(log.emotion_score)}
                  </span>
                  {log.energy != null && (
                    <span
                      style={{
                        fontSize: 9,
                        opacity: 0.6,
                        minWidth: 20,
                        textAlign: "right",
                      }}
                    >
                      E{log.energy}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StatBlock({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 9, opacity: 0.6, marginBottom: 1 }}>{label}</div>
      <div style={{ fontWeight: "bold", fontSize: 11 }}>{value}</div>
    </div>
  );
}
