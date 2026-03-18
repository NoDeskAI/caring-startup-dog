import Database from "@tauri-apps/plugin-sql";
import { homeDir } from "@tauri-apps/api/path";

let db: Database | null = null;

export async function getDb(): Promise<Database> {
  if (db) return db;

  const home = await homeDir();
  db = await Database.load(`sqlite:${home}.创业狗/dog.db`);

  await db.execute("PRAGMA journal_mode=WAL");

  await db.execute(`
    CREATE TABLE IF NOT EXISTS mood_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      source TEXT NOT NULL,
      dog_state TEXT NOT NULL,
      emotion_score REAL NOT NULL,
      emotion_label TEXT,
      energy INTEGER,
      active_hours REAL,
      msg_count INTEGER,
      prompt_count INTEGER,
      work_summary TEXT,
      user_note TEXT
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS daily_summary (
      date TEXT PRIMARY KEY,
      avg_emotion REAL,
      total_active_hours REAL,
      total_messages INTEGER,
      total_prompts INTEGER,
      peak_stress_time TEXT,
      dog_evolution_stage TEXT,
      synced_to_feishu INTEGER DEFAULT 0
    )
  `);

  return db;
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
  const rows = await d.select<MoodLogEntry[]>(
    `SELECT id, ts, source, dog_state, emotion_score, emotion_label, energy, work_summary
     FROM mood_log
     WHERE date(ts) = date('now','localtime')
     ORDER BY ts ASC`
  );
  return rows;
}

export async function getTodaySummary(): Promise<DailySummaryData> {
  const d = await getDb();
  const rows = await d.select<DailySummaryData[]>(
    `SELECT
       COUNT(*) as count,
       COALESCE(AVG(emotion_score), 0) as avg_emotion,
       COALESCE(MIN(emotion_score), 0) as min_emotion,
       COALESCE(MAX(emotion_score), 0) as max_emotion,
       MIN(ts) as first_ts,
       MAX(ts) as last_ts
     FROM mood_log
     WHERE date(ts) = date('now','localtime')`
  );
  return rows[0] ?? { count: 0, avg_emotion: 0, min_emotion: 0, max_emotion: 0, first_ts: null, last_ts: null };
}

export async function getRecentMoodLogs(hours: number): Promise<MoodLogEntry[]> {
  const d = await getDb();
  const rows = await d.select<MoodLogEntry[]>(
    `SELECT id, ts, source, dog_state, emotion_score, emotion_label, energy, work_summary
     FROM mood_log
     WHERE ts >= datetime('now','localtime','-' || $1 || ' hours')
     ORDER BY ts DESC`,
    [hours]
  );
  return rows;
}

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
    `INSERT INTO mood_log (source, dog_state, emotion_score, emotion_label, energy, active_hours, msg_count, prompt_count, work_summary, user_note)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
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
