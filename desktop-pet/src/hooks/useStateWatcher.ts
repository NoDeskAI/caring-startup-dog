import { useEffect, useRef } from "react";
import { readTextFile, watchImmediate } from "@tauri-apps/plugin-fs";
import { homeDir } from "@tauri-apps/api/path";
import { useDogStore } from "../store/dogStore";
import type { StatusData, ComfortMessage } from "../store/dogStore";

async function getBasePath() {
  const home = await homeDir();
  return `${home}.创业狗`;
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
  const setShowAskPanel = useDogStore((s) => s.setShowAskPanel);
  const lastAskTime = useRef<number>(Date.now());
  const ASK_INTERVAL_MS = 2 * 60 * 60 * 1000; // 2 hours

  useEffect(() => {
    let cleanup: (() => void) | undefined;

    async function startWatching() {
      const basePath = await getBasePath();
      const statusPath = `${basePath}/status.json`;
      const comfortPath = `${basePath}/comfort-message.json`;

      const loadStatus = async () => {
        const data = await readJsonFile<StatusData>(statusPath);
        if (data) setStatusData(data);
      };

      const loadComfort = async () => {
        const data = await readJsonFile<ComfortMessage>(comfortPath);
        if (data) {
          setComfortMessage(data);
          if (data.ttl_seconds > 0) {
            setTimeout(() => setComfortMessage(null), data.ttl_seconds * 1000);
          }
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

    return () => {
      cleanup?.();
      clearInterval(askInterval);
    };
  }, [setStatusData, setComfortMessage, setShowAskPanel]);
}
