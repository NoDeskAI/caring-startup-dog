import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { join } from "@tauri-apps/api/path";
import { Command } from "@tauri-apps/plugin-shell";
import {
  getRecentSnapshots,
  getTodaySummary,
  getRecentMoodLogs,
  getBasePath,
} from "../db";
import type { WorkSnapshot } from "../db";
import type { ComfortMessage, StatusData } from "../store/dogStore";

// ── Work Mode Detection ──

export type WorkMode =
  | "deep_coding"
  | "msg_overload"
  | "multitasking"
  | "steady"
  | "winding_down"
  | "resting";

const MODE_LABELS: Record<WorkMode, string> = {
  deep_coding: "盯着屏幕中...",
  msg_overload: "好多声音...",
  multitasking: "东看西看...",
  steady: "走走走~",
  winding_down: "快结束了吧...",
  resting: "趴着...",
};

export function getWorkModeLabel(mode: WorkMode | null): string {
  return mode ? MODE_LABELS[mode] : "...";
}

export function detectWorkMode(snapshots: WorkSnapshot[]): WorkMode {
  if (snapshots.length === 0) return "resting";

  const recent = snapshots.slice(-3);
  const totalPrompts = recent.reduce((s, r) => s + (r.prompt_count ?? 0), 0);
  const totalMsgs = recent.reduce((s, r) => s + (r.msg_count ?? 0), 0);

  const avgPrompts = totalPrompts / recent.length;
  const avgMsgs = totalMsgs / recent.length;

  if (recent.length >= 2) {
    const firstEnergy = recent[0].energy ?? 100;
    const lastEnergy = recent[recent.length - 1].energy ?? 100;
    const allLow = avgPrompts < 1 && avgMsgs < 3;
    if (allLow && lastEnergy >= firstEnergy) return "resting";
    if (avgPrompts < 2 && avgMsgs < 3 && lastEnergy < firstEnergy) return "winding_down";
  }

  const highPrompts = avgPrompts >= 3;
  const highMsgs = avgMsgs >= 8;

  if (highPrompts && !highMsgs) return "deep_coding";
  if (highMsgs && !highPrompts) return "msg_overload";
  if (highPrompts && highMsgs) return "multitasking";

  return "steady";
}

// ── Continuous work duration ──

function calcContinuousWorkMinutes(snapshots: WorkSnapshot[]): number {
  if (snapshots.length === 0) return 0;
  let streak = 0;
  for (let i = snapshots.length - 1; i >= 0; i--) {
    const s = snapshots[i];
    const active = (s.prompt_count ?? 0) > 0 || (s.msg_count ?? 0) > 0;
    if (!active) break;
    streak += 10;
  }
  return streak;
}

// ── LLM Context Builder ──

export interface LLMContext {
  work_mode: WorkMode;
  continuous_work_minutes: number;
  work_summary: string | null;
  recent_counts: {
    prompt_count: number;
    msg_count: number;
  };
  recent_mood: {
    score: number | null;
    label: string | null;
    minutes_ago: number | null;
  };
  today_trend: {
    mood_direction: "improving" | "declining" | "stable" | "unknown";
    total_active_hours: number;
    mood_count: number;
  };
  time_of_day: "morning" | "afternoon" | "evening" | "late_night";
}

function getTimeOfDay(): LLMContext["time_of_day"] {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 18) return "afternoon";
  if (h < 22) return "evening";
  return "late_night";
}

export async function buildLLMContext(): Promise<LLMContext> {
  const base = await getBasePath();
  const statusPath = await join(base, "status.json");

  let statusData: StatusData | null = null;
  try {
    const raw = await readTextFile(statusPath);
    statusData = JSON.parse(raw) as StatusData;
  } catch { /* file may not exist */ }

  const [snapshots, moods, summary] = await Promise.all([
    getRecentSnapshots(2),
    getRecentMoodLogs(3),
    getTodaySummary(),
  ]);

  const mode = detectWorkMode(snapshots);
  const contMinutes = calcContinuousWorkMinutes(snapshots);

  let recentMood: LLMContext["recent_mood"] = {
    score: null,
    label: null,
    minutes_ago: null,
  };
  if (moods.length > 0) {
    const latest = moods[0];
    const minsAgo = Math.round(
      (Date.now() - new Date(latest.ts).getTime()) / 60000
    );
    recentMood = {
      score: latest.emotion_score,
      label: latest.emotion_label,
      minutes_ago: minsAgo,
    };
  }

  let moodDirection: LLMContext["today_trend"]["mood_direction"] = "unknown";
  if (moods.length >= 2) {
    const scores = moods.map((m) => m.emotion_score);
    const first = scores[scores.length - 1];
    const last = scores[0];
    const diff = last - first;
    if (diff > 0.3) moodDirection = "improving";
    else if (diff < -0.3) moodDirection = "declining";
    else moodDirection = "stable";
  }

  return {
    work_mode: mode,
    continuous_work_minutes: contMinutes,
    work_summary: statusData?.work_summary ?? null,
    recent_counts: {
      prompt_count: statusData?.prompt_count_1h ?? 0,
      msg_count: statusData?.msg_count_1h ?? 0,
    },
    recent_mood: recentMood,
    today_trend: {
      mood_direction: moodDirection,
      total_active_hours: statusData?.active_hours ?? (snapshots.length > 0
        ? (snapshots[snapshots.length - 1].active_hours ?? 0)
        : 0),
      mood_count: summary.count,
    },
    time_of_day: getTimeOfDay(),
  };
}

// ── Trigger LLM via OpenClaw ──

export async function triggerLLMComfort(ctx: LLMContext): Promise<void> {
  const base = await getBasePath();
  const triggerPath = await join(base, "user-response.json");
  const trigger = {
    timestamp: new Date().toISOString(),
    choice: "pet_head",
    llm_context: ctx,
    processed: false,
  };
  await writeTextFile(triggerPath, JSON.stringify(trigger, null, 2));

    const agentMsg = [
      "按照 caring-startup-dog skill 的操作流程 B 执行。",
      "读取 ~/.创业狗/user-response.json 中的 llm_context。",
      "使用 prompts/comfort-response.md 模板生成安慰话语。",
      "核心视角规则：狗是用户的创业伙伴。代称规则——'我们'用于共同经历的辛苦过程和休息提议（如'我们下去遛遛吧'），'你'用于赞美和鼓励。狗没有独立需求，不说'我饿了''我困了'。",
      "comfort_text 必须优先提到 work_summary 中的飞书事务（项目讨论、客户对接、团队协作），其次才是编码内容。飞书是第一优先级，Cursor/CC是第二优先级。不要空泛。",
      "不汇报原始数据，不说教，不用 emoji。",
      "将结果写入 ~/.创业狗/comfort-message.json（格式：{timestamp, comfort_text, choice, ttl_seconds: 15}）。",
      "然后将 user-response.json 中 processed 设为 true。",
    ].join(" ");

  const cmd = Command.create("exec-sh", [
    "-c",
    `export PATH="$HOME/.deskclaw/node/bin:$PATH" && openclaw agent --agent main --message '${agentMsg.replace(/'/g, "'\\''")}'`,
  ]);
  cmd.on("error", (err) => console.error("[llm] openclaw error:", err));
  cmd.on("close", (data) =>
    console.log("[llm] openclaw exited:", data.code)
  );
  await cmd.spawn();
}

export async function triggerPetHead(): Promise<ComfortMessage | null> {
  const ctx = await buildLLMContext();
  const base = await getBasePath();
  const comfortPath = await join(base, "comfort-message.json");

  let oldTs: string | null = null;
  try {
    const raw = await readTextFile(comfortPath);
    oldTs = (JSON.parse(raw) as ComfortMessage).timestamp;
  } catch { /* file may not exist yet */ }

  await triggerLLMComfort(ctx);

  const POLL_INTERVAL = 3000;
  const MAX_POLLS = 20;
  for (let i = 0; i < MAX_POLLS; i++) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL));
    try {
      const raw = await readTextFile(comfortPath);
      const msg = JSON.parse(raw) as ComfortMessage;
      if (msg.timestamp && msg.timestamp !== oldTs) {
        return msg;
      }
    } catch { /* retry */ }
  }
  return null;
}

// ── Fun Pool (摸摸头 → 被抽离) ──

import { FALLBACK_FUN_TEXTS } from "./fallbackFunTexts";

export async function readFunPool(): Promise<string[]> {
  try {
    const base = await getBasePath();
    const poolPath = await join(base, "fun-pool.json");
    const raw = await readTextFile(poolPath);
    const arr = JSON.parse(raw);
    if (Array.isArray(arr) && arr.length > 0) return arr as string[];
  } catch { /* file doesn't exist or is invalid */ }
  return [];
}

export async function getRandomFunText(): Promise<string> {
  const pool = await readFunPool();
  const source = pool.length > 0 ? pool : FALLBACK_FUN_TEXTS;
  return source[Math.floor(Math.random() * source.length)];
}

// ── Detect work mode from current StatusData (for watcher use) ──

export function detectWorkModeFromStatus(
  data: StatusData,
  prevSnapshots: WorkSnapshot[]
): WorkMode {
  const pseudo: WorkSnapshot = {
    id: 0,
    ts: new Date().toISOString(),
    energy: data.energy,
    msg_count: data.msg_count_1h,
    prompt_count: data.prompt_count_1h,
    active_hours: data.active_hours,
    work_mode: null,
    work_summary: data.work_summary ?? null,
    last_update: data.last_update,
  };
  return detectWorkMode([...prevSnapshots.slice(-2), pseudo]);
}
