import { readTextFile } from "@tauri-apps/plugin-fs";
import { homeDir } from "@tauri-apps/api/path";
import { getTodaySummary } from "../db";
import type { ComfortMessage } from "../store/dogStore";

interface ActivityRecord {
  ts: string;
  event: string;
  source?: string;
  prompt?: string;
}

async function readRecentActivity(hours: number): Promise<ActivityRecord[]> {
  try {
    const home = await homeDir();
    const raw = await readTextFile(`${home}.创业狗/activity.jsonl`);
    const cutoff = Date.now() - hours * 3600_000;
    const records: ActivityRecord[] = [];

    for (const line of raw.split("\n")) {
      if (!line.trim()) continue;
      try {
        const rec = JSON.parse(line) as ActivityRecord;
        const ts = new Date(rec.ts).getTime();
        if (ts >= cutoff) records.push(rec);
      } catch {
        continue;
      }
    }
    return records;
  } catch {
    return [];
  }
}

const TEMPLATES_HIGH_ACTIVITY = [
  "这一小时写了{prompts}条 prompt，节奏很稳！记得喝口水",
  "已经连续输出{prompts}条 prompt 了，效率拉满！适当眨眨眼",
  "coding 状态不错！{prompts}条 prompt 产出，保持这个势头",
];

const TEMPLATES_MEDIUM_ACTIVITY = [
  "稳步推进中，今天已经记录了{mood_count}次心情，继续加油",
  "不急不慢，节奏刚好。今天记录了{mood_count}次状态",
  "保持自己的节奏就好，你做得很棒",
];

const TEMPLATES_LOW_ACTIVITY = [
  "安静的时光也是一种积累",
  "休息也是生产力，给自己充充电",
  "有时候停下来想一想，比一直跑更重要",
];

const TEMPLATES_MOOD_POSITIVE = [
  "今天心情平均{score}分，状态不错嘛！",
  "心情指数{score}，保持好心态就是最大的竞争力",
];

const TEMPLATES_MOOD_NEGATIVE = [
  "今天辛苦了，心情{score}分。创业路上有低谷很正常",
  "心情{score}分，累的时候记得：你不是一个人在战斗",
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function fill(tpl: string, vars: Record<string, string | number>): string {
  let s = tpl;
  for (const [k, v] of Object.entries(vars)) {
    s = s.replace(`{${k}}`, String(v));
  }
  return s;
}

export async function analyzeRecentWork(): Promise<ComfortMessage> {
  const [activity, summary] = await Promise.all([
    readRecentActivity(1),
    getTodaySummary(),
  ]);

  const promptCount = activity.filter((r) => r.event === "prompt").length;
  const sessionCount = activity.filter(
    (r) => r.event === "session_start"
  ).length;

  const parts: string[] = [];

  if (promptCount >= 5) {
    parts.push(fill(pick(TEMPLATES_HIGH_ACTIVITY), { prompts: promptCount }));
  } else if (promptCount > 0 || sessionCount > 0) {
    parts.push(
      fill(pick(TEMPLATES_MEDIUM_ACTIVITY), { mood_count: summary.count })
    );
  } else {
    parts.push(pick(TEMPLATES_LOW_ACTIVITY));
  }

  if (summary.count > 0) {
    const score = Math.round(summary.avg_emotion * 10) / 10;
    const scoreStr = score >= 0 ? `+${score}` : `${score}`;
    if (summary.avg_emotion >= 0) {
      parts.push(fill(pick(TEMPLATES_MOOD_POSITIVE), { score: scoreStr }));
    } else {
      parts.push(fill(pick(TEMPLATES_MOOD_NEGATIVE), { score: scoreStr }));
    }
  }

  return {
    timestamp: new Date().toISOString(),
    comfort_text: parts.join("\n"),
    choice: "pet_head",
    ttl_seconds: 15,
  };
}
