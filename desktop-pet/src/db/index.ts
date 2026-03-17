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
