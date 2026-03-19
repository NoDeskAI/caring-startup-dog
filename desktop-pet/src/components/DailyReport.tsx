import { useEffect, useState } from "react";
import { useDogStore } from "../store/dogStore";
import { getTodayMoodLogs, getTodaySnapshots } from "../db";
import type { MoodLogEntry, WorkSnapshot } from "../db";
import type { WorkMode } from "../services/localAnalysis";

function formatTime(ts: string): string {
  try {
    const normalized = ts.replace(" ", "T");
    const d = new Date(normalized);
    if (isNaN(d.getTime())) return ts.slice(11, 16) || "--:--";
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  } catch {
    return ts.slice(11, 16) || "--:--";
  }
}

function getHour(ts: string): number {
  try {
    const d = new Date(ts.replace(" ", "T"));
    return isNaN(d.getTime()) ? 0 : d.getHours();
  } catch {
    return 0;
  }
}

function scoreFace(score: number): string {
  if (score >= 0.5) return "^o^";
  if (score >= 0) return "^_^";
  if (score >= -0.5) return "-_-";
  return ">_<";
}

// ── Narrative builder ──

interface TimeBlock {
  label: string;
  modes: WorkMode[];
  snapshotCount: number;
  promptTotal: number;
  msgTotal: number;
}

function buildTimeline(snapshots: WorkSnapshot[]): TimeBlock[] {
  const blocks: Record<string, TimeBlock> = {};
  const DAY_START = 4;
  const ranges = [
    { key: "early", label: "凌晨", start: 4, end: 6 },
    { key: "morning", label: "上午", start: 6, end: 12 },
    { key: "afternoon", label: "下午", start: 12, end: 18 },
    { key: "evening", label: "傍晚", start: 18, end: 22 },
    { key: "night", label: "深夜", start: 22, end: 28 },
  ];

  for (const s of snapshots) {
    let h = getHour(s.ts);
    if (h < DAY_START) h += 24;
    const range = ranges.find((r) => h >= r.start && h < r.end) ?? ranges[0];
    if (!blocks[range.key]) {
      blocks[range.key] = {
        label: range.label,
        modes: [],
        snapshotCount: 0,
        promptTotal: 0,
        msgTotal: 0,
      };
    }
    const b = blocks[range.key];
    b.snapshotCount++;
    b.promptTotal += s.prompt_count ?? 0;
    b.msgTotal += s.msg_count ?? 0;
    if (s.work_mode) b.modes.push(s.work_mode as WorkMode);
  }

  return ranges
    .filter((r) => blocks[r.key])
    .map((r) => blocks[r.key]);
}

const MODE_VERB: Record<WorkMode, string> = {
  deep_coding: "一直盯着屏幕，好多代码从眼前飞过",
  msg_overload: "消息好多，耳朵一直竖着",
  multitasking: "一会儿看代码一会儿听消息，转来转去的",
  steady: "不紧不慢地走着，节奏刚好",
  winding_down: "慢下来了，打了几个哈欠",
  resting: "趴着没动，很安静",
};

function describePeriod(block: TimeBlock): string {
  const uniqueModes = [...new Set(block.modes)] as WorkMode[];
  if (uniqueModes.length === 0) return `${block.label}很安静，趴着没动`;

  const primary = uniqueModes[0];
  let desc = `${block.label}${MODE_VERB[primary]}`;

  if (uniqueModes.length > 1) {
    desc += `，后来又${MODE_VERB[uniqueModes[1]]}`;
  }

  return desc;
}

function buildNarrative(
  snapshots: WorkSnapshot[],
  moods: MoodLogEntry[]
): string {
  if (snapshots.length === 0 && moods.length === 0) {
    return "今天还没有开始...伸个懒腰先";
  }

  const timeline = buildTimeline(snapshots);
  const parts: string[] = [];

  for (const block of timeline) {
    parts.push(describePeriod(block));
  }

  if (moods.length > 0) {
    const scores = moods.map((m) => m.emotion_score);
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    if (avg >= 0.3) {
      parts.push("今天虽然跑了很久，但感觉还不错");
    } else if (avg >= -0.3) {
      parts.push("起起伏伏的一天...还是撑过来了");
    } else {
      parts.push("好累...但还是撑下来了");
    }
  }

  return parts.join("。") + "。";
}

// ── Component ──

export function DailyReport() {
  const visible = useDogStore((s) => s.showDailyReport);
  const setVisible = useDogStore((s) => s.setShowDailyReport);
  const statusData = useDogStore((s) => s.statusData);

  const [moods, setMoods] = useState<MoodLogEntry[]>([]);
  const [snapshots, setSnapshots] = useState<WorkSnapshot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    Promise.all([getTodayMoodLogs(), getTodaySnapshots()])
      .then(([m, s]) => {
        setMoods(m);
        setSnapshots(s);
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

  const narrative = statusData?.daily_narrative || buildNarrative(snapshots, moods);

  return (
    <>
      {/* full-screen backdrop to catch clicks on transparent areas */}
      <div
        onClick={() => setVisible(false)}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 399,
        }}
      />
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
        - 今天的日记 -
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 20, opacity: 0.6 }}>
          读取中...
        </div>
      ) : (
        <>
          {/* narrative summary */}
          <div
            style={{
              marginBottom: 10,
              padding: "6px 8px",
              backgroundColor: "var(--pixel-bg-dark)",
              border: "1px solid var(--pixel-border)",
              lineHeight: 1.7,
              fontSize: 10,
            }}
          >
            {narrative}
          </div>

          {/* mood timeline */}
          {moods.length > 0 && (
            <>
              <div
                style={{
                  fontWeight: "bold",
                  marginBottom: 4,
                  color: "var(--pixel-text-light)",
                }}
              >
                心情记录:
              </div>
              <div>
                {moods.map((log) => (
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
                      {log.emotion_label || ""}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}

          {moods.length === 0 && snapshots.length === 0 && (
            <div
              style={{
                textAlign: "center",
                padding: 12,
                opacity: 0.5,
              }}
            >
              今天还没写什么...
            </div>
          )}
        </>
      )}
    </div>
    </>
  );
}
