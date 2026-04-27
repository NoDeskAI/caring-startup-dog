import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { join, homeDir } from "@tauri-apps/api/path";
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
    const allLow = avgPrompts < 1 && avgMsgs < 3;
    if (allLow) return "resting";
    if (avgPrompts < 2 && avgMsgs < 3) return "winding_down";
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

// ── Trigger LLM via Agent (OpenClaw / Nanobot) ──

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
    "使用 prompts/comfort-response.md 模板生成话语。",
    "核心视角：狗是创业伙伴，只负责陪伴、认可、夸奖。",
    "必须提到 work_summary 中的具体事务，飞书优先，编码其次。",
    "语气自然随意，像朋友聊天。不说教，不PUA，不用emoji。",
    "⛔绝对禁止催促休息、喝水、站起来活动、尿尿等任何生活建议。",
    "将结果写入 ~/.创业狗/comfort-message.json（格式：{timestamp, comfort_text, choice, ttl_seconds: 15}）。",
    "然后将 user-response.json 中 processed 设为 true。",
  ].join(" ");

  const kernel = await detectKernel();
  const prefix = pathPrefix(kernel);
  const agentCmd = agentCommand(kernel, agentMsg);

  const cmd = Command.create("exec-sh", ["-c", `${prefix} && ${agentCmd}`]);
  cmd.on("error", (err) => console.error("[llm] agent error:", err));
  cmd.on("close", (data) =>
    console.log(`[llm] ${kernel} agent exited:`, data.code)
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
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed as string[];
    if (parsed && Array.isArray(parsed.items) && parsed.items.length > 0) {
      return parsed.items as string[];
    }
  } catch { /* file doesn't exist or is invalid */ }
  return [];
}

const _recentFun: string[] = [];
const RECENT_MAX = 5;

export function invalidateFunPool(): void {
  _recentFun.length = 0;
}

export async function getRandomFunText(): Promise<string> {
  const pool = await readFunPool();
  const source = pool.length > 0 ? pool : FALLBACK_FUN_TEXTS;

  let candidates = source.filter((t) => !_recentFun.includes(t));
  if (candidates.length === 0) {
    _recentFun.length = 0;
    candidates = source;
  }

  const pick = candidates[Math.floor(Math.random() * candidates.length)];
  _recentFun.push(pick);
  if (_recentFun.length > RECENT_MAX) _recentFun.shift();
  return pick;
}

// ── Cron Verification ──

interface CronJob {
  id: string;
  name: string;
  enabled: boolean;
  state?: {
    lastRunStatus?: string;
    consecutiveErrors?: number;
  };
}

async function runShell(script: string): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    const cmd = Command.create("exec-sh", ["-c", script]);
    cmd.on("close", (data) => resolve({ code: data.code ?? 1, stdout, stderr }));
    cmd.on("error", (err) => {
      stderr += String(err);
      resolve({ code: 1, stdout, stderr });
    });
    cmd.stdout.on("data", (line) => { stdout += line; });
    cmd.stderr.on("data", (line) => { stderr += line; });
    cmd.spawn();
  });
}

// ── Kernel Detection (OpenClaw vs Nanobot) ──

type Kernel = "openclaw" | "nanobot";
let _cachedKernel: Kernel | null = null;

async function detectKernel(): Promise<Kernel> {
  if (_cachedKernel) return _cachedKernel;
  const { code } = await runShell('which openclaw 2>/dev/null');
  _cachedKernel = code === 0 ? "openclaw" : "nanobot";
  console.log(`[kernel] detected: ${_cachedKernel}`);
  return _cachedKernel;
}

function pathPrefix(kernel: Kernel): string {
  return kernel === "openclaw"
    ? 'export PATH="$HOME/.deskclaw/node/bin:$PATH"'
    : 'export PATH="$HOME/.deskclaw/gateway-venv/bin:$PATH"';
}

function agentCommand(kernel: Kernel, message: string): string {
  const escaped = message.replace(/'/g, "'\\''");
  return kernel === "openclaw"
    ? `openclaw agent --agent main --message '${escaped}'`
    : `nanobot agent -m '${escaped}'`;
}

async function listCronJobs(): Promise<CronJob[]> {
  const kernel = await detectKernel();
  if (kernel === "nanobot") {
    try {
      const home = await homeDir();
      const cronPath = await join(home, ".deskclaw", "nanobot", "cron", "jobs.json");
      const raw = await readTextFile(cronPath);
      const data = JSON.parse(raw);
      return (Array.isArray(data) ? data : data.jobs || []) as CronJob[];
    } catch {
      return [];
    }
  }
  const prefix = pathPrefix(kernel);
  const { code, stdout } = await runShell(`${prefix} && openclaw cron list --json`);
  if (code !== 0) return [];
  try {
    const data = JSON.parse(stdout);
    return (data.jobs || []) as CronJob[];
  } catch {
    return [];
  }
}

export async function ensureCron(): Promise<boolean> {
  console.log("[cron-repair] checking cron jobs...");

  try {
    const kernel = await detectKernel();
    const prefix = pathPrefix(kernel);
    const jobs = await listCronJobs();
    const hourlyAnalysis = jobs.find((j) => j.name.includes("完整分析"));

    if (!hourlyAnalysis) {
      console.warn("[cron-repair] missing hourly analysis cron job");
      const msg = "请注册 caring-startup-dog skill 的 cron 任务（每小时完整分析），参考 SKILL.md 的 Cron 配置部分。只需要 1 个 cron。";
      const { code } = await runShell(`${prefix} && ${agentCommand(kernel, msg)}`);
      return code === 0;
    }

    if (!hourlyAnalysis.enabled && kernel === "openclaw") {
      console.log("[cron-repair] re-enabling hourly-analysis");
      await runShell(`${prefix} && openclaw cron edit ${hourlyAnalysis.id} --enable`);
    }

    const isError = hourlyAnalysis.state?.lastRunStatus === "error";
    if (isError) {
      console.log("[cron-repair] hourly cron in error state, triggering run...");
    }

    console.log("[cron-repair] triggering immediate cron run...");
    const basePath = await getBasePath();
    const heartbeatPath = await join(basePath, "cron-heartbeat.json");
    const statusPath = await join(basePath, "status.json");

    let beforeHbTs: string | null = null;
    let beforeStatusTs: string | null = null;
    try {
      const raw = await readTextFile(heartbeatPath);
      const hb = JSON.parse(raw) as Record<string, string>;
      beforeHbTs = hb.ts || hb.timestamp || null;
    } catch { /* noop */ }
    try {
      const raw = await readTextFile(statusPath);
      beforeStatusTs = (JSON.parse(raw) as { last_update?: string }).last_update || null;
    } catch { /* noop */ }

    if (kernel === "openclaw") {
      await runShell(`${prefix} && openclaw cron run ${hourlyAnalysis.id}`);
    } else {
      const triggerMsg = "立即执行 caring-startup-dog skill 的操作流程 A（完整状态分析）。";
      await runShell(`${prefix} && ${agentCommand(kernel, triggerMsg)}`);
    }

    const POLL_INTERVAL = 10_000;
    const MAX_POLLS = 40;
    for (let i = 0; i < MAX_POLLS; i++) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL));
      try {
        const hbRaw = await readTextFile(heartbeatPath);
        const hb = JSON.parse(hbRaw) as Record<string, string>;
        const hbTs = hb.ts || hb.timestamp || null;
        if (hbTs && hbTs !== beforeHbTs) {
          console.log("[cron-repair] heartbeat updated — repair succeeded");
          return true;
        }
      } catch { /* retry */ }
      try {
        const stRaw = await readTextFile(statusPath);
        const st = JSON.parse(stRaw) as { last_update?: string };
        if (st.last_update && st.last_update !== beforeStatusTs) {
          console.log("[cron-repair] status.json updated — cron ran (heartbeat may lag)");
          return true;
        }
      } catch { /* retry */ }
    }
    console.warn("[cron-repair] timed out waiting for heartbeat/status update");
    return false;
  } catch (err) {
    console.error("[cron-repair] failed:", err);
    return false;
  }
}

// ── Detect work mode from current StatusData (for watcher use) ──

export function detectWorkModeFromStatus(
  data: StatusData,
  prevSnapshots: WorkSnapshot[]
): WorkMode {
  const pseudo: WorkSnapshot = {
    id: 0,
    ts: new Date().toISOString(),
    energy: null,
    msg_count: data.msg_count_1h,
    prompt_count: data.prompt_count_1h,
    active_hours: data.active_hours,
    work_mode: null,
    work_summary: data.work_summary ?? null,
    last_update: data.last_update,
  };
  return detectWorkMode([...prevSnapshots.slice(-2), pseudo]);
}
