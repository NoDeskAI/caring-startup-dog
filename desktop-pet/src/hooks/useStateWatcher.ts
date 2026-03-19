import { useEffect, useRef } from "react";
import { readTextFile, watchImmediate } from "@tauri-apps/plugin-fs";
import { join } from "@tauri-apps/api/path";
import { useDogStore } from "../store/dogStore";
import type { StatusData, ComfortMessage, ConnState } from "../store/dogStore";
import { getBasePath, initDb, saveWorkSnapshot, getRecentSnapshots, getTotalCoins, getUnlockedSkins } from "../db";
import { detectWorkModeFromStatus, ensureCron } from "../services/localAnalysis";

interface CronHeartbeat {
  ts?: string;
  timestamp?: string;
  flow?: string;
  type?: string;
  llm_ok?: boolean;
  funpool_written?: boolean;
}

function getHeartbeatTs(hb: CronHeartbeat | null): string | undefined {
  return hb?.ts || hb?.timestamp;
}

const FRESH_MS = 12 * 60 * 1000;
const STALE_MS = 25 * 60 * 1000;

function deriveConnState(data: StatusData | null): ConnState {
  const now = Date.now();
  if (!data || !data.last_update) {
    return { openclaw: "off", feishu: "off", lastCheck: now };
  }
  const age = now - new Date(data.last_update).getTime();
  const openclaw = age < FRESH_MS ? "ok" : age < STALE_MS ? "stale" : "off";
  const feishu =
    data.feishu_ok === true && openclaw !== "off" ? "ok" : "off";
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
  const setCoinReady = useDogStore((s) => s.setCoinReady);
  const setTotalCoins = useDogStore((s) => s.setTotalCoins);
  const setUnlockedSkins = useDogStore((s) => s.setUnlockedSkins);
  const lastAskTime = useRef<number>(Date.now());
  const ASK_INTERVAL_MS = 2 * 60 * 60 * 1000; // 2 hours

  useEffect(() => {
    let cleanup: (() => void) | undefined;

    async function startWatching() {
      await initDb();

      const [coins, skins] = await Promise.all([getTotalCoins(), getUnlockedSkins()]);
      setTotalCoins(coins);
      setUnlockedSkins(skins);

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

        if (data.coin_ready && !useDogStore.getState().coinReady) {
          setCoinReady(true);
        }

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

    let cronRepairInProgress = false;

    async function checkCronHealth() {
      if (cronRepairInProgress) return;

      try {
        const base = await getBasePath();
        const heartbeatPath = await join(base, "cron-heartbeat.json");
        const statusPath = await join(base, "status.json");

        const heartbeat = await readJsonFile<CronHeartbeat>(heartbeatPath);
        const status = await readJsonFile<StatusData>(statusPath);

        const now = Date.now();
        const HOURLY_STALE_MS = 75 * 60 * 1000;

        const hbTs = getHeartbeatTs(heartbeat);
        const heartbeatAge = hbTs
          ? now - new Date(hbTs).getTime()
          : Infinity;
        const statusAge = status?.last_update
          ? now - new Date(status.last_update).getTime()
          : Infinity;

        const hourlyCronStale = heartbeatAge > HOURLY_STALE_MS;
        const dataCollectStale = statusAge > STALE_MS;

        if (hourlyCronStale || dataCollectStale) {
          console.log("[cron-monitor] cron appears stale", {
            heartbeatAge: Math.round(heartbeatAge / 60000),
            statusAge: Math.round(statusAge / 60000),
            hourlyCronStale,
            dataCollectStale,
          });
          cronRepairInProgress = true;
          try {
            const ok = await ensureCron();
            console.log("[cron-monitor] repair result:", ok);
          } finally {
            cronRepairInProgress = false;
          }
        }
      } catch (err) {
        console.error("[cron-monitor] check failed:", err);
      }
    }

    startWatching();

    setTimeout(checkCronHealth, 10_000);

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

    const cronHealthCheck = setInterval(checkCronHealth, 15 * 60 * 1000);

    return () => {
      cleanup?.();
      clearInterval(askInterval);
      clearInterval(connRefresh);
      clearInterval(cronHealthCheck);
    };
  }, [setStatusData, setComfortMessage, setConnState, setShowAskPanel, setCoinReady, setTotalCoins, setUnlockedSkins]);
}
