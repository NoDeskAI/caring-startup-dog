import { useEffect, useRef } from "react";
import { readTextFile, watchImmediate } from "@tauri-apps/plugin-fs";
import { join } from "@tauri-apps/api/path";
import { useDogStore } from "../store/dogStore";
import type { StatusData, ComfortMessage, ConnState } from "../store/dogStore";
import { getBasePath, initDb, saveWorkSnapshot, getRecentSnapshots } from "../db";
import { detectWorkModeFromStatus } from "../services/localAnalysis";

const FRESH_MS = 20 * 60 * 1000;
const STALE_MS = 60 * 60 * 1000;

function deriveConnState(data: StatusData | null): ConnState {
  const now = Date.now();
  if (!data || !data.last_update) {
    return { openclaw: "off", feishu: "off", lastCheck: now };
  }
  const age = now - new Date(data.last_update).getTime();
  const openclaw = age < FRESH_MS ? "ok" : age < STALE_MS ? "stale" : "off";
  const feishu =
    typeof data.msg_count_1h === "number" && openclaw !== "off" ? "ok" : "off";
  return { openclaw, feishu, lastCheck: now };
}

async function readJsonFile<T>(path: string): Promise<T | null> {
  try {
    const content = await readTextFile(path);
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

export function useStateWatcher() {
  const setStatusData = useDogStore((s) => s.setStatusData);
  const setComfortMessage = useDogStore((s) => s.setComfortMessage);
  const setConnState = useDogStore((s) => s.setConnState);
  const setShowAskPanel = useDogStore((s) => s.setShowAskPanel);
  const lastAskTime = useRef<number>(Date.now());
  const ASK_INTERVAL_MS = 2 * 60 * 60 * 1000; // 2 hours

  useEffect(() => {
    let cleanup: (() => void) | undefined;

    async function startWatching() {
      await initDb();
      const basePath = await getBasePath();
      const statusPath = await join(basePath, "status.json");
      const comfortPath = await join(basePath, "comfort-message.json");

      let lastSnapshotUpdate: string | null = null;
      let lastComfortTs: string | null = null;

      const loadStatus = async () => {
        const data = await readJsonFile<StatusData>(statusPath);
        setConnState(deriveConnState(data));
        if (!data) return;
        setStatusData(data);

        if (data.last_update && data.last_update !== lastSnapshotUpdate) {
          lastSnapshotUpdate = data.last_update;
          try {
            const recent = await getRecentSnapshots(1);
            const mode = detectWorkModeFromStatus(data, recent);
            await saveWorkSnapshot({
              msg_count: data.msg_count_1h,
              prompt_count: data.prompt_count_1h,
              active_hours: data.active_hours,
              work_mode: mode,
              work_summary: data.work_summary,
              last_update: data.last_update,
            });
          } catch (err) {
            console.error("[snapshot] failed to save:", err);
          }
        }
      };

      const loadComfort = async () => {
        const data = await readJsonFile<ComfortMessage>(comfortPath);
        if (data && data.timestamp !== lastComfortTs) {
          lastComfortTs = data.timestamp;
          setComfortMessage(data);
        }
      };

      await loadStatus();
      await loadComfort();

      try {
        const unwatch = await watchImmediate(basePath, (event) => {
          const paths =
            typeof event.paths !== "undefined" ? event.paths : [];
          for (const p of paths) {
            if (p && p.endsWith("status.json")) loadStatus();
            if (p && p.endsWith("comfort-message.json")) loadComfort();
          }
        });
        cleanup = () => unwatch();
      } catch {
        const interval = setInterval(async () => {
          await loadStatus();
          await loadComfort();
        }, 10_000);
        cleanup = () => clearInterval(interval);
      }
    }

    startWatching();

    const askInterval = setInterval(() => {
      const now = Date.now();
      if (now - lastAskTime.current >= ASK_INTERVAL_MS) {
        lastAskTime.current = now;
        setShowAskPanel(true);
      }
    }, 60_000);

    const connRefresh = setInterval(() => {
      const sd = useDogStore.getState().statusData;
      setConnState(deriveConnState(sd));
    }, 60_000);

    return () => {
      cleanup?.();
      clearInterval(askInterval);
      clearInterval(connRefresh);
    };
  }, [setStatusData, setComfortMessage, setConnState, setShowAskPanel]);
}
