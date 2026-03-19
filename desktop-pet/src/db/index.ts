import Database from "@tauri-apps/plugin-sql";
import { homeDir } from "@tauri-apps/api/path";
import { join } from "@tauri-apps/api/path";

let db: Database | null = null;

/** "今天"从凌晨 4 点算起，用 -4 hours 偏移日期边界 */
const TODAY_SQL = "date(ts,'-4 hours') = date('now','localtime','-4 hours')";

export async function getBasePath(): Promise<string> {
  const home = await homeDir();
  return await join(home, ".创业狗");
}

export async function getDb(): Promise<Database> {
  if (db) return db;
  db = await Database.load("sqlite:dog.db");
  return db;
}

const DEFAULT_UNLOCKED_SKINS = [1, 4, 8, 9];

export async function initDb(): Promise<void> {
  try {
    const d = await getDb();
    await d.execute(
      "CREATE TABLE IF NOT EXISTS coin_log (id INTEGER PRIMARY KEY AUTOINCREMENT, ts TEXT NOT NULL DEFAULT (datetime('now','localtime')), source TEXT NOT NULL DEFAULT 'hourly')"
    );
    await d.execute(
      "CREATE TABLE IF NOT EXISTS skin_unlock (id INTEGER PRIMARY KEY AUTOINCREMENT, skin_id INTEGER NOT NULL UNIQUE, unlocked_at TEXT NOT NULL DEFAULT (datetime('now','localtime')))"
    );
    for (const skinId of DEFAULT_UNLOCKED_SKINS) {
      await d.execute(
        "INSERT OR IGNORE INTO skin_unlock (skin_id) VALUES (?)",
        [skinId]
      );
    }
    console.log("[db] connection ready");
  } catch (err) {
    console.error("[db] init failed:", err);
  }
}

// ── coin_log ──

export async function addCoin(source: string = "hourly"): Promise<void> {
  const d = await getDb();
  await d.execute("INSERT INTO coin_log (source) VALUES (?)", [source]);
}

export async function getTotalCoins(): Promise<number> {
  const d = await getDb();
  const earned = await d.select<Array<{ cnt: number }>>(
    "SELECT COUNT(*) as cnt FROM coin_log WHERE source NOT LIKE 'spend_%'"
  );
  const spent = await d.select<Array<{ cnt: number }>>(
    "SELECT COUNT(*) as cnt FROM coin_log WHERE source LIKE 'spend_%'"
  );
  return (earned[0]?.cnt ?? 0) - (spent[0]?.cnt ?? 0);
}

export async function getTodayCoins(): Promise<number> {
  const d = await getDb();
  const rows = await d.select<Array<{ cnt: number }>>(
    `SELECT COUNT(*) as cnt FROM coin_log WHERE ${TODAY_SQL}`
  );
  return rows[0]?.cnt ?? 0;
}

// ── skin_unlock ──

export async function getUnlockedSkins(): Promise<number[]> {
  const d = await getDb();
  const rows = await d.select<Array<{ skin_id: number }>>(
    "SELECT skin_id FROM skin_unlock ORDER BY skin_id ASC"
  );
  return rows.map((r) => r.skin_id);
}

export async function unlockSkin(skinId: number, cost: number): Promise<boolean> {
  const d = await getDb();
  const available = await getTotalCoins();
  if (available < cost) return false;

  await d.execute(
    "INSERT OR IGNORE INTO skin_unlock (skin_id) VALUES (?)",
    [skinId]
  );
  for (let i = 0; i < cost; i++) {
    await d.execute(
      "INSERT INTO coin_log (source) VALUES (?)",
      [`spend_skin_${skinId}`]
    );
  }
  return true;
}

export interface MoodLogEntry {
  id: number;
  ts: string;
  source: string;
  dog_state: string;
  emotion_score: number;
  emotion_label: string | null;
  energy: number | null;
  work_summary: string | null;
}

export interface DailySummaryData {
  count: number;
  avg_emotion: number;
  min_emotion: number;
  max_emotion: number;
  first_ts: string | null;
  last_ts: string | null;
}

export async function getTodayMoodLogs(): Promise<MoodLogEntry[]> {
  const d = await getDb();
  return await d.select<MoodLogEntry[]>(
    `SELECT id, ts, source, dog_state, emotion_score, emotion_label, energy, work_summary FROM mood_log WHERE ${TODAY_SQL} ORDER BY ts ASC`
  );
}

export async function getTodaySummary(): Promise<DailySummaryData> {
  const d = await getDb();
  const rows = await d.select<DailySummaryData[]>(
    `SELECT COUNT(*) as count, COALESCE(AVG(emotion_score), 0) as avg_emotion, COALESCE(MIN(emotion_score), 0) as min_emotion, COALESCE(MAX(emotion_score), 0) as max_emotion, MIN(ts) as first_ts, MAX(ts) as last_ts FROM mood_log WHERE ${TODAY_SQL}`
  );
  return rows[0] ?? { count: 0, avg_emotion: 0, min_emotion: 0, max_emotion: 0, first_ts: null, last_ts: null };
}

export async function getRecentMoodLogs(hours: number): Promise<MoodLogEntry[]> {
  const d = await getDb();
  return await d.select<MoodLogEntry[]>(
    "SELECT id, ts, source, dog_state, emotion_score, emotion_label, energy, work_summary FROM mood_log WHERE ts >= datetime('now','localtime','-' || ? || ' hours') ORDER BY ts DESC",
    [hours]
  );
}

// ── work_snapshot ──

export interface WorkSnapshot {
  id: number;
  ts: string;
  energy: number | null;
  msg_count: number | null;
  prompt_count: number | null;
  active_hours: number | null;
  work_mode: string | null;
  work_summary: string | null;
  last_update: string | null;
}

export async function saveWorkSnapshot(params: {
  energy?: number;
  msg_count?: number;
  prompt_count?: number;
  active_hours?: number;
  work_mode?: string;
  work_summary?: string;
  last_update?: string;
}): Promise<void> {
  const d = await getDb();
  await d.execute(
    "INSERT OR IGNORE INTO work_snapshot (energy, msg_count, prompt_count, active_hours, work_mode, work_summary, last_update) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [
      params.energy ?? null,
      params.msg_count ?? null,
      params.prompt_count ?? null,
      params.active_hours ?? null,
      params.work_mode ?? null,
      params.work_summary ?? null,
      params.last_update ?? null,
    ]
  );
}

export async function getTodaySnapshots(): Promise<WorkSnapshot[]> {
  const d = await getDb();
  return await d.select<WorkSnapshot[]>(
    `SELECT * FROM work_snapshot WHERE ${TODAY_SQL} ORDER BY ts ASC`
  );
}

export async function getRecentSnapshots(hours: number): Promise<WorkSnapshot[]> {
  const d = await getDb();
  return await d.select<WorkSnapshot[]>(
    "SELECT * FROM work_snapshot WHERE ts >= datetime('now','localtime','-' || ? || ' hours') ORDER BY ts ASC",
    [hours]
  );
}

export interface WorkDaySummary {
  snapshot_count: number;
  total_prompts: number;
  total_messages: number;
  max_active_hours: number;
  modes: string[];
}

export async function getTodayWorkSummary(): Promise<WorkDaySummary> {
  const d = await getDb();
  const rows = await d.select<Array<{
    cnt: number;
    tp: number;
    tm: number;
    mah: number;
  }>>(
    `SELECT COUNT(*) as cnt, COALESCE(SUM(prompt_count),0) as tp, COALESCE(SUM(msg_count),0) as tm, COALESCE(MAX(active_hours),0) as mah FROM work_snapshot WHERE ${TODAY_SQL}`
  );
  const r = rows[0] ?? { cnt: 0, tp: 0, tm: 0, mah: 0 };

  const modeRows = await d.select<Array<{ work_mode: string }>>(
    `SELECT DISTINCT work_mode FROM work_snapshot WHERE ${TODAY_SQL} AND work_mode IS NOT NULL`
  );

  return {
    snapshot_count: r.cnt,
    total_prompts: r.tp,
    total_messages: r.tm,
    max_active_hours: r.mah,
    modes: modeRows.map((m) => m.work_mode),
  };
}

// ── mood_log ──

export async function logMood(params: {
  source: string;
  dog_state: string;
  emotion_score: number;
  emotion_label?: string;
  energy?: number;
  active_hours?: number;
  msg_count?: number;
  prompt_count?: number;
  work_summary?: string;
  user_note?: string;
}): Promise<void> {
  const d = await getDb();
  await d.execute(
    "INSERT INTO mood_log (source, dog_state, emotion_score, emotion_label, energy, active_hours, msg_count, prompt_count, work_summary, user_note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [
      params.source,
      params.dog_state,
      params.emotion_score,
      params.emotion_label ?? null,
      params.energy ?? null,
      params.active_hours ?? null,
      params.msg_count ?? null,
      params.prompt_count ?? null,
      params.work_summary ?? null,
      params.user_note ?? null,
    ]
  );
}
